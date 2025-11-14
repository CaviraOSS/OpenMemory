#!/usr/bin/env python3
"""
Web UI 主要管理類

基於 FastAPI 的 Web 用戶介面主要管理類，採用現代化架構設計。
提供完整的回饋收集、圖片上傳、命令執行等功能。
"""

import asyncio
import concurrent.futures
import os
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from ..debug import web_debug_log as debug_log
from ..utils.error_handler import ErrorHandler, ErrorType
from ..utils.memory_monitor import get_memory_monitor
from .models import CleanupReason, SessionStatus, WebFeedbackSession
from .routes import setup_routes
from .utils import get_browser_opener
from .utils.compression_config import get_compression_manager
from .utils.port_manager import PortManager


class WebUIManager:
    """Web UI 管理器 - 重構為單一活躍會話模式"""

    def __init__(self, host: str = "127.0.0.1", port: int | None = None):
        # 確定偏好主機：環境變數 > 參數 > 預設值 127.0.0.1
        env_host = os.getenv("MCP_WEB_HOST")
        if env_host:
            self.host = env_host
            debug_log(f"使用環境變數指定的主機: {self.host}")
        else:
            self.host = host
            debug_log(f"未設定 MCP_WEB_HOST 環境變數，使用預設主機 {self.host}")

        # 確定偏好端口：環境變數 > 參數 > 預設值 8765
        preferred_port = 8765

        # 檢查環境變數 MCP_WEB_PORT
        env_port = os.getenv("MCP_WEB_PORT")
        if env_port:
            try:
                custom_port = int(env_port)
                if custom_port == 0:
                    # 特殊值 0 表示使用系統自動分配的端口
                    preferred_port = 0
                    debug_log("使用環境變數指定的自動端口分配 (0)")
                elif 1024 <= custom_port <= 65535:
                    preferred_port = custom_port
                    debug_log(f"使用環境變數指定的端口: {preferred_port}")
                else:
                    debug_log(
                        f"MCP_WEB_PORT 值無效 ({custom_port})，必須在 1024-65535 範圍內或為 0，使用預設端口 8765"
                    )
            except ValueError:
                debug_log(
                    f"MCP_WEB_PORT 格式錯誤 ({env_port})，必須為數字，使用預設端口 8765"
                )
        else:
            debug_log(f"未設定 MCP_WEB_PORT 環境變數，使用預設端口 {preferred_port}")

        # 使用增強的端口管理，測試模式下禁用自動清理避免權限問題
        auto_cleanup = os.environ.get("MCP_TEST_MODE", "").lower() != "true"

        if port is not None:
            # 如果明確指定了端口，使用指定的端口
            self.port = port
            # 檢查指定端口是否可用
            if not PortManager.is_port_available(self.host, self.port):
                debug_log(f"警告：指定的端口 {self.port} 可能已被佔用")
                # 在測試模式下，嘗試尋找替代端口
                if os.environ.get("MCP_TEST_MODE", "").lower() == "true":
                    debug_log("測試模式：自動尋找替代端口")
                    original_port = self.port
                    self.port = PortManager.find_free_port_enhanced(
                        preferred_port=self.port, auto_cleanup=False, host=self.host
                    )
                    if self.port != original_port:
                        debug_log(f"自動切換到可用端口: {original_port} → {self.port}")
        elif preferred_port == 0:
            # 如果偏好端口為 0，使用系統自動分配
            import socket

            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind((self.host, 0))
                self.port = s.getsockname()[1]
            debug_log(f"系統自動分配端口: {self.port}")
        else:
            # 使用增強的端口管理
            self.port = PortManager.find_free_port_enhanced(
                preferred_port=preferred_port, auto_cleanup=auto_cleanup, host=self.host
            )
        self.app = FastAPI(title="MCP Feedback Enhanced")

        # 設置壓縮和緩存中間件
        self._setup_compression_middleware()

        # 設置內存監控
        self._setup_memory_monitoring()

        # 重構：使用單一活躍會話而非會話字典
        self.current_session: WebFeedbackSession | None = None
        self.sessions: dict[str, WebFeedbackSession] = {}  # 保留用於向後兼容

        # 全局標籤頁狀態管理 - 跨會話保持
        self.global_active_tabs: dict[str, dict] = {}

        # 會話更新通知標記
        self._pending_session_update = False

        # 會話清理統計
        self.cleanup_stats: dict[str, Any] = {
            "total_cleanups": 0,
            "expired_cleanups": 0,
            "memory_pressure_cleanups": 0,
            "manual_cleanups": 0,
            "last_cleanup_time": None,
            "total_cleanup_duration": 0.0,
            "sessions_cleaned": 0,
        }

        self.server_thread: threading.Thread | None = None
        self.server_process = None
        self.desktop_app_instance: Any = None  # 桌面應用實例引用

        # 初始化標記，用於追蹤異步初始化狀態
        self._initialization_complete = False
        self._initialization_lock = threading.Lock()

        # 同步初始化基本組件
        self._init_basic_components()

        debug_log(f"WebUIManager 基本初始化完成，將在 {self.host}:{self.port} 啟動")
        debug_log("回饋模式: web")

    def _init_basic_components(self):
        """同步初始化基本組件"""
        # 基本組件初始化（必須同步）
        # 移除 i18n 管理器，因為翻譯已移至前端

        # 設置靜態文件和模板（必須同步）
        self._setup_static_files()
        self._setup_templates()

        # 設置路由（必須同步）
        setup_routes(self)

    async def _init_async_components(self):
        """異步初始化組件（並行執行）"""
        with self._initialization_lock:
            if self._initialization_complete:
                return

        debug_log("開始並行初始化組件...")
        start_time = time.time()

        # 創建並行任務
        tasks = []

        # 任務：I18N 預載入（如果需要）
        tasks.append(self._preload_i18n_async())

        # 並行執行所有任務
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # 檢查結果
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    debug_log(f"並行初始化任務 {i} 失敗: {result}")

        with self._initialization_lock:
            self._initialization_complete = True

        elapsed = time.time() - start_time
        debug_log(f"並行初始化完成，耗時: {elapsed:.2f}秒")

    async def _preload_i18n_async(self):
        """異步預載入 I18N 資源"""

        def preload_i18n():
            try:
                # I18N 在前端處理，這裡只記錄預載入完成
                debug_log("I18N 資源預載入完成（前端處理）")
                return True
            except Exception as e:
                debug_log(f"I18N 資源預載入失敗: {e}")
                return False

        # 在線程池中執行
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(executor, preload_i18n)

    def _setup_compression_middleware(self):
        """設置壓縮和緩存中間件"""
        # 獲取壓縮管理器
        compression_manager = get_compression_manager()
        config = compression_manager.config

        # 添加 Gzip 壓縮中間件
        self.app.add_middleware(GZipMiddleware, minimum_size=config.minimum_size)

        # 添加緩存和壓縮統計中間件
        @self.app.middleware("http")
        async def compression_and_cache_middleware(request: Request, call_next):
            """壓縮和緩存中間件"""
            response = await call_next(request)

            # 添加緩存頭
            if not config.should_exclude_path(request.url.path):
                cache_headers = config.get_cache_headers(request.url.path)
                for key, value in cache_headers.items():
                    response.headers[key] = value

            # 更新壓縮統計（如果可能）
            try:
                content_length = int(response.headers.get("content-length", 0))
                content_encoding = response.headers.get("content-encoding", "")
                was_compressed = "gzip" in content_encoding

                if content_length > 0:
                    # 估算原始大小（如果已壓縮，假設壓縮比為 30%）
                    original_size = (
                        content_length
                        if not was_compressed
                        else int(content_length / 0.7)
                    )
                    compression_manager.update_stats(
                        original_size, content_length, was_compressed
                    )
            except (ValueError, TypeError):
                # 忽略統計錯誤，不影響正常響應
                pass

            return response

        debug_log("壓縮和緩存中間件設置完成")

    def _setup_memory_monitoring(self):
        """設置內存監控"""
        try:
            self.memory_monitor = get_memory_monitor()

            # 添加 Web 應用特定的警告回調
            def web_memory_alert(alert):
                debug_log(f"Web UI 內存警告 [{alert.level}]: {alert.message}")

                # 根據警告級別觸發不同的清理策略
                if alert.level == "critical":
                    # 危險級別：清理過期會話
                    cleaned = self.cleanup_expired_sessions()
                    debug_log(f"內存危險警告觸發，清理了 {cleaned} 個過期會話")
                elif alert.level == "emergency":
                    # 緊急級別：強制清理會話
                    cleaned = self.cleanup_sessions_by_memory_pressure(force=True)
                    debug_log(f"內存緊急警告觸發，強制清理了 {cleaned} 個會話")

            self.memory_monitor.add_alert_callback(web_memory_alert)

            # 添加會話清理回調到內存監控
            def session_cleanup_callback(force: bool = False):
                """內存監控觸發的會話清理回調"""
                try:
                    if force:
                        # 強制清理：包括內存壓力清理
                        cleaned = self.cleanup_sessions_by_memory_pressure(force=True)
                        debug_log(f"內存監控強制清理了 {cleaned} 個會話")
                    else:
                        # 常規清理：只清理過期會話
                        cleaned = self.cleanup_expired_sessions()
                        debug_log(f"內存監控清理了 {cleaned} 個過期會話")
                except Exception as e:
                    error_id = ErrorHandler.log_error_with_context(
                        e,
                        context={"operation": "內存監控會話清理", "force": force},
                        error_type=ErrorType.SYSTEM,
                    )
                    debug_log(f"內存監控會話清理失敗 [錯誤ID: {error_id}]: {e}")

            self.memory_monitor.add_cleanup_callback(session_cleanup_callback)

            # 確保內存監控已啟動（ResourceManager 可能已經啟動了）
            if not self.memory_monitor.is_monitoring:
                self.memory_monitor.start_monitoring()

            debug_log("Web UI 內存監控設置完成，已集成會話清理回調")

        except Exception as e:
            error_id = ErrorHandler.log_error_with_context(
                e,
                context={"operation": "設置 Web UI 內存監控"},
                error_type=ErrorType.SYSTEM,
            )
            debug_log(f"設置 Web UI 內存監控失敗 [錯誤ID: {error_id}]: {e}")

    def _setup_static_files(self):
        """設置靜態文件服務"""
        # Web UI 靜態文件
        web_static_path = Path(__file__).parent / "static"
        if web_static_path.exists():
            self.app.mount(
                "/static", StaticFiles(directory=str(web_static_path)), name="static"
            )
        else:
            raise RuntimeError(f"Static files directory not found: {web_static_path}")

    def _setup_templates(self):
        """設置模板引擎"""
        # Web UI 模板
        web_templates_path = Path(__file__).parent / "templates"
        if web_templates_path.exists():
            self.templates = Jinja2Templates(directory=str(web_templates_path))
        else:
            raise RuntimeError(f"Templates directory not found: {web_templates_path}")

    def create_session(self, project_directory: str, summary: str) -> str:
        """創建新的回饋會話 - 重構為單一活躍會話模式，保留標籤頁狀態"""
        # 保存舊會話的引用和 WebSocket 連接
        old_session = self.current_session
        old_websocket = None
        if old_session and old_session.websocket:
            old_websocket = old_session.websocket
            debug_log("保存舊會話的 WebSocket 連接以發送更新通知")

        # 創建新會話
        session_id = str(uuid.uuid4())
        session = WebFeedbackSession(session_id, project_directory, summary)

        # 如果有舊會話，處理狀態轉換和清理
        if old_session:
            debug_log(
                f"處理舊會話 {old_session.session_id} 的狀態轉換，當前狀態: {old_session.status.value}"
            )

            # 保存標籤頁狀態到全局
            if hasattr(old_session, "active_tabs"):
                self._merge_tabs_to_global(old_session.active_tabs)

            # 如果舊會話是已提交狀態，進入下一步（已完成）
            if old_session.status == SessionStatus.FEEDBACK_SUBMITTED:
                debug_log(
                    f"舊會話 {old_session.session_id} 進入下一步：已提交 → 已完成"
                )
                success = old_session.next_step("反饋已處理，會話完成")
                if success:
                    debug_log(f"✅ 舊會話 {old_session.session_id} 成功進入已完成狀態")
                else:
                    debug_log(f"❌ 舊會話 {old_session.session_id} 無法進入下一步")
            else:
                debug_log(
                    f"舊會話 {old_session.session_id} 狀態為 {old_session.status.value}，無需轉換"
                )

            # 確保舊會話仍在字典中（用於API獲取）
            if old_session.session_id in self.sessions:
                debug_log(f"舊會話 {old_session.session_id} 仍在會話字典中")
            else:
                debug_log(f"⚠️ 舊會話 {old_session.session_id} 不在會話字典中，重新添加")
                self.sessions[old_session.session_id] = old_session

            # 同步清理會話資源（但保留 WebSocket 連接）
            old_session._cleanup_sync()

        # 將全局標籤頁狀態繼承到新會話
        session.active_tabs = self.global_active_tabs.copy()

        # 設置為當前活躍會話
        self.current_session = session
        # 同時保存到字典中以保持向後兼容
        self.sessions[session_id] = session

        debug_log(f"創建新的活躍會話: {session_id}")
        debug_log(f"繼承 {len(session.active_tabs)} 個活躍標籤頁")

        # 處理WebSocket連接轉移
        if old_websocket:
            # 直接轉移連接到新會話，消息發送由 smart_open_browser 統一處理
            session.websocket = old_websocket
            debug_log("已將舊 WebSocket 連接轉移到新會話")
        else:
            # 沒有舊連接，標記需要發送會話更新通知（當新 WebSocket 連接建立時）
            self._pending_session_update = True
            debug_log("沒有舊 WebSocket 連接，設置待更新標記")

        return session_id

    def get_session(self, session_id: str) -> WebFeedbackSession | None:
        """獲取回饋會話 - 保持向後兼容"""
        return self.sessions.get(session_id)

    def get_current_session(self) -> WebFeedbackSession | None:
        """獲取當前活躍會話"""
        return self.current_session

    def remove_session(self, session_id: str):
        """移除回饋會話"""
        if session_id in self.sessions:
            session = self.sessions[session_id]
            session.cleanup()
            del self.sessions[session_id]

            # 如果移除的是當前活躍會話，清空當前會話
            if self.current_session and self.current_session.session_id == session_id:
                self.current_session = None
                debug_log("清空當前活躍會話")

            debug_log(f"移除回饋會話: {session_id}")

    def clear_current_session(self):
        """清空當前活躍會話"""
        if self.current_session:
            session_id = self.current_session.session_id
            self.current_session.cleanup()
            self.current_session = None

            # 同時從字典中移除
            if session_id in self.sessions:
                del self.sessions[session_id]

            debug_log("已清空當前活躍會話")

    def _merge_tabs_to_global(self, session_tabs: dict):
        """將會話的標籤頁狀態合併到全局狀態"""
        current_time = time.time()
        expired_threshold = 60  # 60秒過期閾值

        # 清理過期的全局標籤頁
        self.global_active_tabs = {
            tab_id: tab_info
            for tab_id, tab_info in self.global_active_tabs.items()
            if current_time - tab_info.get("last_seen", 0) <= expired_threshold
        }

        # 合併會話標籤頁到全局
        for tab_id, tab_info in session_tabs.items():
            if current_time - tab_info.get("last_seen", 0) <= expired_threshold:
                self.global_active_tabs[tab_id] = tab_info

        debug_log(f"合併標籤頁狀態，全局活躍標籤頁數量: {len(self.global_active_tabs)}")

    def get_global_active_tabs_count(self) -> int:
        """獲取全局活躍標籤頁數量"""
        current_time = time.time()
        expired_threshold = 60

        # 清理過期標籤頁並返回數量
        valid_tabs = {
            tab_id: tab_info
            for tab_id, tab_info in self.global_active_tabs.items()
            if current_time - tab_info.get("last_seen", 0) <= expired_threshold
        }

        self.global_active_tabs = valid_tabs
        return len(valid_tabs)

    async def broadcast_to_active_tabs(self, message: dict):
        """向所有活躍標籤頁廣播消息"""
        if not self.current_session or not self.current_session.websocket:
            debug_log("沒有活躍的 WebSocket 連接，無法廣播消息")
            return

        try:
            await self.current_session.websocket.send_json(message)
            debug_log(f"已廣播消息到活躍標籤頁: {message.get('type', 'unknown')}")
        except Exception as e:
            debug_log(f"廣播消息失敗: {e}")

    def start_server(self):
        """啟動 Web 伺服器（優化版本，支援並行初始化）"""

        def run_server_with_retry():
            max_retries = 5
            retry_count = 0
            original_port = self.port

            while retry_count < max_retries:
                try:
                    # 在嘗試啟動前先檢查端口是否可用
                    if not PortManager.is_port_available(self.host, self.port):
                        debug_log(f"端口 {self.port} 已被佔用，自動尋找替代端口")

                        # 查找占用端口的進程信息
                        process_info = PortManager.find_process_using_port(self.port)
                        if process_info:
                            debug_log(
                                f"端口 {self.port} 被進程 {process_info['name']} "
                                f"(PID: {process_info['pid']}) 佔用"
                            )

                        # 自動尋找新端口
                        try:
                            new_port = PortManager.find_free_port_enhanced(
                                preferred_port=self.port,
                                auto_cleanup=False,  # 不自動清理其他進程
                                host=self.host,
                            )
                            debug_log(f"自動切換端口: {self.port} → {new_port}")
                            self.port = new_port
                        except RuntimeError as port_error:
                            error_id = ErrorHandler.log_error_with_context(
                                port_error,
                                context={
                                    "operation": "端口查找",
                                    "original_port": original_port,
                                    "current_port": self.port,
                                },
                                error_type=ErrorType.NETWORK,
                            )
                            debug_log(
                                f"無法找到可用端口 [錯誤ID: {error_id}]: {port_error}"
                            )
                            raise RuntimeError(
                                f"無法找到可用端口，原始端口 {original_port} 被佔用"
                            ) from port_error

                    debug_log(
                        f"嘗試啟動伺服器在 {self.host}:{self.port} (嘗試 {retry_count + 1}/{max_retries})"
                    )

                    config = uvicorn.Config(
                        app=self.app,
                        host=self.host,
                        port=self.port,
                        log_level="warning",
                        access_log=False,
                    )

                    server_instance = uvicorn.Server(config)

                    # 創建事件循環並啟動服務器
                    async def serve_with_async_init(server=server_instance):
                        # 在服務器啟動的同時進行異步初始化
                        server_task = asyncio.create_task(server.serve())
                        init_task = asyncio.create_task(self._init_async_components())

                        # 等待兩個任務完成
                        await asyncio.gather(
                            server_task, init_task, return_exceptions=True
                        )

                    asyncio.run(serve_with_async_init())

                    # 成功啟動，顯示最終使用的端口
                    if self.port != original_port:
                        debug_log(
                            f"✅ 服務器成功啟動在替代端口 {self.port} (原端口 {original_port} 被佔用)"
                        )

                    break

                except OSError as e:
                    if e.errno in {
                        10048,
                        98,
                    }:  # Windows: 10048, Linux: 98 (位址已在使用中)
                        retry_count += 1
                        if retry_count < max_retries:
                            debug_log(
                                f"端口 {self.port} 啟動失敗 (OSError)，嘗試下一個端口"
                            )
                            # 嘗試下一個端口
                            self.port = self.port + 1
                        else:
                            debug_log("已達到最大重試次數，無法啟動伺服器")
                            break
                    else:
                        # 使用統一錯誤處理
                        error_id = ErrorHandler.log_error_with_context(
                            e,
                            context={
                                "operation": "伺服器啟動",
                                "host": self.host,
                                "port": self.port,
                            },
                            error_type=ErrorType.NETWORK,
                        )
                        debug_log(f"伺服器啟動錯誤 [錯誤ID: {error_id}]: {e}")
                        break
                except Exception as e:
                    # 使用統一錯誤處理
                    error_id = ErrorHandler.log_error_with_context(
                        e,
                        context={
                            "operation": "伺服器運行",
                            "host": self.host,
                            "port": self.port,
                        },
                        error_type=ErrorType.SYSTEM,
                    )
                    debug_log(f"伺服器運行錯誤 [錯誤ID: {error_id}]: {e}")
                    break

        # 在新線程中啟動伺服器
        self.server_thread = threading.Thread(target=run_server_with_retry, daemon=True)
        self.server_thread.start()

        # 等待伺服器啟動
        time.sleep(2)

    def open_browser(self, url: str):
        """開啟瀏覽器"""
        try:
            browser_opener = get_browser_opener()
            browser_opener(url)
            debug_log(f"已開啟瀏覽器：{url}")
        except Exception as e:
            debug_log(f"無法開啟瀏覽器: {e}")

    async def smart_open_browser(self, url: str) -> bool:
        """智能開啟瀏覽器 - 檢測是否已有活躍標籤頁

        Returns:
            bool: True 表示檢測到活躍標籤頁或桌面模式，False 表示開啟了新視窗
        """

        try:
            # 檢查是否為桌面模式
            if os.environ.get("MCP_DESKTOP_MODE", "").lower() == "true":
                debug_log("檢測到桌面模式，跳過瀏覽器開啟")
                return True

            # 檢查是否有活躍標籤頁
            has_active_tabs = await self._check_active_tabs()

            if has_active_tabs:
                debug_log("檢測到活躍標籤頁，發送刷新通知")
                debug_log(f"向現有標籤頁發送刷新通知：{url}")

                # 向現有標籤頁發送刷新通知
                refresh_success = await self.notify_existing_tab_to_refresh()

                debug_log(f"刷新通知發送結果: {refresh_success}")
                debug_log("檢測到活躍標籤頁，不開啟新瀏覽器視窗")
                return True

            # 沒有活躍標籤頁，開啟新瀏覽器視窗
            debug_log("沒有檢測到活躍標籤頁，開啟新瀏覽器視窗")
            self.open_browser(url)
            return False

        except Exception as e:
            debug_log(f"智能瀏覽器開啟失敗，回退到普通開啟：{e}")
            self.open_browser(url)
            return False

    async def launch_desktop_app(self, url: str) -> bool:
        """
        啟動桌面應用程式

        Args:
            url: Web 服務 URL

        Returns:
            bool: True 表示成功啟動桌面應用程式
        """
        try:
            # 嘗試導入桌面應用程式模組
            def import_desktop_app():
                # 首先嘗試從發佈包位置導入
                try:
                    from mcp_feedback_enhanced.desktop_app import (
                        launch_desktop_app as desktop_func,
                    )

                    debug_log("使用發佈包中的桌面應用程式模組")
                    return desktop_func
                except ImportError:
                    debug_log("發佈包中未找到桌面應用程式模組，嘗試開發環境...")

                # 回退到開發環境路徑
                import sys

                project_root = os.path.dirname(
                    os.path.dirname(os.path.dirname(__file__))
                )
                desktop_module_path = os.path.join(project_root, "src-tauri", "python")
                if desktop_module_path not in sys.path:
                    sys.path.insert(0, desktop_module_path)
                try:
                    from mcp_feedback_enhanced_desktop import (  # type: ignore
                        launch_desktop_app as dev_func,
                    )

                    debug_log("使用開發環境桌面應用程式模組")
                    return dev_func
                except ImportError:
                    debug_log("無法從開發環境路徑導入桌面應用程式模組")
                    debug_log("這可能是 PyPI 安裝的版本，桌面應用功能不可用")
                    raise

            launch_desktop_app_func = import_desktop_app()

            # 啟動桌面應用程式
            desktop_app = await launch_desktop_app_func()
            # 保存桌面應用實例引用，以便後續控制
            self.desktop_app_instance = desktop_app
            debug_log("桌面應用程式啟動成功")
            return True

        except ImportError as e:
            debug_log(f"無法導入桌面應用程式模組: {e}")
            debug_log("回退到瀏覽器模式...")
            self.open_browser(url)
            return False
        except Exception as e:
            debug_log(f"桌面應用程式啟動失敗: {e}")
            debug_log("回退到瀏覽器模式...")
            self.open_browser(url)
            return False

    def close_desktop_app(self):
        """關閉桌面應用程式"""
        if self.desktop_app_instance:
            try:
                debug_log("正在關閉桌面應用程式...")
                self.desktop_app_instance.stop()
                self.desktop_app_instance = None
                debug_log("桌面應用程式已關閉")
            except Exception as e:
                debug_log(f"關閉桌面應用程式失敗: {e}")
        else:
            debug_log("沒有活躍的桌面應用程式實例")

    async def _safe_close_websocket(self, websocket):
        """安全關閉 WebSocket 連接，避免事件循環衝突 - 僅在連接已轉移後調用"""
        if not websocket:
            return

        # 注意：此方法現在主要用於清理，因為連接已經轉移到新會話
        # 只有在確認連接沒有被新會話使用時才關閉
        try:
            # 檢查連接狀態
            if (
                hasattr(websocket, "client_state")
                and websocket.client_state.DISCONNECTED
            ):
                debug_log("WebSocket 已斷開，跳過關閉操作")
                return

            # 由於連接已轉移到新會話，這裡不再主動關閉
            # 讓新會話管理這個連接的生命週期
            debug_log("WebSocket 連接已轉移到新會話，跳過關閉操作")

        except Exception as e:
            debug_log(f"檢查 WebSocket 連接狀態時發生錯誤: {e}")

    async def notify_existing_tab_to_refresh(self) -> bool:
        """通知現有標籤頁刷新顯示新會話內容

        Returns:
            bool: True 表示成功發送，False 表示失敗
        """
        try:
            if not self.current_session or not self.current_session.websocket:
                debug_log("沒有活躍的WebSocket連接，無法發送刷新通知")
                return False

            # 構建刷新通知消息
            refresh_message = {
                "type": "session_updated",
                "action": "new_session_created",
                "messageCode": "session.created",
                "session_info": {
                    "session_id": self.current_session.session_id,
                    "project_directory": self.current_session.project_directory,
                    "summary": self.current_session.summary,
                    "status": self.current_session.status.value,
                },
            }

            # 發送刷新通知
            await self.current_session.websocket.send_json(refresh_message)
            debug_log(f"已向現有標籤頁發送刷新通知: {self.current_session.session_id}")

            # 簡單等待一下讓消息發送完成
            await asyncio.sleep(0.2)
            debug_log("刷新通知發送完成")
            return True

        except Exception as e:
            debug_log(f"發送刷新通知失敗: {e}")
            return False

    async def _check_active_tabs(self) -> bool:
        """檢查是否有活躍標籤頁 - 使用分層檢測機制"""
        try:
            # 快速檢測層：檢查 WebSocket 物件是否存在
            if not self.current_session or not self.current_session.websocket:
                debug_log("快速檢測：沒有當前會話或 WebSocket 連接")
                return False

            # 檢查心跳（如果有心跳記錄）
            last_heartbeat = getattr(self.current_session, "last_heartbeat", None)
            if last_heartbeat:
                heartbeat_age = time.time() - last_heartbeat
                if heartbeat_age > 10:  # 超過 10 秒沒有心跳
                    debug_log(f"快速檢測：心跳超時 ({heartbeat_age:.1f}秒)")
                    # 可能連接已死，需要進一步檢測
                else:
                    debug_log(f"快速檢測：心跳正常 ({heartbeat_age:.1f}秒前)")
                    return True  # 心跳正常，認為連接活躍

            # 準確檢測層：實際測試連接是否活著
            try:
                # 檢查 WebSocket 連接狀態
                websocket = self.current_session.websocket

                # 檢查連接是否已關閉
                if hasattr(websocket, "client_state"):
                    try:
                        # 嘗試從 starlette 導入（FastAPI 基於 Starlette）
                        import starlette.websockets  # type: ignore[import-not-found]

                        if hasattr(starlette.websockets, "WebSocketState"):
                            WebSocketState = starlette.websockets.WebSocketState
                            if websocket.client_state != WebSocketState.CONNECTED:
                                debug_log(
                                    f"準確檢測：WebSocket 狀態不是 CONNECTED，而是 {websocket.client_state}"
                                )
                                # 清理死連接
                                self.current_session.websocket = None
                                return False
                    except ImportError:
                        # 如果導入失敗，使用替代方法
                        debug_log("無法導入 WebSocketState，使用替代方法檢測連接")
                        # 跳過狀態檢查，直接測試連接

                # 如果連接看起來是活的，嘗試發送 ping（非阻塞）
                # 注意：FastAPI WebSocket 沒有內建的 ping 方法，這裡使用自定義消息
                await websocket.send_json({"type": "ping", "timestamp": time.time()})
                debug_log("準確檢測：成功發送 ping 消息，連接是活躍的")
                return True

            except Exception as e:
                debug_log(f"準確檢測：連接測試失敗 - {e}")
                # 連接已死，清理它
                if self.current_session:
                    self.current_session.websocket = None
                return False

        except Exception as e:
            debug_log(f"檢查活躍連接時發生錯誤：{e}")
            return False

    def get_server_url(self) -> str:
        """獲取伺服器 URL"""
        return f"http://{self.host}:{self.port}"

    def cleanup_expired_sessions(self) -> int:
        """清理過期會話"""
        cleanup_start_time = time.time()
        expired_sessions = []

        # 掃描過期會話
        for session_id, session in self.sessions.items():
            if session.is_expired():
                expired_sessions.append(session_id)

        # 批量清理過期會話
        cleaned_count = 0
        for session_id in expired_sessions:
            try:
                if session_id in self.sessions:
                    session = self.sessions[session_id]
                    # 使用增強清理方法
                    session._cleanup_sync_enhanced(CleanupReason.EXPIRED)
                    del self.sessions[session_id]
                    cleaned_count += 1

                    # 如果清理的是當前活躍會話，清空當前會話
                    if (
                        self.current_session
                        and self.current_session.session_id == session_id
                    ):
                        self.current_session = None
                        debug_log("清空過期的當前活躍會話")

            except Exception as e:
                error_id = ErrorHandler.log_error_with_context(
                    e,
                    context={"session_id": session_id, "operation": "清理過期會話"},
                    error_type=ErrorType.SYSTEM,
                )
                debug_log(f"清理過期會話 {session_id} 失敗 [錯誤ID: {error_id}]: {e}")

        # 更新統計
        cleanup_duration = time.time() - cleanup_start_time
        self.cleanup_stats.update(
            {
                "total_cleanups": self.cleanup_stats["total_cleanups"] + 1,
                "expired_cleanups": self.cleanup_stats["expired_cleanups"] + 1,
                "last_cleanup_time": datetime.now().isoformat(),
                "total_cleanup_duration": self.cleanup_stats["total_cleanup_duration"]
                + cleanup_duration,
                "sessions_cleaned": self.cleanup_stats["sessions_cleaned"]
                + cleaned_count,
            }
        )

        if cleaned_count > 0:
            debug_log(
                f"清理了 {cleaned_count} 個過期會話，耗時: {cleanup_duration:.2f}秒"
            )

        return cleaned_count

    def cleanup_sessions_by_memory_pressure(self, force: bool = False) -> int:
        """根據內存壓力清理會話"""
        cleanup_start_time = time.time()
        sessions_to_clean = []

        # 根據優先級選擇要清理的會話
        # 優先級：已完成 > 已提交反饋 > 錯誤狀態 > 空閒時間最長
        for session_id, session in self.sessions.items():
            # 跳過當前活躍會話（除非強制清理）
            if (
                not force
                and self.current_session
                and session.session_id == self.current_session.session_id
            ):
                continue

            # 優先清理已完成或錯誤狀態的會話
            if session.status in [
                SessionStatus.COMPLETED,
                SessionStatus.ERROR,
                SessionStatus.TIMEOUT,
            ]:
                sessions_to_clean.append((session_id, session, 1))  # 高優先級
            elif session.status == SessionStatus.FEEDBACK_SUBMITTED:
                # 已提交反饋但空閒時間較長的會話
                if session.get_idle_time() > 300:  # 5分鐘空閒
                    sessions_to_clean.append((session_id, session, 2))  # 中優先級
            elif session.get_idle_time() > 600:  # 10分鐘空閒
                sessions_to_clean.append((session_id, session, 3))  # 低優先級

        # 按優先級排序
        sessions_to_clean.sort(key=lambda x: x[2])

        # 清理會話（限制數量避免過度清理）
        max_cleanup = min(
            len(sessions_to_clean), 5 if not force else len(sessions_to_clean)
        )
        cleaned_count = 0

        for i in range(max_cleanup):
            session_id, session, priority = sessions_to_clean[i]
            try:
                # 使用增強清理方法
                session._cleanup_sync_enhanced(CleanupReason.MEMORY_PRESSURE)
                del self.sessions[session_id]
                cleaned_count += 1

                # 如果清理的是當前活躍會話，清空當前會話
                if (
                    self.current_session
                    and self.current_session.session_id == session_id
                ):
                    self.current_session = None
                    debug_log("因內存壓力清空當前活躍會話")

            except Exception as e:
                error_id = ErrorHandler.log_error_with_context(
                    e,
                    context={"session_id": session_id, "operation": "內存壓力清理"},
                    error_type=ErrorType.SYSTEM,
                )
                debug_log(
                    f"內存壓力清理會話 {session_id} 失敗 [錯誤ID: {error_id}]: {e}"
                )

        # 更新統計
        cleanup_duration = time.time() - cleanup_start_time
        self.cleanup_stats.update(
            {
                "total_cleanups": self.cleanup_stats["total_cleanups"] + 1,
                "memory_pressure_cleanups": self.cleanup_stats[
                    "memory_pressure_cleanups"
                ]
                + 1,
                "last_cleanup_time": datetime.now().isoformat(),
                "total_cleanup_duration": self.cleanup_stats["total_cleanup_duration"]
                + cleanup_duration,
                "sessions_cleaned": self.cleanup_stats["sessions_cleaned"]
                + cleaned_count,
            }
        )

        if cleaned_count > 0:
            debug_log(
                f"因內存壓力清理了 {cleaned_count} 個會話，耗時: {cleanup_duration:.2f}秒"
            )

        return cleaned_count

    def get_session_cleanup_stats(self) -> dict:
        """獲取會話清理統計"""
        stats = self.cleanup_stats.copy()
        stats.update(
            {
                "active_sessions": len(self.sessions),
                "current_session_id": self.current_session.session_id
                if self.current_session
                else None,
                "expired_sessions": sum(
                    1 for s in self.sessions.values() if s.is_expired()
                ),
                "idle_sessions": sum(
                    1 for s in self.sessions.values() if s.get_idle_time() > 300
                ),
                "memory_usage_mb": 0,  # 將在下面計算
            }
        )

        # 計算內存使用（如果可能）
        try:
            import psutil

            process = psutil.Process()
            stats["memory_usage_mb"] = round(
                process.memory_info().rss / (1024 * 1024), 2
            )
        except:
            pass

        return stats

    def _scan_expired_sessions(self) -> list[str]:
        """掃描過期會話ID列表"""
        expired_sessions = []
        for session_id, session in self.sessions.items():
            if session.is_expired():
                expired_sessions.append(session_id)
        return expired_sessions

    def stop(self):
        """停止 Web UI 服務"""
        # 清理所有會話
        cleanup_start_time = time.time()
        session_count = len(self.sessions)

        for session in list(self.sessions.values()):
            try:
                session._cleanup_sync_enhanced(CleanupReason.SHUTDOWN)
            except Exception as e:
                debug_log(f"停止服務時清理會話失敗: {e}")

        self.sessions.clear()
        self.current_session = None

        # 更新統計
        cleanup_duration = time.time() - cleanup_start_time
        self.cleanup_stats.update(
            {
                "total_cleanups": self.cleanup_stats["total_cleanups"] + 1,
                "manual_cleanups": self.cleanup_stats["manual_cleanups"] + 1,
                "last_cleanup_time": datetime.now().isoformat(),
                "total_cleanup_duration": self.cleanup_stats["total_cleanup_duration"]
                + cleanup_duration,
                "sessions_cleaned": self.cleanup_stats["sessions_cleaned"]
                + session_count,
            }
        )

        debug_log(
            f"停止服務時清理了 {session_count} 個會話，耗時: {cleanup_duration:.2f}秒"
        )

        # 停止伺服器（注意：uvicorn 的 graceful shutdown 需要額外處理）
        if self.server_thread is not None and self.server_thread.is_alive():
            debug_log("正在停止 Web UI 服務")


# 全域實例
_web_ui_manager: WebUIManager | None = None


def get_web_ui_manager() -> WebUIManager:
    """獲取 Web UI 管理器實例"""
    global _web_ui_manager
    if _web_ui_manager is None:
        _web_ui_manager = WebUIManager()
    return _web_ui_manager


async def launch_web_feedback_ui(
    project_directory: str, summary: str, timeout: int = 600
) -> dict:
    """
    啟動 Web 回饋介面並等待用戶回饋 - 重構為使用根路徑

    Args:
        project_directory: 專案目錄路徑
        summary: AI 工作摘要
        timeout: 超時時間（秒）

    Returns:
        dict: 回饋結果，包含 logs、interactive_feedback 和 images
    """
    manager = get_web_ui_manager()

    # 創建新會話（每次AI調用都應該創建新會話）
    manager.create_session(project_directory, summary)
    session = manager.get_current_session()

    if not session:
        raise RuntimeError("無法創建回饋會話")

    # 啟動伺服器（如果尚未啟動）
    if manager.server_thread is None or not manager.server_thread.is_alive():
        manager.start_server()

    # 檢查是否為桌面模式
    desktop_mode = os.environ.get("MCP_DESKTOP_MODE", "").lower() == "true"

    # 使用根路徑 URL
    feedback_url = manager.get_server_url()  # 直接使用根路徑

    if desktop_mode:
        # 桌面模式：啟動桌面應用程式
        debug_log("檢測到桌面模式，啟動桌面應用程式...")
        has_active_tabs = await manager.launch_desktop_app(feedback_url)
    else:
        # Web 模式：智能開啟瀏覽器
        has_active_tabs = await manager.smart_open_browser(feedback_url)

    debug_log(f"[DEBUG] 服務器地址: {feedback_url}")

    # 如果檢測到活躍標籤頁，消息已在 smart_open_browser 中發送，無需額外處理
    if has_active_tabs:
        debug_log("檢測到活躍標籤頁，會話更新通知已發送")

    try:
        # 等待用戶回饋，傳遞 timeout 參數
        result = await session.wait_for_feedback(timeout)
        debug_log("收到用戶回饋")
        return result
    except TimeoutError:
        debug_log("會話超時")
        # 資源已在 wait_for_feedback 中清理，這裡只需要記錄和重新拋出
        raise
    except Exception as e:
        debug_log(f"會話發生錯誤: {e}")
        raise
    finally:
        # 注意：不再自動清理會話和停止服務器，保持持久性
        # 會話將保持活躍狀態，等待下次 MCP 調用
        debug_log("會話保持活躍狀態，等待下次 MCP 調用")


def stop_web_ui():
    """停止 Web UI 服務"""
    global _web_ui_manager
    if _web_ui_manager:
        _web_ui_manager.stop()
        _web_ui_manager = None
        debug_log("Web UI 服務已停止")


# 測試用主函數
if __name__ == "__main__":

    async def main():
        try:
            project_dir = os.getcwd()
            summary = """# Markdown 功能測試

## 🎯 任務完成摘要

我已成功為 **mcp-feedback-enhanced** 專案實現了 Markdown 語法顯示功能！

### ✅ 完成的功能

1. **標題支援** - 支援 H1 到 H6 標題
2. **文字格式化**
   - **粗體文字** 使用雙星號
   - *斜體文字* 使用單星號
   - `行內程式碼` 使用反引號
3. **程式碼區塊**
4. **列表功能**
   - 無序列表項目
   - 有序列表項目

### 📋 技術實作

```javascript
// 使用 marked.js 進行 Markdown 解析
const renderedContent = this.renderMarkdownSafely(summary);
element.innerHTML = renderedContent;
```

### 🔗 相關連結

- [marked.js 官方文檔](https://marked.js.org/)
- [DOMPurify 安全清理](https://github.com/cure53/DOMPurify)

> **注意**: 此功能包含 XSS 防護，使用 DOMPurify 進行 HTML 清理。

---

**測試狀態**: ✅ 功能正常運作"""

            from ..debug import debug_log

            debug_log("啟動 Web UI 測試...")
            debug_log(f"專案目錄: {project_dir}")
            debug_log("等待用戶回饋...")

            result = await launch_web_feedback_ui(project_dir, summary)

            debug_log("收到回饋結果:")
            debug_log(f"命令日誌: {result.get('logs', '')}")
            debug_log(f"互動回饋: {result.get('interactive_feedback', '')}")
            debug_log(f"圖片數量: {len(result.get('images', []))}")

        except KeyboardInterrupt:
            debug_log("\n用戶取消操作")
        except Exception as e:
            debug_log(f"錯誤: {e}")
        finally:
            stop_web_ui()

    asyncio.run(main())
