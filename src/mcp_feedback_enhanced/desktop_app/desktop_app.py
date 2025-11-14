#!/usr/bin/env python3
"""
桌面應用程式主要模組

此模組提供桌面應用程式的核心功能，包括：
- 桌面模式檢測
- Tauri 應用程式啟動
- 與現有 Web UI 的整合
"""

import asyncio
import os
import sys
import time


# 導入現有的 MCP Feedback Enhanced 模組
try:
    from mcp_feedback_enhanced.debug import server_debug_log as debug_log
    from mcp_feedback_enhanced.web.main import WebUIManager, get_web_ui_manager
except ImportError as e:
    # 在這裡無法使用 debug_log，因為導入失敗
    sys.stderr.write(f"無法導入 MCP Feedback Enhanced 模組: {e}\n")
    sys.exit(1)


class DesktopApp:
    """桌面應用程式管理器"""

    def __init__(self):
        self.web_manager: WebUIManager | None = None
        self.desktop_mode = False
        self.app_handle = None

    def set_desktop_mode(self, enabled: bool = True):
        """設置桌面模式"""
        self.desktop_mode = enabled
        if enabled:
            # 設置環境變數，防止開啟瀏覽器
            os.environ["MCP_DESKTOP_MODE"] = "true"
            debug_log("桌面模式已啟用，將禁止開啟瀏覽器")
        else:
            os.environ.pop("MCP_DESKTOP_MODE", None)
            debug_log("桌面模式已禁用")

    def is_desktop_mode(self) -> bool:
        """檢查是否為桌面模式"""
        return (
            self.desktop_mode
            or os.environ.get("MCP_DESKTOP_MODE", "").lower() == "true"
        )

    async def start_web_backend(self) -> str:
        """啟動 Web 後端服務"""
        debug_log("啟動 Web 後端服務...")

        # 獲取 Web UI 管理器
        self.web_manager = get_web_ui_manager()

        # 設置桌面模式，禁止自動開啟瀏覽器
        self.set_desktop_mode(True)

        # 啟動服務器
        if (
            self.web_manager.server_thread is None
            or not self.web_manager.server_thread.is_alive()
        ):
            self.web_manager.start_server()

        # 等待服務器啟動
        max_wait = 10.0  # 最多等待 10 秒
        wait_count = 0.0
        while wait_count < max_wait:
            if (
                self.web_manager.server_thread
                and self.web_manager.server_thread.is_alive()
            ):
                break
            await asyncio.sleep(0.5)
            wait_count += 0.5

        if not (
            self.web_manager.server_thread and self.web_manager.server_thread.is_alive()
        ):
            raise RuntimeError("Web 服務器啟動失敗")

        server_url = self.web_manager.get_server_url()
        debug_log(f"Web 後端服務已啟動: {server_url}")
        return server_url

    def create_test_session(self):
        """創建測試會話"""
        if not self.web_manager:
            raise RuntimeError("Web 管理器未初始化")

        import tempfile

        with tempfile.TemporaryDirectory() as temp_dir:
            session_id = self.web_manager.create_session(
                temp_dir, "桌面應用程式測試 - 驗證 Tauri 整合功能"
            )
            debug_log(f"測試會話已創建: {session_id}")
            return session_id

    async def launch_tauri_app(self, server_url: str):
        """啟動 Tauri 桌面應用程式"""
        debug_log("正在啟動 Tauri 桌面視窗...")

        import os
        import subprocess
        from pathlib import Path

        # 找到 Tauri 可執行檔案
        # 首先嘗試從打包後的位置找（PyPI 安裝後的位置）
        try:
            from mcp_feedback_enhanced.desktop_release import __file__ as desktop_init

            desktop_dir = Path(desktop_init).parent

            # 根據平台選擇對應的二進制文件
            import platform

            system = platform.system().lower()
            machine = platform.machine().lower()

            # 定義平台到二進制文件的映射
            if system == "windows":
                tauri_exe = desktop_dir / "mcp-feedback-enhanced-desktop.exe"
            elif system == "darwin":  # macOS
                # 檢測 Apple Silicon 或 Intel
                if machine in ["arm64", "aarch64"]:
                    tauri_exe = (
                        desktop_dir / "mcp-feedback-enhanced-desktop-macos-arm64"
                    )
                else:
                    tauri_exe = (
                        desktop_dir / "mcp-feedback-enhanced-desktop-macos-intel"
                    )
            elif system == "linux":
                tauri_exe = desktop_dir / "mcp-feedback-enhanced-desktop-linux"
            else:
                # 回退到通用名稱
                tauri_exe = desktop_dir / "mcp-feedback-enhanced-desktop"

            if tauri_exe.exists():
                debug_log(f"找到打包後的 Tauri 可執行檔案: {tauri_exe}")
            else:
                # 嘗試回退選項
                fallback_files = [
                    desktop_dir / "mcp-feedback-enhanced-desktop.exe",
                    desktop_dir / "mcp-feedback-enhanced-desktop-macos-intel",
                    desktop_dir / "mcp-feedback-enhanced-desktop-macos-arm64",
                    desktop_dir / "mcp-feedback-enhanced-desktop-linux",
                    desktop_dir / "mcp-feedback-enhanced-desktop",
                ]

                for fallback in fallback_files:
                    if fallback.exists():
                        tauri_exe = fallback
                        debug_log(f"使用回退的可執行檔案: {tauri_exe}")
                        break
                else:
                    raise FileNotFoundError(
                        f"找不到任何可執行檔案，檢查的路徑: {tauri_exe}"
                    )

        except (ImportError, FileNotFoundError):
            # 回退到開發環境路徑
            debug_log("未找到打包後的可執行檔案，嘗試開發環境路徑...")
            project_root = Path(__file__).parent.parent.parent.parent
            tauri_exe = (
                project_root
                / "src-tauri"
                / "target"
                / "debug"
                / "mcp-feedback-enhanced-desktop.exe"
            )

            if not tauri_exe.exists():
                # 嘗試其他可能的路徑
                tauri_exe = (
                    project_root
                    / "src-tauri"
                    / "target"
                    / "debug"
                    / "mcp-feedback-enhanced-desktop"
                )

            if not tauri_exe.exists():
                # 嘗試 release 版本
                tauri_exe = (
                    project_root
                    / "src-tauri"
                    / "target"
                    / "release"
                    / "mcp-feedback-enhanced-desktop.exe"
                )
                if not tauri_exe.exists():
                    tauri_exe = (
                        project_root
                        / "src-tauri"
                        / "target"
                        / "release"
                        / "mcp-feedback-enhanced-desktop"
                    )

            if not tauri_exe.exists():
                raise FileNotFoundError(
                    "找不到 Tauri 可執行檔案，已嘗試的路徑包括開發和發布目錄"
                ) from None

        debug_log(f"找到 Tauri 可執行檔案: {tauri_exe}")

        # 設置環境變數
        env = os.environ.copy()
        env["MCP_DESKTOP_MODE"] = "true"
        env["MCP_WEB_URL"] = server_url

        # 啟動 Tauri 應用程式
        try:
            # Windows 下隱藏控制台視窗
            creation_flags = 0
            if os.name == "nt":
                # CREATE_NO_WINDOW 只在 Windows 上存在
                creation_flags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)

            self.app_handle = subprocess.Popen(
                [str(tauri_exe)],
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=creation_flags,
            )
            debug_log("Tauri 桌面應用程式已啟動")

            # 等待一下確保應用程式啟動
            await asyncio.sleep(2)

        except Exception as e:
            debug_log(f"啟動 Tauri 應用程式失敗: {e}")
            raise

    def stop(self):
        """停止桌面應用程式"""
        debug_log("正在停止桌面應用程式...")

        # 停止 Tauri 應用程式
        if self.app_handle:
            try:
                self.app_handle.terminate()
                self.app_handle.wait(timeout=5)
                debug_log("Tauri 應用程式已停止")
            except Exception as e:
                debug_log(f"停止 Tauri 應用程式時發生錯誤: {e}")
                try:
                    self.app_handle.kill()
                except:
                    pass
            finally:
                self.app_handle = None

        if self.web_manager:
            # 注意：不停止 Web 服務器，保持持久性
            debug_log("Web 服務器保持運行狀態")

        # 注意：不清除桌面模式設置，保持 MCP_DESKTOP_MODE 環境變數
        # 這樣下次 MCP 調用時仍然會啟動桌面應用程式
        # self.set_desktop_mode(False)  # 註釋掉這行
        debug_log("桌面應用程式已停止")


async def launch_desktop_app(test_mode: bool = False) -> DesktopApp:
    """啟動桌面應用程式

    Args:
        test_mode: 是否為測試模式，測試模式下會創建測試會話
    """
    debug_log("正在啟動桌面應用程式...")

    app = DesktopApp()

    try:
        # 啟動 Web 後端
        server_url = await app.start_web_backend()

        if test_mode:
            # 測試模式：創建測試會話
            debug_log("測試模式：創建測試會話")
            app.create_test_session()
        else:
            # MCP 調用模式：使用現有會話
            debug_log("MCP 調用模式：使用現有 MCP 會話，不創建新的測試會話")

        # 啟動 Tauri 桌面應用程式
        await app.launch_tauri_app(server_url)

        debug_log(f"桌面應用程式已啟動，後端服務: {server_url}")
        return app

    except Exception as e:
        debug_log(f"桌面應用程式啟動失敗: {e}")
        app.stop()
        raise


def run_desktop_app():
    """同步方式運行桌面應用程式"""
    try:
        # 設置事件循環策略（Windows）
        if sys.platform == "win32":
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

        # 運行應用程式
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        app = loop.run_until_complete(launch_desktop_app())

        # 保持應用程式運行
        debug_log("桌面應用程式正在運行，按 Ctrl+C 停止...")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            debug_log("收到停止信號...")
        finally:
            app.stop()
            loop.close()

    except Exception as e:
        sys.stderr.write(f"桌面應用程式運行失敗: {e}\n")
        sys.exit(1)


if __name__ == "__main__":
    run_desktop_app()
