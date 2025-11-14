"""
統一資源管理器
==============

提供統一的資源管理功能，包括：
- 臨時文件和目錄管理
- 進程生命週期追蹤
- 自動資源清理
- 資源使用監控
"""

import atexit
import os
import shutil
import subprocess
import tempfile
import threading
import time
import weakref
from typing import Any

from ..debug import debug_log
from .error_handler import ErrorHandler, ErrorType


class ResourceType:
    """資源類型常量"""

    TEMP_FILE = "temp_file"
    TEMP_DIR = "temp_dir"
    PROCESS = "process"
    FILE_HANDLE = "file_handle"


class ResourceManager:
    """統一資源管理器 - 提供完整的資源生命週期管理"""

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        """單例模式實現"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """初始化資源管理器"""
        if hasattr(self, "_initialized"):
            return

        self._initialized = True

        # 資源追蹤集合
        self.temp_files: set[str] = set()
        self.temp_dirs: set[str] = set()
        self.processes: dict[int, dict[str, Any]] = {}
        self.file_handles: set[Any] = set()

        # 資源統計
        self.stats: dict[str, int | float] = {
            "temp_files_created": 0,
            "temp_dirs_created": 0,
            "processes_registered": 0,
            "cleanup_runs": 0,
            "last_cleanup": 0.0,  # 使用 0.0 而非 None，避免類型混淆
        }

        # 配置
        self.auto_cleanup_enabled = True
        self.cleanup_interval = 300  # 5分鐘
        self.temp_file_max_age = 3600  # 1小時

        # 清理線程
        self._cleanup_thread: threading.Thread | None = None
        self._stop_cleanup = threading.Event()

        # 註冊退出清理
        atexit.register(self.cleanup_all)

        # 啟動自動清理
        self._start_auto_cleanup()

        # 集成內存監控
        self._setup_memory_monitoring()

        debug_log("ResourceManager 初始化完成")

    def _setup_memory_monitoring(self):
        """設置內存監控集成"""
        try:
            # 延遲導入避免循環依賴
            from .memory_monitor import get_memory_monitor

            self.memory_monitor = get_memory_monitor()

            # 註冊清理回調
            self.memory_monitor.add_cleanup_callback(self._memory_triggered_cleanup)

            # 啟動內存監控
            if self.memory_monitor.start_monitoring():
                debug_log("內存監控已集成到資源管理器")
            else:
                debug_log("內存監控啟動失敗")

        except Exception as e:
            error_id = ErrorHandler.log_error_with_context(
                e, context={"operation": "設置內存監控"}, error_type=ErrorType.SYSTEM
            )
            debug_log(f"設置內存監控失敗 [錯誤ID: {error_id}]: {e}")

    def _memory_triggered_cleanup(self, force: bool = False):
        """內存監控觸發的清理操作"""
        debug_log(f"內存監控觸發清理操作 (force={force})")

        try:
            # 清理臨時文件
            cleaned_files = self.cleanup_temp_files()

            # 清理臨時目錄
            cleaned_dirs = self.cleanup_temp_dirs()

            # 清理文件句柄
            cleaned_handles = self.cleanup_file_handles()

            # 如果是強制清理，也清理進程
            cleaned_processes = 0
            if force:
                cleaned_processes = self.cleanup_processes(force=True)

            debug_log(
                f"內存觸發清理完成: 文件={cleaned_files}, 目錄={cleaned_dirs}, "
                f"句柄={cleaned_handles}, 進程={cleaned_processes}"
            )

            # 更新統計
            self.stats["cleanup_runs"] += 1
            self.stats["last_cleanup"] = time.time()

        except Exception as e:
            error_id = ErrorHandler.log_error_with_context(
                e,
                context={"operation": "內存觸發清理", "force": force},
                error_type=ErrorType.SYSTEM,
            )
            debug_log(f"內存觸發清理失敗 [錯誤ID: {error_id}]: {e}")

    def create_temp_file(
        self,
        suffix: str = "",
        prefix: str = "mcp_",
        dir: str | None = None,
        text: bool = True,
    ) -> str:
        """
        創建臨時文件並追蹤

        Args:
            suffix: 文件後綴
            prefix: 文件前綴
            dir: 臨時目錄，None 使用系統默認
            text: 是否為文本模式

        Returns:
            str: 臨時文件路徑
        """
        try:
            # 創建臨時文件
            fd, temp_path = tempfile.mkstemp(
                suffix=suffix, prefix=prefix, dir=dir, text=text
            )
            os.close(fd)  # 關閉文件描述符

            # 追蹤文件
            self.temp_files.add(temp_path)
            self.stats["temp_files_created"] += 1

            debug_log(f"創建臨時文件: {temp_path}")
            return temp_path

        except Exception as e:
            error_id = ErrorHandler.log_error_with_context(
                e,
                context={
                    "operation": "創建臨時文件",
                    "suffix": suffix,
                    "prefix": prefix,
                },
                error_type=ErrorType.FILE_IO,
            )
            debug_log(f"創建臨時文件失敗 [錯誤ID: {error_id}]: {e}")
            raise

    def create_temp_dir(
        self, suffix: str = "", prefix: str = "mcp_", dir: str | None = None
    ) -> str:
        """
        創建臨時目錄並追蹤

        Args:
            suffix: 目錄後綴
            prefix: 目錄前綴
            dir: 父目錄，None 使用系統默認

        Returns:
            str: 臨時目錄路徑
        """
        try:
            # 創建臨時目錄
            temp_dir = tempfile.mkdtemp(suffix=suffix, prefix=prefix, dir=dir)

            # 追蹤目錄
            self.temp_dirs.add(temp_dir)
            self.stats["temp_dirs_created"] += 1

            debug_log(f"創建臨時目錄: {temp_dir}")
            return temp_dir

        except Exception as e:
            error_id = ErrorHandler.log_error_with_context(
                e,
                context={
                    "operation": "創建臨時目錄",
                    "suffix": suffix,
                    "prefix": prefix,
                },
                error_type=ErrorType.FILE_IO,
            )
            debug_log(f"創建臨時目錄失敗 [錯誤ID: {error_id}]: {e}")
            raise

    def register_process(
        self,
        process: subprocess.Popen | int,
        description: str = "",
        auto_cleanup: bool = True,
    ) -> int:
        """
        註冊進程追蹤

        Args:
            process: 進程對象或 PID
            description: 進程描述
            auto_cleanup: 是否自動清理

        Returns:
            int: 進程 PID
        """
        try:
            if isinstance(process, subprocess.Popen):
                pid = process.pid
                process_obj = process
            else:
                pid = process
                process_obj = None

            # 註冊進程
            self.processes[pid] = {
                "process": process_obj,
                "description": description,
                "auto_cleanup": auto_cleanup,
                "registered_at": time.time(),
                "last_check": time.time(),
            }

            self.stats["processes_registered"] += 1

            debug_log(f"註冊進程追蹤: PID {pid} - {description}")
            return pid

        except Exception as e:
            error_id = ErrorHandler.log_error_with_context(
                e,
                context={"operation": "註冊進程", "description": description},
                error_type=ErrorType.PROCESS,
            )
            debug_log(f"註冊進程失敗 [錯誤ID: {error_id}]: {e}")
            raise

    def register_file_handle(self, file_handle: Any) -> None:
        """
        註冊文件句柄追蹤

        Args:
            file_handle: 文件句柄對象
        """
        try:
            # 使用弱引用避免循環引用
            self.file_handles.add(weakref.ref(file_handle))
            debug_log(f"註冊文件句柄: {type(file_handle).__name__}")

        except Exception as e:
            error_id = ErrorHandler.log_error_with_context(
                e, context={"operation": "註冊文件句柄"}, error_type=ErrorType.FILE_IO
            )
            debug_log(f"註冊文件句柄失敗 [錯誤ID: {error_id}]: {e}")

    def unregister_temp_file(self, file_path: str) -> bool:
        """
        取消臨時文件追蹤

        Args:
            file_path: 文件路徑

        Returns:
            bool: 是否成功取消追蹤
        """
        try:
            if file_path in self.temp_files:
                self.temp_files.remove(file_path)
                debug_log(f"取消臨時文件追蹤: {file_path}")
                return True
            return False

        except Exception as e:
            error_id = ErrorHandler.log_error_with_context(
                e,
                context={"operation": "取消文件追蹤", "file_path": file_path},
                error_type=ErrorType.FILE_IO,
            )
            debug_log(f"取消文件追蹤失敗 [錯誤ID: {error_id}]: {e}")
            return False

    def unregister_process(self, pid: int) -> bool:
        """
        取消進程追蹤

        Args:
            pid: 進程 PID

        Returns:
            bool: 是否成功取消追蹤
        """
        try:
            if pid in self.processes:
                del self.processes[pid]
                debug_log(f"取消進程追蹤: PID {pid}")
                return True
            return False

        except Exception as e:
            error_id = ErrorHandler.log_error_with_context(
                e,
                context={"operation": "取消進程追蹤", "pid": pid},
                error_type=ErrorType.PROCESS,
            )
            debug_log(f"取消進程追蹤失敗 [錯誤ID: {error_id}]: {e}")
            return False

    def cleanup_temp_files(self, max_age: int | None = None) -> int:
        """
        清理臨時文件

        Args:
            max_age: 最大文件年齡（秒），None 使用默認值

        Returns:
            int: 清理的文件數量
        """
        if max_age is None:
            max_age = self.temp_file_max_age

        cleaned_count = 0
        current_time = time.time()
        files_to_remove = set()

        for file_path in self.temp_files.copy():
            try:
                if not os.path.exists(file_path):
                    files_to_remove.add(file_path)
                    continue

                # 檢查文件年齡
                file_age = current_time - os.path.getmtime(file_path)
                if file_age > max_age:
                    os.remove(file_path)
                    files_to_remove.add(file_path)
                    cleaned_count += 1
                    debug_log(f"清理過期臨時文件: {file_path}")

            except Exception as e:
                error_id = ErrorHandler.log_error_with_context(
                    e,
                    context={"operation": "清理臨時文件", "file_path": file_path},
                    error_type=ErrorType.FILE_IO,
                )
                debug_log(f"清理臨時文件失敗 [錯誤ID: {error_id}]: {e}")
                files_to_remove.add(file_path)  # 移除無效追蹤

        # 移除已清理的文件追蹤
        self.temp_files -= files_to_remove

        return cleaned_count

    def cleanup_temp_dirs(self) -> int:
        """
        清理臨時目錄

        Returns:
            int: 清理的目錄數量
        """
        cleaned_count = 0
        dirs_to_remove = set()

        for dir_path in self.temp_dirs.copy():
            try:
                if not os.path.exists(dir_path):
                    dirs_to_remove.add(dir_path)
                    continue

                # 嘗試刪除目錄
                shutil.rmtree(dir_path)
                dirs_to_remove.add(dir_path)
                cleaned_count += 1
                debug_log(f"清理臨時目錄: {dir_path}")

            except Exception as e:
                error_id = ErrorHandler.log_error_with_context(
                    e,
                    context={"operation": "清理臨時目錄", "dir_path": dir_path},
                    error_type=ErrorType.FILE_IO,
                )
                debug_log(f"清理臨時目錄失敗 [錯誤ID: {error_id}]: {e}")
                dirs_to_remove.add(dir_path)  # 移除無效追蹤

        # 移除已清理的目錄追蹤
        self.temp_dirs -= dirs_to_remove

        return cleaned_count

    def cleanup_processes(self, force: bool = False) -> int:
        """
        清理進程

        Args:
            force: 是否強制終止進程

        Returns:
            int: 清理的進程數量
        """
        cleaned_count = 0
        processes_to_remove = []

        for pid, process_info in self.processes.copy().items():
            try:
                process_obj = process_info.get("process")
                auto_cleanup = process_info.get("auto_cleanup", True)

                if not auto_cleanup:
                    continue

                # 檢查進程是否還在運行
                if process_obj and hasattr(process_obj, "poll"):
                    if process_obj.poll() is None:  # 進程還在運行
                        if force:
                            debug_log(f"強制終止進程: PID {pid}")
                            process_obj.kill()
                        else:
                            debug_log(f"優雅終止進程: PID {pid}")
                            process_obj.terminate()

                        # 等待進程結束
                        try:
                            process_obj.wait(timeout=5)
                            cleaned_count += 1
                        except subprocess.TimeoutExpired:
                            if not force:
                                debug_log(f"進程 {pid} 優雅終止超時，強制終止")
                                process_obj.kill()
                                process_obj.wait(timeout=3)
                                cleaned_count += 1

                    processes_to_remove.append(pid)
                else:
                    # 使用 psutil 檢查進程
                    try:
                        import psutil

                        if psutil.pid_exists(pid):
                            proc = psutil.Process(pid)
                            if force:
                                proc.kill()
                            else:
                                proc.terminate()
                            proc.wait(timeout=5)
                            cleaned_count += 1
                        processes_to_remove.append(pid)
                    except ImportError:
                        debug_log("psutil 不可用，跳過進程檢查")
                        processes_to_remove.append(pid)
                    except Exception as e:
                        debug_log(f"清理進程 {pid} 失敗: {e}")
                        processes_to_remove.append(pid)

            except Exception as e:
                error_id = ErrorHandler.log_error_with_context(
                    e,
                    context={"operation": "清理進程", "pid": pid},
                    error_type=ErrorType.PROCESS,
                )
                debug_log(f"清理進程失敗 [錯誤ID: {error_id}]: {e}")
                processes_to_remove.append(pid)

        # 移除已清理的進程追蹤
        for pid in processes_to_remove:
            self.processes.pop(pid, None)

        return cleaned_count

    def cleanup_file_handles(self) -> int:
        """
        清理文件句柄

        Returns:
            int: 清理的句柄數量
        """
        cleaned_count = 0
        handles_to_remove = set()

        for handle_ref in self.file_handles.copy():
            try:
                handle = handle_ref()
                if handle is None:
                    # 弱引用已失效
                    handles_to_remove.add(handle_ref)
                    continue

                # 嘗試關閉文件句柄
                if hasattr(handle, "close") and not handle.closed:
                    handle.close()
                    cleaned_count += 1
                    debug_log(f"關閉文件句柄: {type(handle).__name__}")

                handles_to_remove.add(handle_ref)

            except Exception as e:
                error_id = ErrorHandler.log_error_with_context(
                    e,
                    context={"operation": "清理文件句柄"},
                    error_type=ErrorType.FILE_IO,
                )
                debug_log(f"清理文件句柄失敗 [錯誤ID: {error_id}]: {e}")
                handles_to_remove.add(handle_ref)

        # 移除已清理的句柄追蹤
        self.file_handles -= handles_to_remove

        return cleaned_count

    def cleanup_all(self, force: bool = False) -> dict[str, int]:
        """
        清理所有資源

        Args:
            force: 是否強制清理

        Returns:
            Dict[str, int]: 清理統計
        """
        debug_log("開始全面資源清理...")

        results = {"temp_files": 0, "temp_dirs": 0, "processes": 0, "file_handles": 0}

        try:
            # 清理文件句柄
            results["file_handles"] = self.cleanup_file_handles()

            # 清理進程
            results["processes"] = self.cleanup_processes(force=force)

            # 清理臨時文件
            results["temp_files"] = self.cleanup_temp_files(max_age=0)  # 清理所有文件

            # 清理臨時目錄
            results["temp_dirs"] = self.cleanup_temp_dirs()

            # 更新統計
            self.stats["cleanup_runs"] += 1
            self.stats["last_cleanup"] = time.time()

            total_cleaned = sum(results.values())
            debug_log(f"資源清理完成，共清理 {total_cleaned} 個資源: {results}")

        except Exception as e:
            error_id = ErrorHandler.log_error_with_context(
                e, context={"operation": "全面資源清理"}, error_type=ErrorType.SYSTEM
            )
            debug_log(f"全面資源清理失敗 [錯誤ID: {error_id}]: {e}")

        return results

    def _start_auto_cleanup(self) -> None:
        """啟動自動清理線程"""
        if not self.auto_cleanup_enabled or self._cleanup_thread:
            return

        def cleanup_worker():
            """清理工作線程"""
            while not self._stop_cleanup.wait(self.cleanup_interval):
                try:
                    # 執行定期清理
                    self.cleanup_temp_files()
                    self._check_process_health()

                except Exception as e:
                    error_id = ErrorHandler.log_error_with_context(
                        e,
                        context={"operation": "自動清理"},
                        error_type=ErrorType.SYSTEM,
                    )
                    debug_log(f"自動清理失敗 [錯誤ID: {error_id}]: {e}")

        self._cleanup_thread = threading.Thread(
            target=cleanup_worker, name="ResourceManager-AutoCleanup", daemon=True
        )
        self._cleanup_thread.start()
        debug_log("自動清理線程已啟動")

    def _check_process_health(self) -> None:
        """檢查進程健康狀態"""
        current_time = time.time()

        for pid, process_info in self.processes.items():
            try:
                process_obj = process_info.get("process")
                last_check = process_info.get("last_check", current_time)

                # 每分鐘檢查一次
                if current_time - last_check < 60:
                    continue

                # 更新檢查時間
                process_info["last_check"] = current_time

                # 檢查進程是否還在運行
                if process_obj and hasattr(process_obj, "poll"):
                    if process_obj.poll() is not None:
                        # 進程已結束，移除追蹤
                        debug_log(f"檢測到進程 {pid} 已結束，移除追蹤")
                        self.unregister_process(pid)

            except Exception as e:
                debug_log(f"檢查進程 {pid} 健康狀態失敗: {e}")

    def stop_auto_cleanup(self) -> None:
        """停止自動清理"""
        if self._cleanup_thread:
            self._stop_cleanup.set()
            self._cleanup_thread.join(timeout=5)
            self._cleanup_thread = None
            debug_log("自動清理線程已停止")

    def get_resource_stats(self) -> dict[str, Any]:
        """
        獲取資源統計信息

        Returns:
            Dict[str, Any]: 資源統計
        """
        current_stats = self.stats.copy()
        current_stats.update(
            {
                "current_temp_files": len(self.temp_files),
                "current_temp_dirs": len(self.temp_dirs),
                "current_processes": len(self.processes),
                "current_file_handles": len(self.file_handles),
                "auto_cleanup_enabled": self.auto_cleanup_enabled,
                "cleanup_interval": self.cleanup_interval,
                "temp_file_max_age": self.temp_file_max_age,
            }
        )

        # 添加內存監控統計
        try:
            if hasattr(self, "memory_monitor") and self.memory_monitor:
                memory_info = self.memory_monitor.get_current_memory_info()
                memory_stats = self.memory_monitor.get_memory_stats()

                current_stats.update(
                    {
                        "memory_monitoring_enabled": self.memory_monitor.is_monitoring,
                        "current_memory_usage": memory_info.get("system", {}).get(
                            "usage_percent", 0
                        ),
                        "memory_status": memory_info.get("status", "unknown"),
                        "memory_cleanup_triggers": memory_stats.cleanup_triggers,
                        "memory_alerts_count": memory_stats.alerts_count,
                    }
                )
        except Exception as e:
            debug_log(f"獲取內存統計失敗: {e}")

        return current_stats

    def get_detailed_info(self) -> dict[str, Any]:
        """
        獲取詳細資源信息

        Returns:
            Dict[str, Any]: 詳細資源信息
        """
        return {
            "temp_files": list(self.temp_files),
            "temp_dirs": list(self.temp_dirs),
            "processes": {
                pid: {
                    "description": info.get("description", ""),
                    "auto_cleanup": info.get("auto_cleanup", True),
                    "registered_at": info.get("registered_at", 0),
                    "last_check": info.get("last_check", 0),
                }
                for pid, info in self.processes.items()
            },
            "file_handles_count": len(self.file_handles),
            "stats": self.get_resource_stats(),
        }

    def configure(
        self,
        auto_cleanup_enabled: bool | None = None,
        cleanup_interval: int | None = None,
        temp_file_max_age: int | None = None,
    ) -> None:
        """
        配置資源管理器

        Args:
            auto_cleanup_enabled: 是否啟用自動清理
            cleanup_interval: 清理間隔（秒）
            temp_file_max_age: 臨時文件最大年齡（秒）
        """
        if auto_cleanup_enabled is not None:
            old_enabled = self.auto_cleanup_enabled
            self.auto_cleanup_enabled = auto_cleanup_enabled

            if old_enabled and not auto_cleanup_enabled:
                self.stop_auto_cleanup()
            elif not old_enabled and auto_cleanup_enabled:
                self._start_auto_cleanup()
            elif auto_cleanup_enabled and self._cleanup_thread is None:
                # 如果啟用了自動清理但線程不存在，重新啟動
                self._start_auto_cleanup()

        if cleanup_interval is not None:
            self.cleanup_interval = max(60, cleanup_interval)  # 最小1分鐘

        if temp_file_max_age is not None:
            self.temp_file_max_age = max(300, temp_file_max_age)  # 最小5分鐘

        debug_log(
            f"ResourceManager 配置已更新: auto_cleanup={self.auto_cleanup_enabled}, "
            f"interval={self.cleanup_interval}, max_age={self.temp_file_max_age}"
        )


# 全局資源管理器實例
_resource_manager = None


def get_resource_manager() -> ResourceManager:
    """
    獲取全局資源管理器實例

    Returns:
        ResourceManager: 資源管理器實例
    """
    global _resource_manager
    if _resource_manager is None:
        _resource_manager = ResourceManager()
    return _resource_manager


# 便捷函數
def create_temp_file(suffix: str = "", prefix: str = "mcp_", **kwargs) -> str:
    """創建臨時文件的便捷函數"""
    return get_resource_manager().create_temp_file(
        suffix=suffix, prefix=prefix, **kwargs
    )


def create_temp_dir(suffix: str = "", prefix: str = "mcp_", **kwargs) -> str:
    """創建臨時目錄的便捷函數"""
    return get_resource_manager().create_temp_dir(
        suffix=suffix, prefix=prefix, **kwargs
    )


def register_process(
    process: subprocess.Popen | int, description: str = "", **kwargs
) -> int:
    """註冊進程的便捷函數"""
    return get_resource_manager().register_process(
        process, description=description, **kwargs
    )


def cleanup_all_resources(force: bool = False) -> dict[str, int]:
    """清理所有資源的便捷函數"""
    return get_resource_manager().cleanup_all(force=force)
