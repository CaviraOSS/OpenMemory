"""
統一錯誤處理框架
================

提供統一的錯誤處理機制，包括：
- 錯誤類型分類
- 用戶友好錯誤信息
- 錯誤上下文記錄
- 解決方案建議
- 國際化支持

注意：此模組不會影響 JSON RPC 通信，所有錯誤處理都在應用層進行。
"""

import os
import time
import traceback
from enum import Enum
from typing import Any

from ..debug import debug_log


class ErrorType(Enum):
    """錯誤類型枚舉"""

    NETWORK = "network"  # 網絡相關錯誤
    FILE_IO = "file_io"  # 文件 I/O 錯誤
    PROCESS = "process"  # 進程相關錯誤
    TIMEOUT = "timeout"  # 超時錯誤
    USER_CANCEL = "user_cancel"  # 用戶取消操作
    SYSTEM = "system"  # 系統錯誤
    PERMISSION = "permission"  # 權限錯誤
    VALIDATION = "validation"  # 數據驗證錯誤
    DEPENDENCY = "dependency"  # 依賴錯誤
    CONFIGURATION = "config"  # 配置錯誤


class ErrorSeverity(Enum):
    """錯誤嚴重程度"""

    LOW = "low"  # 低：不影響核心功能
    MEDIUM = "medium"  # 中：影響部分功能
    HIGH = "high"  # 高：影響核心功能
    CRITICAL = "critical"  # 嚴重：系統無法正常運行


class ErrorHandler:
    """統一錯誤處理器"""

    # 錯誤類型到用戶友好信息的映射
    _ERROR_MESSAGES = {
        ErrorType.NETWORK: {
            "zh-TW": "網絡連接出現問題",
            "zh-CN": "网络连接出现问题",
            "en": "Network connection issue",
        },
        ErrorType.FILE_IO: {
            "zh-TW": "文件讀寫出現問題",
            "zh-CN": "文件读写出现问题",
            "en": "File read/write issue",
        },
        ErrorType.PROCESS: {
            "zh-TW": "進程執行出現問題",
            "zh-CN": "进程执行出现问题",
            "en": "Process execution issue",
        },
        ErrorType.TIMEOUT: {
            "zh-TW": "操作超時",
            "zh-CN": "操作超时",
            "en": "Operation timeout",
        },
        ErrorType.USER_CANCEL: {
            "zh-TW": "用戶取消了操作",
            "zh-CN": "用户取消了操作",
            "en": "User cancelled the operation",
        },
        ErrorType.SYSTEM: {
            "zh-TW": "系統出現問題",
            "zh-CN": "系统出现问题",
            "en": "System issue",
        },
        ErrorType.PERMISSION: {
            "zh-TW": "權限不足",
            "zh-CN": "权限不足",
            "en": "Insufficient permissions",
        },
        ErrorType.VALIDATION: {
            "zh-TW": "數據驗證失敗",
            "zh-CN": "数据验证失败",
            "en": "Data validation failed",
        },
        ErrorType.DEPENDENCY: {
            "zh-TW": "依賴組件出現問題",
            "zh-CN": "依赖组件出现问题",
            "en": "Dependency issue",
        },
        ErrorType.CONFIGURATION: {
            "zh-TW": "配置出現問題",
            "zh-CN": "配置出现问题",
            "en": "Configuration issue",
        },
    }

    # 錯誤解決建議
    _ERROR_SOLUTIONS = {
        ErrorType.NETWORK: {
            "zh-TW": ["檢查網絡連接是否正常", "確認防火牆設置", "嘗試重新啟動應用程序"],
            "zh-CN": ["检查网络连接是否正常", "确认防火墙设置", "尝试重新启动应用程序"],
            "en": [
                "Check network connection",
                "Verify firewall settings",
                "Try restarting the application",
            ],
        },
        ErrorType.FILE_IO: {
            "zh-TW": ["檢查文件是否存在", "確認文件權限", "檢查磁盤空間是否足夠"],
            "zh-CN": ["检查文件是否存在", "确认文件权限", "检查磁盘空间是否足够"],
            "en": [
                "Check if file exists",
                "Verify file permissions",
                "Check available disk space",
            ],
        },
        ErrorType.PROCESS: {
            "zh-TW": [
                "檢查進程是否正在運行",
                "確認系統資源是否足夠",
                "嘗試重新啟動相關服務",
            ],
            "zh-CN": [
                "检查进程是否正在运行",
                "确认系统资源是否足够",
                "尝试重新启动相关服务",
            ],
            "en": [
                "Check if process is running",
                "Verify system resources",
                "Try restarting related services",
            ],
        },
        ErrorType.TIMEOUT: {
            "zh-TW": ["增加超時時間設置", "檢查網絡延遲", "稍後重試操作"],
            "zh-CN": ["增加超时时间设置", "检查网络延迟", "稍后重试操作"],
            "en": [
                "Increase timeout settings",
                "Check network latency",
                "Retry the operation later",
            ],
        },
        ErrorType.PERMISSION: {
            "zh-TW": ["以管理員身份運行", "檢查文件/目錄權限", "聯繫系統管理員"],
            "zh-CN": ["以管理员身份运行", "检查文件/目录权限", "联系系统管理员"],
            "en": [
                "Run as administrator",
                "Check file/directory permissions",
                "Contact system administrator",
            ],
        },
    }

    @staticmethod
    def get_current_language() -> str:
        """獲取當前語言設置"""
        try:
            # 嘗試從 i18n 模組獲取當前語言
            from ..i18n import get_i18n_manager

            return get_i18n_manager().get_current_language()
        except Exception:
            # 回退到環境變數或默認語言
            return os.getenv("MCP_LANGUAGE", "zh-TW")

    @staticmethod
    def get_i18n_error_message(error_type: ErrorType) -> str:
        """從國際化系統獲取錯誤信息"""
        try:
            from ..i18n import get_i18n_manager

            i18n = get_i18n_manager()
            key = f"errors.types.{error_type.value}"
            message = i18n.t(key)
            # 如果返回的是鍵本身，說明沒有找到翻譯，使用回退
            if message == key:
                raise Exception("Translation not found")
            return message
        except Exception:
            # 回退到內建映射
            language = ErrorHandler.get_current_language()
            error_messages = ErrorHandler._ERROR_MESSAGES.get(error_type, {})
            return error_messages.get(
                language, error_messages.get("zh-TW", "發生未知錯誤")
            )

    @staticmethod
    def get_i18n_error_solutions(error_type: ErrorType) -> list[str]:
        """從國際化系統獲取錯誤解決方案"""
        try:
            from ..i18n import get_i18n_manager

            i18n = get_i18n_manager()
            key = f"errors.solutions.{error_type.value}"
            i18n_result = i18n.t(key)

            # 修復類型推斷問題 - 使用 Any 類型並明確檢查
            from typing import Any

            result: Any = i18n_result

            # 檢查是否為列表類型且非空
            if isinstance(result, list) and len(result) > 0:
                return result

            # 如果不是列表或為空，使用回退
            raise Exception("Solutions not found or invalid format")
        except Exception:
            # 回退到內建映射
            language = ErrorHandler.get_current_language()
            solutions_dict = ErrorHandler._ERROR_SOLUTIONS.get(error_type, {})
            return solutions_dict.get(language, solutions_dict.get("zh-TW", []))

    @staticmethod
    def classify_error(error: Exception) -> ErrorType:
        """
        根據異常類型自動分類錯誤

        Args:
            error: Python 異常對象

        Returns:
            ErrorType: 錯誤類型
        """
        error_name = type(error).__name__
        error_message = str(error).lower()

        # 超時錯誤（優先檢查，避免被網絡錯誤覆蓋）
        if "timeout" in error_name.lower() or "timeout" in error_message:
            return ErrorType.TIMEOUT

        # 權限錯誤（優先檢查，避免被文件錯誤覆蓋）
        if "permission" in error_name.lower():
            return ErrorType.PERMISSION
        if any(
            keyword in error_message
            for keyword in ["permission denied", "access denied", "forbidden"]
        ):
            return ErrorType.PERMISSION

        # 網絡相關錯誤
        if any(
            keyword in error_name.lower()
            for keyword in ["connection", "network", "socket"]
        ):
            return ErrorType.NETWORK
        if any(
            keyword in error_message for keyword in ["connection", "network", "socket"]
        ):
            return ErrorType.NETWORK

        # 文件 I/O 錯誤
        if any(
            keyword in error_name.lower() for keyword in ["file", "ioerror"]
        ):  # 使用更精確的匹配
            return ErrorType.FILE_IO
        if any(
            keyword in error_message
            for keyword in ["file", "directory", "no such file"]
        ):
            return ErrorType.FILE_IO

        # 進程相關錯誤
        if any(keyword in error_name.lower() for keyword in ["process", "subprocess"]):
            return ErrorType.PROCESS
        if any(
            keyword in error_message for keyword in ["process", "command", "executable"]
        ):
            return ErrorType.PROCESS

        # 驗證錯誤
        if any(
            keyword in error_name.lower() for keyword in ["validation", "value", "type"]
        ):
            return ErrorType.VALIDATION

        # 配置錯誤
        if any(
            keyword in error_message for keyword in ["config", "setting", "environment"]
        ):
            return ErrorType.CONFIGURATION

        # 默認為系統錯誤
        return ErrorType.SYSTEM

    @staticmethod
    def format_user_error(
        error: Exception,
        error_type: ErrorType | None = None,
        context: dict[str, Any] | None = None,
        include_technical: bool = False,
    ) -> str:
        """
        將技術錯誤轉換為用戶友好的錯誤信息

        Args:
            error: Python 異常對象
            error_type: 錯誤類型（可選，會自動分類）
            context: 錯誤上下文信息
            include_technical: 是否包含技術細節

        Returns:
            str: 用戶友好的錯誤信息
        """
        # 自動分類錯誤類型
        if error_type is None:
            error_type = ErrorHandler.classify_error(error)

        # 獲取當前語言
        language = ErrorHandler.get_current_language()

        # 獲取用戶友好的錯誤信息（優先使用國際化系統）
        user_message = ErrorHandler.get_i18n_error_message(error_type)

        # 構建完整的錯誤信息
        parts = [f"❌ {user_message}"]

        # 添加上下文信息
        if context:
            if context.get("operation"):
                if language == "en":
                    parts.append(f"Operation: {context['operation']}")
                else:
                    parts.append(f"操作：{context['operation']}")

            if context.get("file_path"):
                if language == "en":
                    parts.append(f"File: {context['file_path']}")
                else:
                    parts.append(f"文件：{context['file_path']}")

        # 添加技術細節（如果需要）
        if include_technical:
            if language == "en":
                parts.append(f"Technical details: {type(error).__name__}: {error!s}")
            else:
                parts.append(f"技術細節：{type(error).__name__}: {error!s}")

        return "\n".join(parts)

    @staticmethod
    def get_error_solutions(error_type: ErrorType) -> list[str]:
        """
        獲取錯誤解決建議

        Args:
            error_type: 錯誤類型

        Returns:
            List[str]: 解決建議列表
        """
        return ErrorHandler.get_i18n_error_solutions(error_type)

    @staticmethod
    def log_error_with_context(
        error: Exception,
        context: dict[str, Any] | None = None,
        error_type: ErrorType | None = None,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    ) -> str:
        """
        記錄帶上下文的錯誤信息（不影響 JSON RPC）

        Args:
            error: Python 異常對象
            context: 錯誤上下文信息
            error_type: 錯誤類型
            severity: 錯誤嚴重程度

        Returns:
            str: 錯誤 ID，用於追蹤
        """
        # 生成錯誤 ID
        error_id = f"ERR_{int(time.time())}_{id(error) % 10000}"

        # 自動分類錯誤
        if error_type is None:
            error_type = ErrorHandler.classify_error(error)

        # 錯誤記錄已通過 debug_log 輸出，無需額外存儲

        # 記錄到調試日誌（不影響 JSON RPC）
        debug_log(f"錯誤記錄 [{error_id}]: {error_type.value} - {error!s}")

        if context:
            debug_log(f"錯誤上下文 [{error_id}]: {context}")

        # 對於嚴重錯誤，記錄完整堆棧跟蹤
        if severity in [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL]:
            debug_log(f"錯誤堆棧 [{error_id}]:\n{traceback.format_exc()}")

        return error_id

    @staticmethod
    def create_error_response(
        error: Exception,
        context: dict[str, Any] | None = None,
        error_type: ErrorType | None = None,
        include_solutions: bool = True,
        for_user: bool = True,
    ) -> dict[str, Any]:
        """
        創建標準化的錯誤響應

        Args:
            error: Python 異常對象
            context: 錯誤上下文
            error_type: 錯誤類型
            include_solutions: 是否包含解決建議
            for_user: 是否為用戶界面使用

        Returns:
            Dict[str, Any]: 標準化錯誤響應
        """
        # 自動分類錯誤
        if error_type is None:
            error_type = ErrorHandler.classify_error(error)

        # 記錄錯誤
        error_id = ErrorHandler.log_error_with_context(error, context, error_type)

        # 構建響應
        response = {
            "success": False,
            "error_id": error_id,
            "error_type": error_type.value,
            "message": ErrorHandler.format_user_error(
                error, error_type, context, include_technical=not for_user
            ),
        }

        # 添加解決建議
        if include_solutions:
            solutions = ErrorHandler.get_error_solutions(error_type)
            response["solutions"] = solutions  # 即使為空列表也添加

        # 添加上下文（僅用於調試）
        if context and not for_user:
            response["context"] = context

        return response
