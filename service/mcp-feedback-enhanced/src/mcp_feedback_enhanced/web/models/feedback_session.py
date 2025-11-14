#!/usr/bin/env python3
"""
Web 回饋會話模型
===============

管理 Web 回饋會話的資料和邏輯。

注意：此文件中的 subprocess 調用已經過安全處理，使用 shlex.split() 解析命令
並禁用 shell=True 以防止命令注入攻擊。
"""

import asyncio
import base64
import shlex
import subprocess
import threading
import time
from collections.abc import Callable
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any

from fastapi import WebSocket

from ...debug import web_debug_log as debug_log
from ...utils.error_handler import ErrorHandler, ErrorType
from ...utils.resource_manager import get_resource_manager, register_process
from ..constants import get_message_code


class SessionStatus(Enum):
    """會話狀態枚舉 - 單向流轉設計"""

    WAITING = "waiting"  # 等待中
    ACTIVE = "active"  # 活躍狀態
    FEEDBACK_SUBMITTED = "feedback_submitted"  # 已提交反饋
    COMPLETED = "completed"  # 已完成
    ERROR = "error"  # 錯誤（終態）
    TIMEOUT = "timeout"  # 超時（終態）
    EXPIRED = "expired"  # 已過期（終態）


class CleanupReason(Enum):
    """清理原因枚舉"""

    TIMEOUT = "timeout"  # 超時清理
    EXPIRED = "expired"  # 過期清理
    MEMORY_PRESSURE = "memory_pressure"  # 內存壓力清理
    MANUAL = "manual"  # 手動清理
    ERROR = "error"  # 錯誤清理
    SHUTDOWN = "shutdown"  # 系統關閉清理


# 常數定義
MAX_IMAGE_SIZE = 1 * 1024 * 1024  # 1MB 圖片大小限制
SUPPORTED_IMAGE_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/bmp",
    "image/webp",
}
TEMP_DIR = Path.home() / ".cache" / "interactive-feedback-mcp-web"

# 訊息代碼現在從統一的常量文件導入
# 使用 get_message_code 函數來獲取訊息代碼


def _safe_parse_command(command: str) -> list[str]:
    """
    安全解析命令字符串，避免 shell 注入攻擊

    Args:
        command: 命令字符串

    Returns:
        list[str]: 解析後的命令參數列表

    Raises:
        ValueError: 如果命令包含不安全的字符
    """
    try:
        # 使用 shlex 安全解析命令
        parsed = shlex.split(command)

        # 基本安全檢查：禁止某些危險字符和命令
        dangerous_patterns = [
            ";",
            "&&",
            "||",
            "|",
            ">",
            "<",
            "`",
            "$(",
            "rm -rf",
            "del /f",
            "format",
            "fdisk",
        ]

        command_lower = command.lower()
        for pattern in dangerous_patterns:
            if pattern in command_lower:
                raise ValueError(f"命令包含不安全的模式: {pattern}")

        if not parsed:
            raise ValueError("空命令")

        return parsed

    except Exception as e:
        debug_log(f"命令解析失敗: {e}")
        raise ValueError(f"無法安全解析命令: {e}") from e


class WebFeedbackSession:
    """Web 回饋會話管理"""

    def __init__(
        self,
        session_id: str,
        project_directory: str,
        summary: str,
        auto_cleanup_delay: int = 3600,
        max_idle_time: int = 1800,
    ):
        self.session_id = session_id
        self.project_directory = project_directory
        self.summary = summary
        self.websocket: WebSocket | None = None
        self.feedback_result: str | None = None
        self.images: list[dict] = []
        self.settings: dict[str, Any] = {}  # 圖片設定
        self.feedback_completed = threading.Event()
        self.process: subprocess.Popen | None = None
        self.command_logs: list[str] = []
        self.user_messages: list[dict] = []  # 用戶消息記錄
        self._cleanup_done = False  # 防止重複清理
        # 移除語言設定，改由前端處理

        # 新增：會話狀態管理
        self.status = SessionStatus.WAITING
        self.status_message = "等待用戶回饋"
        # 統一使用 time.time() 以避免時間基準不一致
        self.created_at = time.time()
        self.last_activity = self.created_at
        self.last_heartbeat = None  # 記錄最後一次心跳時間

        # 新增：自動清理配置
        self.auto_cleanup_delay = auto_cleanup_delay  # 自動清理延遲時間（秒）
        self.max_idle_time = max_idle_time  # 最大空閒時間（秒）
        self.cleanup_timer: threading.Timer | None = None
        self.cleanup_callbacks: list[Callable[..., None]] = []  # 清理回調函數列表

        # 新增：清理統計
        self.cleanup_stats: dict[str, Any] = {
            "cleanup_count": 0,
            "last_cleanup_time": None,
            "cleanup_reason": None,
            "cleanup_duration": 0.0,
            "memory_freed": 0,
            "resources_cleaned": 0,
        }

        # 新增：活躍標籤頁管理
        self.active_tabs: dict[str, Any] = {}

        # 新增：用戶設定的會話超時
        self.user_timeout_enabled = False
        self.user_timeout_seconds = 3600  # 預設 1 小時
        self.user_timeout_timer: threading.Timer | None = None

        # 確保臨時目錄存在
        TEMP_DIR.mkdir(parents=True, exist_ok=True)

        # 獲取資源管理器實例
        self.resource_manager = get_resource_manager()

        # 啟動自動清理定時器
        self._schedule_auto_cleanup()

        debug_log(
            f"會話 {self.session_id} 初始化完成，自動清理延遲: {auto_cleanup_delay}秒，最大空閒: {max_idle_time}秒"
        )

    def get_message_code(self, key: str) -> str:
        """
        獲取訊息代碼

        Args:
            key: 訊息 key

        Returns:
            訊息代碼（用於前端 i18n）
        """
        return get_message_code(key)

    def next_step(self, message: str | None = None) -> bool:
        """進入下一個狀態 - 單向流轉，不可倒退"""
        old_status = self.status

        # 定義狀態流轉路徑
        next_status_map = {
            SessionStatus.WAITING: SessionStatus.ACTIVE,
            SessionStatus.ACTIVE: SessionStatus.FEEDBACK_SUBMITTED,
            SessionStatus.FEEDBACK_SUBMITTED: SessionStatus.COMPLETED,
            SessionStatus.COMPLETED: None,  # 終態
            SessionStatus.ERROR: None,  # 終態
            SessionStatus.TIMEOUT: None,  # 終態
            SessionStatus.EXPIRED: None,  # 終態
        }

        next_status = next_status_map.get(self.status)

        if next_status is None:
            debug_log(
                f"⚠️ 會話 {self.session_id} 已處於終態 {self.status.value}，無法進入下一步"
            )
            return False

        # 執行狀態轉換
        self.status = next_status
        if message:
            self.status_message = message
        else:
            # 默認消息
            default_messages = {
                SessionStatus.ACTIVE: "會話已啟動",
                SessionStatus.FEEDBACK_SUBMITTED: "用戶已提交反饋",
                SessionStatus.COMPLETED: "會話已完成",
            }
            self.status_message = default_messages.get(next_status, "狀態已更新")

        self.last_activity = time.time()

        # 如果會話變為已提交狀態，重置清理定時器
        if next_status == SessionStatus.FEEDBACK_SUBMITTED:
            self._schedule_auto_cleanup()

        debug_log(
            f"✅ 會話 {self.session_id} 狀態流轉: {old_status.value} → {next_status.value} - {self.status_message}"
        )
        return True

    def set_error(self, message: str = "會話發生錯誤") -> bool:
        """設置錯誤狀態（特殊方法，可從任何狀態進入）"""
        old_status = self.status
        self.status = SessionStatus.ERROR
        self.status_message = message
        self.last_activity = time.time()

        debug_log(
            f"❌ 會話 {self.session_id} 設置為錯誤狀態: {old_status.value} → {self.status.value} - {message}"
        )
        return True

    def set_expired(self, message: str = "會話已過期") -> bool:
        """設置過期狀態（特殊方法，可從任何狀態進入）"""
        old_status = self.status
        self.status = SessionStatus.EXPIRED
        self.status_message = message
        self.last_activity = time.time()

        debug_log(
            f"⏰ 會話 {self.session_id} 設置為過期狀態: {old_status.value} → {self.status.value} - {message}"
        )
        return True

    def can_proceed(self) -> bool:
        """檢查是否可以進入下一步"""
        return self.status in [SessionStatus.WAITING, SessionStatus.FEEDBACK_SUBMITTED]

    def is_terminal(self) -> bool:
        """檢查是否處於終態"""
        return self.status in [
            SessionStatus.COMPLETED,
            SessionStatus.ERROR,
            SessionStatus.TIMEOUT,
            SessionStatus.EXPIRED,
        ]

    def get_status_info(self) -> dict[str, Any]:
        """獲取會話狀態信息"""
        return {
            "status": self.status.value,
            "message": self.status_message,
            "feedback_completed": self.feedback_completed.is_set(),
            "has_websocket": self.websocket is not None,
            "created_at": self.created_at,
            "last_activity": self.last_activity,
            "project_directory": self.project_directory,
            "summary": self.summary,
            "session_id": self.session_id,
        }

    def is_active(self) -> bool:
        """檢查會話是否活躍"""
        return self.status in [
            SessionStatus.WAITING,
            SessionStatus.ACTIVE,
            SessionStatus.FEEDBACK_SUBMITTED,
        ]

    def is_expired(self) -> bool:
        """檢查會話是否已過期"""
        # 統一使用 time.time()
        current_time = time.time()

        # 檢查是否超過最大空閒時間
        idle_time = current_time - self.last_activity
        if idle_time > self.max_idle_time:
            debug_log(
                f"會話 {self.session_id} 空閒時間過長: {idle_time:.1f}秒 > {self.max_idle_time}秒"
            )
            return True

        # 檢查是否處於已過期狀態
        if self.status == SessionStatus.EXPIRED:
            return True

        # 檢查是否處於錯誤或超時狀態且超過一定時間
        if self.status in [SessionStatus.ERROR, SessionStatus.TIMEOUT]:
            error_time = current_time - self.last_activity
            if error_time > 300:  # 錯誤狀態超過5分鐘視為過期
                debug_log(
                    f"會話 {self.session_id} 錯誤狀態時間過長: {error_time:.1f}秒"
                )
                return True

        return False

    def get_age(self) -> float:
        """獲取會話年齡（秒）"""
        current_time = time.time()
        return current_time - self.created_at

    def get_idle_time(self) -> float:
        """獲取會話空閒時間（秒）"""
        current_time = time.time()
        return current_time - self.last_activity

    def _schedule_auto_cleanup(self):
        """安排自動清理定時器"""
        if self.cleanup_timer:
            self.cleanup_timer.cancel()

        def auto_cleanup():
            """自動清理回調"""
            try:
                if not self._cleanup_done and self.is_expired():
                    debug_log(f"會話 {self.session_id} 觸發自動清理（過期）")
                    # 使用異步方式執行清理
                    import asyncio

                    try:
                        loop = asyncio.get_event_loop()
                        loop.create_task(
                            self._cleanup_resources_enhanced(CleanupReason.EXPIRED)
                        )
                    except RuntimeError:
                        # 如果沒有事件循環，使用同步清理
                        self._cleanup_sync_enhanced(CleanupReason.EXPIRED)
                else:
                    # 如果還沒過期，重新安排定時器
                    self._schedule_auto_cleanup()
            except Exception as e:
                error_id = ErrorHandler.log_error_with_context(
                    e,
                    context={"session_id": self.session_id, "operation": "自動清理"},
                    error_type=ErrorType.SYSTEM,
                )
                debug_log(f"自動清理失敗 [錯誤ID: {error_id}]: {e}")

        self.cleanup_timer = threading.Timer(self.auto_cleanup_delay, auto_cleanup)
        self.cleanup_timer.daemon = True
        self.cleanup_timer.start()
        debug_log(
            f"會話 {self.session_id} 自動清理定時器已設置，{self.auto_cleanup_delay}秒後觸發"
        )

    def extend_cleanup_timer(self, additional_time: int | None = None):
        """延長清理定時器"""
        if additional_time is None:
            additional_time = self.auto_cleanup_delay

        if self.cleanup_timer:
            self.cleanup_timer.cancel()

        self.cleanup_timer = threading.Timer(additional_time, lambda: None)
        self.cleanup_timer.daemon = True
        self.cleanup_timer.start()

        debug_log(f"會話 {self.session_id} 清理定時器已延長 {additional_time} 秒")

    def add_cleanup_callback(self, callback: Callable[..., None]):
        """添加清理回調函數"""
        if callback not in self.cleanup_callbacks:
            self.cleanup_callbacks.append(callback)
            debug_log(f"會話 {self.session_id} 添加清理回調函數")

    def remove_cleanup_callback(self, callback: Callable[..., None]):
        """移除清理回調函數"""
        if callback in self.cleanup_callbacks:
            self.cleanup_callbacks.remove(callback)
            debug_log(f"會話 {self.session_id} 移除清理回調函數")

    def get_cleanup_stats(self) -> dict[str, Any]:
        """獲取清理統計信息"""
        stats = self.cleanup_stats.copy()
        stats.update(
            {
                "session_id": self.session_id,
                "age": self.get_age(),
                "idle_time": self.get_idle_time(),
                "is_expired": self.is_expired(),
                "is_active": self.is_active(),
                "status": self.status.value,
                "has_websocket": self.websocket is not None,
                "has_process": self.process is not None,
                "command_logs_count": len(self.command_logs),
                "images_count": len(self.images),
            }
        )
        return stats

    def update_timeout_settings(self, enabled: bool, timeout_seconds: int = 3600):
        """
        更新用戶設定的會話超時

        Args:
            enabled: 是否啟用超時
            timeout_seconds: 超時秒數
        """
        debug_log(f"更新會話超時設定: enabled={enabled}, seconds={timeout_seconds}")

        # 先停止現有的計時器
        if self.user_timeout_timer:
            self.user_timeout_timer.cancel()
            self.user_timeout_timer = None

        self.user_timeout_enabled = enabled
        self.user_timeout_seconds = timeout_seconds

        # 如果啟用且會話還在等待中，啟動計時器
        if enabled and self.status == SessionStatus.WAITING:

            def timeout_handler():
                debug_log(f"用戶設定的超時已到: {self.session_id}")
                # 設置超時標誌
                self.status = SessionStatus.TIMEOUT
                self.status_message = "用戶設定的會話超時"
                # 設置完成事件，讓 wait_for_feedback 結束等待
                self.feedback_completed.set()

            self.user_timeout_timer = threading.Timer(timeout_seconds, timeout_handler)
            self.user_timeout_timer.start()
            debug_log(f"已啟動用戶超時計時器: {timeout_seconds}秒")

    async def wait_for_feedback(self, timeout: int = 600) -> dict[str, Any]:
        """
        等待用戶回饋，包含圖片，支援超時自動清理

        Args:
            timeout: 超時時間（秒）

        Returns:
            dict: 回饋結果
        """
        try:
            # 使用比 MCP 超時稍短的時間（提前處理，避免邊界競爭）
            # 對於短超時（<30秒），提前1秒；對於長超時，提前5秒
            if timeout <= 30:
                actual_timeout = max(timeout - 1, 5)  # 短超時提前1秒，最少5秒
            else:
                actual_timeout = timeout - 5  # 長超時提前5秒
            debug_log(
                f"會話 {self.session_id} 開始等待回饋，超時時間: {actual_timeout} 秒（原始: {timeout} 秒）"
            )

            loop = asyncio.get_event_loop()

            def wait_in_thread():
                return self.feedback_completed.wait(actual_timeout)

            completed = await loop.run_in_executor(None, wait_in_thread)

            if completed:
                # 檢查是否是用戶設定的超時
                if self.status == SessionStatus.TIMEOUT and self.user_timeout_enabled:
                    debug_log(f"會話 {self.session_id} 因用戶設定超時而結束")
                    await self._cleanup_resources_on_timeout()
                    raise TimeoutError("會話已因用戶設定的超時而關閉")

                debug_log(f"會話 {self.session_id} 收到用戶回饋")
                return {
                    "logs": "\n".join(self.command_logs),
                    "interactive_feedback": self.feedback_result or "",
                    "images": self.images,
                    "settings": self.settings,
                }
            # 超時了，立即清理資源
            debug_log(
                f"會話 {self.session_id} 在 {actual_timeout} 秒後超時，開始清理資源..."
            )
            await self._cleanup_resources_on_timeout()
            raise TimeoutError(
                f"等待用戶回饋超時（{actual_timeout}秒），介面已自動關閉"
            )

        except Exception as e:
            # 任何異常都要確保清理資源
            debug_log(f"會話 {self.session_id} 發生異常: {e}")
            await self._cleanup_resources_on_timeout()
            raise

    async def submit_feedback(
        self,
        feedback: str,
        images: list[dict[str, Any]],
        settings: dict[str, Any] | None = None,
    ):
        """
        提交回饋和圖片

        Args:
            feedback: 文字回饋
            images: 圖片列表
            settings: 圖片設定（可選）
        """
        self.feedback_result = feedback
        # 先設置設定，再處理圖片（因為處理圖片時需要用到設定）
        self.settings = settings or {}
        self.images = self._process_images(images)

        # 進入下一步：等待中 → 已提交反饋
        self.next_step("已送出反饋，等待下次 MCP 調用")

        self.feedback_completed.set()

        # 發送反饋已收到的消息給前端
        if self.websocket:
            try:
                await self.websocket.send_json(
                    {
                        "type": "notification",
                        "code": self.get_message_code("FEEDBACK_SUBMITTED"),
                        "severity": "success",
                        "status": self.status.value,
                    }
                )

                # 檢查是否為桌面模式，如果是則立即關閉桌面應用程式
                import os

                if os.environ.get("MCP_DESKTOP_MODE", "").lower() == "true":
                    debug_log("桌面模式：反饋提交後立即關閉桌面應用程式")

                    # 立即關閉桌面應用程式，無延遲
                    try:
                        from ..main import get_web_ui_manager

                        manager = get_web_ui_manager()
                        manager.close_desktop_app()
                        debug_log("桌面應用程式立即關閉成功")
                    except Exception as close_error:
                        debug_log(f"立即關閉桌面應用程式失敗: {close_error}")

            except Exception as e:
                debug_log(f"發送反饋確認失敗: {e}")

        # 重構：不再自動關閉 WebSocket，保持連接以支援頁面持久性

    def add_user_message(self, message_data: dict[str, Any]) -> None:
        """添加用戶消息記錄"""
        import time

        # 創建用戶消息記錄
        user_message = {
            "timestamp": int(time.time() * 1000),  # 毫秒時間戳
            "content": message_data.get("content", ""),
            "images": message_data.get("images", []),
            "submission_method": message_data.get("submission_method", "manual"),
            "type": "feedback",
        }

        self.user_messages.append(user_message)
        debug_log(
            f"會話 {self.session_id} 添加用戶消息，總數: {len(self.user_messages)}"
        )

    def _process_images(self, images: list[dict]) -> list[dict]:
        """
        處理圖片數據，轉換為統一格式

        Args:
            images: 原始圖片數據列表

        Returns:
            List[dict]: 處理後的圖片數據
        """
        processed_images = []

        # 從設定中獲取圖片大小限制，如果沒有設定則使用預設值
        size_limit = self.settings.get("image_size_limit", MAX_IMAGE_SIZE)

        for img in images:
            try:
                if not all(key in img for key in ["name", "data", "size"]):
                    continue

                # 檢查文件大小（只有當限制大於0時才檢查）
                if size_limit > 0 and img["size"] > size_limit:
                    debug_log(
                        f"圖片 {img['name']} 超過大小限制 ({size_limit} bytes)，跳過"
                    )
                    continue

                # 解碼 base64 數據
                if isinstance(img["data"], str):
                    try:
                        image_bytes = base64.b64decode(img["data"])
                    except Exception as e:
                        debug_log(f"圖片 {img['name']} base64 解碼失敗: {e}")
                        continue
                else:
                    image_bytes = img["data"]

                if len(image_bytes) == 0:
                    debug_log(f"圖片 {img['name']} 數據為空，跳過")
                    continue

                processed_images.append(
                    {
                        "name": img["name"],
                        "data": image_bytes,  # 保存原始 bytes 數據
                        "size": len(image_bytes),
                    }
                )

                debug_log(
                    f"圖片 {img['name']} 處理成功，大小: {len(image_bytes)} bytes"
                )

            except Exception as e:
                debug_log(f"圖片處理錯誤: {e}")
                continue

        return processed_images

    def add_log(self, log_entry: str):
        """添加命令日誌"""
        self.command_logs.append(log_entry)

    async def run_command(self, command: str):
        """執行命令並透過 WebSocket 發送輸出（安全版本）"""
        if self.process:
            # 終止現有進程
            try:
                self.process.terminate()
                self.process.wait(timeout=5)
            except:
                try:
                    self.process.kill()
                except:
                    pass
            self.process = None

        try:
            debug_log(f"執行命令: {command}")

            # 安全解析命令
            try:
                parsed_command = _safe_parse_command(command)
            except ValueError as e:
                error_msg = f"命令安全檢查失敗: {e}"
                debug_log(error_msg)
                if self.websocket:
                    await self.websocket.send_json(
                        {"type": "command_error", "error": error_msg}
                    )
                return

            # 使用安全的方式執行命令（不使用 shell=True）
            self.process = subprocess.Popen(
                parsed_command,
                shell=False,  # 安全：不使用 shell
                cwd=self.project_directory,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True,
            )

            # 註冊進程到資源管理器
            register_process(
                self.process,
                description=f"WebFeedbackSession-{self.session_id}-command",
                auto_cleanup=True,
            )

            # 在背景線程中讀取輸出
            async def read_output():
                loop = asyncio.get_event_loop()
                try:
                    # 使用線程池執行器來處理阻塞的讀取操作
                    def read_line():
                        if self.process and self.process.stdout:
                            return self.process.stdout.readline()
                        return ""

                    while True:
                        line = await loop.run_in_executor(None, read_line)
                        if not line:
                            break

                        self.add_log(line.rstrip())
                        if self.websocket:
                            try:
                                await self.websocket.send_json(
                                    {"type": "command_output", "output": line}
                                )
                            except Exception as e:
                                debug_log(f"WebSocket 發送失敗: {e}")
                                break

                except Exception as e:
                    debug_log(f"讀取命令輸出錯誤: {e}")
                finally:
                    # 等待進程完成
                    if self.process:
                        exit_code = self.process.wait()

                        # 從資源管理器取消註冊進程
                        self.resource_manager.unregister_process(self.process.pid)

                        # 發送命令完成信號
                        if self.websocket:
                            try:
                                await self.websocket.send_json(
                                    {"type": "command_complete", "exit_code": exit_code}
                                )
                            except Exception as e:
                                debug_log(f"發送完成信號失敗: {e}")

            # 啟動異步任務讀取輸出
            asyncio.create_task(read_output())

        except Exception as e:
            debug_log(f"執行命令錯誤: {e}")
            if self.websocket:
                try:
                    await self.websocket.send_json(
                        {"type": "command_error", "error": str(e)}
                    )
                except:
                    pass

    async def _cleanup_resources_on_timeout(self):
        """超時時清理所有資源（保持向後兼容）"""
        await self._cleanup_resources_enhanced(CleanupReason.TIMEOUT)

    async def _cleanup_resources_enhanced(self, reason: CleanupReason):
        """增強的資源清理方法"""
        if self._cleanup_done:
            return  # 避免重複清理

        cleanup_start_time = time.time()
        self._cleanup_done = True

        debug_log(f"開始清理會話 {self.session_id} 的資源，原因: {reason.value}")

        # 更新清理統計
        self.cleanup_stats["cleanup_count"] += 1
        self.cleanup_stats["cleanup_reason"] = reason.value
        self.cleanup_stats["last_cleanup_time"] = datetime.now().isoformat()

        resources_cleaned = 0
        memory_before = 0

        try:
            # 記錄清理前的內存使用（如果可能）
            try:
                import psutil

                process = psutil.Process()
                memory_before = process.memory_info().rss
            except:
                pass

            # 1. 取消自動清理定時器
            if self.cleanup_timer:
                self.cleanup_timer.cancel()
                self.cleanup_timer = None
                resources_cleaned += 1

            # 1.5. 取消用戶超時計時器
            if self.user_timeout_timer:
                self.user_timeout_timer.cancel()
                self.user_timeout_timer = None
                resources_cleaned += 1

            # 2. 關閉 WebSocket 連接
            if self.websocket:
                try:
                    # 根據清理原因獲取訊息代碼
                    code_key_map = {
                        CleanupReason.TIMEOUT: "TIMEOUT_CLEANUP",
                        CleanupReason.EXPIRED: "EXPIRED_CLEANUP",
                        CleanupReason.MEMORY_PRESSURE: "MEMORY_PRESSURE_CLEANUP",
                        CleanupReason.MANUAL: "MANUAL_CLEANUP",
                        CleanupReason.ERROR: "ERROR_CLEANUP",
                        CleanupReason.SHUTDOWN: "SHUTDOWN_CLEANUP",
                    }

                    code_key = code_key_map.get(reason, "SESSION_CLEANUP")

                    await self.websocket.send_json(
                        {
                            "type": "notification",
                            "code": self.get_message_code(code_key),
                            "severity": "warning",
                            "reason": reason.value,
                        }
                    )
                    await asyncio.sleep(0.1)  # 給前端一點時間處理消息

                    # 安全關閉 WebSocket
                    await self._safe_close_websocket()
                    debug_log(f"會話 {self.session_id} WebSocket 已關閉")
                    resources_cleaned += 1
                except Exception as e:
                    debug_log(f"關閉 WebSocket 時發生錯誤: {e}")
                finally:
                    self.websocket = None

            # 3. 終止正在運行的命令進程
            if self.process:
                try:
                    self.process.terminate()
                    try:
                        self.process.wait(timeout=3)
                        debug_log(f"會話 {self.session_id} 命令進程已正常終止")
                    except subprocess.TimeoutExpired:
                        self.process.kill()
                        debug_log(f"會話 {self.session_id} 命令進程已強制終止")
                    resources_cleaned += 1
                except Exception as e:
                    debug_log(f"終止命令進程時發生錯誤: {e}")
                finally:
                    self.process = None

            # 4. 設置完成事件（防止其他地方還在等待）
            self.feedback_completed.set()

            # 5. 清理臨時數據
            logs_count = len(self.command_logs)
            images_count = len(self.images)

            self.command_logs.clear()
            self.images.clear()
            self.settings.clear()

            if logs_count > 0 or images_count > 0:
                resources_cleaned += logs_count + images_count
                debug_log(f"清理了 {logs_count} 條日誌和 {images_count} 張圖片")

            # 6. 更新會話狀態
            if reason == CleanupReason.EXPIRED:
                self.status = SessionStatus.EXPIRED
            elif reason == CleanupReason.TIMEOUT:
                self.status = SessionStatus.TIMEOUT
            elif reason == CleanupReason.ERROR:
                self.status = SessionStatus.ERROR
            else:
                self.status = SessionStatus.COMPLETED

            # 7. 調用清理回調函數
            for callback in self.cleanup_callbacks:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(self, reason)
                    else:
                        callback(self, reason)
                except Exception as e:
                    debug_log(f"清理回調執行失敗: {e}")

            # 8. 計算清理效果
            cleanup_duration = time.time() - cleanup_start_time
            memory_after = 0
            try:
                import psutil

                process = psutil.Process()
                memory_after = process.memory_info().rss
            except:
                pass

            memory_freed = max(0, memory_before - memory_after)

            # 更新清理統計
            self.cleanup_stats.update(
                {
                    "cleanup_duration": cleanup_duration,
                    "memory_freed": memory_freed,
                    "resources_cleaned": resources_cleaned,
                }
            )

            debug_log(
                f"會話 {self.session_id} 資源清理完成，耗時: {cleanup_duration:.2f}秒，"
                f"清理資源: {resources_cleaned}個，釋放內存: {memory_freed}字節"
            )

        except Exception as e:
            error_id = ErrorHandler.log_error_with_context(
                e,
                context={
                    "session_id": self.session_id,
                    "cleanup_reason": reason.value,
                    "operation": "增強資源清理",
                },
                error_type=ErrorType.SYSTEM,
            )
            debug_log(
                f"清理會話 {self.session_id} 資源時發生錯誤 [錯誤ID: {error_id}]: {e}"
            )

            # 即使發生錯誤也要更新統計
            self.cleanup_stats["cleanup_duration"] = time.time() - cleanup_start_time

    def _cleanup_sync(self):
        """同步清理會話資源（但保留 WebSocket 連接）- 保持向後兼容"""
        self._cleanup_sync_enhanced(CleanupReason.MANUAL, preserve_websocket=True)

    def _cleanup_sync_enhanced(
        self, reason: CleanupReason, preserve_websocket: bool = False
    ):
        """增強的同步清理會話資源"""
        if self._cleanup_done and not preserve_websocket:
            return

        cleanup_start_time = time.time()
        debug_log(
            f"同步清理會話 {self.session_id} 資源，原因: {reason.value}，保留WebSocket: {preserve_websocket}"
        )

        # 更新清理統計
        self.cleanup_stats["cleanup_count"] += 1
        self.cleanup_stats["cleanup_reason"] = reason.value
        self.cleanup_stats["last_cleanup_time"] = datetime.now().isoformat()

        resources_cleaned = 0
        memory_before = 0

        try:
            # 記錄清理前的內存使用
            try:
                import psutil

                process = psutil.Process()
                memory_before = process.memory_info().rss
            except:
                pass

            # 1. 取消自動清理定時器
            if self.cleanup_timer:
                self.cleanup_timer.cancel()
                self.cleanup_timer = None
                resources_cleaned += 1

            # 2. 清理進程
            if self.process:
                try:
                    self.process.terminate()
                    self.process.wait(timeout=5)
                    debug_log(f"會話 {self.session_id} 命令進程已正常終止")
                    resources_cleaned += 1
                except:
                    try:
                        self.process.kill()
                        debug_log(f"會話 {self.session_id} 命令進程已強制終止")
                        resources_cleaned += 1
                    except:
                        pass
                self.process = None

            # 3. 清理臨時數據
            logs_count = len(self.command_logs)
            images_count = len(self.images)

            self.command_logs.clear()
            if not preserve_websocket:
                self.images.clear()
                self.settings.clear()
                resources_cleaned += images_count

            resources_cleaned += logs_count

            # 4. 設置完成事件
            if not preserve_websocket:
                self.feedback_completed.set()

            # 5. 更新狀態
            if not preserve_websocket:
                if reason == CleanupReason.EXPIRED:
                    self.status = SessionStatus.EXPIRED
                elif reason == CleanupReason.TIMEOUT:
                    self.status = SessionStatus.TIMEOUT
                elif reason == CleanupReason.ERROR:
                    self.status = SessionStatus.ERROR
                else:
                    self.status = SessionStatus.COMPLETED

                self._cleanup_done = True

            # 6. 調用清理回調函數（同步版本）
            for callback in self.cleanup_callbacks:
                try:
                    if not asyncio.iscoroutinefunction(callback):
                        callback(self, reason)
                except Exception as e:
                    debug_log(f"同步清理回調執行失敗: {e}")

            # 7. 計算清理效果
            cleanup_duration = time.time() - cleanup_start_time
            memory_after = 0
            try:
                import psutil

                process = psutil.Process()
                memory_after = process.memory_info().rss
            except:
                pass

            memory_freed = max(0, memory_before - memory_after)

            # 更新清理統計
            self.cleanup_stats.update(
                {
                    "cleanup_duration": cleanup_duration,
                    "memory_freed": memory_freed,
                    "resources_cleaned": resources_cleaned,
                }
            )

            debug_log(
                f"會話 {self.session_id} 同步清理完成，耗時: {cleanup_duration:.2f}秒，"
                f"清理資源: {resources_cleaned}個，釋放內存: {memory_freed}字節"
            )

        except Exception as e:
            error_id = ErrorHandler.log_error_with_context(
                e,
                context={
                    "session_id": self.session_id,
                    "cleanup_reason": reason.value,
                    "preserve_websocket": preserve_websocket,
                    "operation": "同步資源清理",
                },
                error_type=ErrorType.SYSTEM,
            )
            debug_log(
                f"同步清理會話 {self.session_id} 資源時發生錯誤 [錯誤ID: {error_id}]: {e}"
            )

            # 即使發生錯誤也要更新統計
            self.cleanup_stats["cleanup_duration"] = time.time() - cleanup_start_time

    def cleanup(self):
        """同步清理會話資源（保持向後兼容）"""
        self._cleanup_sync_enhanced(CleanupReason.MANUAL)

    async def _safe_close_websocket(self):
        """安全關閉 WebSocket 連接，避免事件循環衝突"""
        if not self.websocket:
            return

        try:
            # 檢查連接狀態
            if (
                hasattr(self.websocket, "client_state")
                and self.websocket.client_state.DISCONNECTED
            ):
                debug_log("WebSocket 已斷開，跳過關閉操作")
                return

            # 嘗試正常關閉
            await asyncio.wait_for(
                self.websocket.close(code=1000, reason="會話清理"), timeout=2.0
            )
            debug_log(f"會話 {self.session_id} WebSocket 已正常關閉")

        except TimeoutError:
            debug_log(f"會話 {self.session_id} WebSocket 關閉超時")
        except RuntimeError as e:
            if "attached to a different loop" in str(e):
                debug_log(
                    f"會話 {self.session_id} WebSocket 事件循環衝突，忽略關閉錯誤: {e}"
                )
            else:
                debug_log(f"會話 {self.session_id} WebSocket 關閉時發生運行時錯誤: {e}")
        except Exception as e:
            debug_log(f"會話 {self.session_id} 關閉 WebSocket 時發生未知錯誤: {e}")
