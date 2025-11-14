"""
統一的訊息代碼定義

這個模組定義了所有後端使用的訊息代碼常量。
前端會根據這些代碼顯示對應的本地化訊息。

使用方式：
    from ..constants import MessageCodes, get_message_code

    # 使用常量
    code = MessageCodes.SESSION_FEEDBACK_SUBMITTED

    # 或使用輔助函數
    code = get_message_code("SESSION_FEEDBACK_SUBMITTED")
"""


class MessageCodes:
    """訊息代碼常量類"""

    # ========== 系統相關 ==========
    SYSTEM_CONNECTION_ESTABLISHED = "system.connectionEstablished"
    SYSTEM_CONNECTION_LOST = "system.connectionLost"
    SYSTEM_CONNECTION_RECONNECTING = "system.connectionReconnecting"
    SYSTEM_CONNECTION_RECONNECTED = "system.connectionReconnected"
    SYSTEM_CONNECTION_FAILED = "system.connectionFailed"
    SYSTEM_WEBSOCKET_ERROR = "system.websocketError"
    SYSTEM_WEBSOCKET_READY = "system.websocketReady"
    SYSTEM_MEMORY_PRESSURE = "system.memoryPressure"
    SYSTEM_SHUTDOWN = "system.shutdown"
    SYSTEM_PROCESS_KILLED = "system.processKilled"
    SYSTEM_HEARTBEAT_STOPPED = "system.heartbeatStopped"

    # ========== 會話相關 ==========
    SESSION_NO_ACTIVE = "session.noActiveSession"
    SESSION_CREATED = "session.created"
    SESSION_UPDATED = "session.updated"
    SESSION_EXPIRED = "session.expired"
    SESSION_TIMEOUT = "session.timeout"
    SESSION_CLEANED = "session.cleaned"
    SESSION_FEEDBACK_SUBMITTED = "session.feedbackSubmitted"
    SESSION_USER_MESSAGE_RECORDED = "session.userMessageRecorded"
    SESSION_HISTORY_SAVED = "session.historySaved"
    SESSION_HISTORY_LOADED = "session.historyLoaded"
    SESSION_MANUAL_CLEANUP = "session.manualCleanup"
    SESSION_ERROR_CLEANUP = "session.errorCleanup"

    # ========== 設定相關 ==========
    SETTINGS_SAVED = "settingsAPI.saved"
    SETTINGS_LOADED = "settingsAPI.loaded"
    SETTINGS_CLEARED = "settingsAPI.cleared"
    SETTINGS_SAVE_FAILED = "settingsAPI.saveFailed"
    SETTINGS_LOAD_FAILED = "settingsAPI.loadFailed"
    SETTINGS_CLEAR_FAILED = "settingsAPI.clearFailed"
    SETTINGS_SET_FAILED = "settingsAPI.setFailed"
    SETTINGS_INVALID_VALUE = "settingsAPI.invalidValue"
    SETTINGS_LOG_LEVEL_UPDATED = "settingsAPI.logLevelUpdated"
    SETTINGS_INVALID_LOG_LEVEL = "settingsAPI.invalidLogLevel"

    # ========== 命令執行相關 ==========
    COMMAND_EXECUTING = "commandStatus.executing"
    COMMAND_COMPLETED = "commandStatus.completed"
    COMMAND_FAILED = "commandStatus.failed"
    COMMAND_INVALID = "commandStatus.invalid"
    COMMAND_OUTPUT_RECEIVED = "commandStatus.outputReceived"
    COMMAND_ERROR = "commandStatus.error"

    # ========== 錯誤相關 ==========
    ERROR_GENERIC = "error.generic"
    ERROR_NETWORK = "error.network"
    ERROR_SERVER = "error.server"
    ERROR_TIMEOUT = "error.timeout"
    ERROR_INVALID_INPUT = "error.invalidInput"
    ERROR_OPERATION_FAILED = "error.operationFailed"
    ERROR_USER_MESSAGE_FAILED = "error.userMessageFailed"
    ERROR_GET_SESSIONS_FAILED = "error.getSessionsFailed"
    ERROR_GET_LOG_LEVEL_FAILED = "error.getLogLevelFailed"
    ERROR_RESOURCE_CLEANUP = "error.resourceCleanup"
    ERROR_PROCESSING = "error.processing"

    # ========== 檔案相關 ==========
    FILE_UPLOAD_SUCCESS = "file.uploadSuccess"
    FILE_UPLOAD_FAILED = "file.uploadFailed"
    FILE_SIZE_TOO_LARGE = "file.sizeTooLarge"
    FILE_TYPE_NOT_SUPPORTED = "file.typeNotSupported"
    FILE_PROCESSING = "file.processing"
    FILE_REMOVED = "file.removed"

    # ========== 提示詞相關 ==========
    PROMPT_SAVED = "prompt.saved"
    PROMPT_DELETED = "prompt.deleted"
    PROMPT_APPLIED = "prompt.applied"
    PROMPT_IMPORT_SUCCESS = "prompt.importSuccess"
    PROMPT_IMPORT_FAILED = "prompt.importFailed"
    PROMPT_EXPORT_SUCCESS = "prompt.exportSuccess"
    PROMPT_VALIDATION_FAILED = "prompt.validationFailed"


# 向後兼容的映射表（從舊的 key 到新的常量名稱）
LEGACY_KEY_MAPPING = {
    # feedback_session.py 的舊 key
    "FEEDBACK_SUBMITTED": "SESSION_FEEDBACK_SUBMITTED",
    "SESSION_CLEANUP": "SESSION_CLEANED",
    "TIMEOUT_CLEANUP": "SESSION_TIMEOUT",
    "EXPIRED_CLEANUP": "SESSION_EXPIRED",
    "MEMORY_PRESSURE_CLEANUP": "SYSTEM_MEMORY_PRESSURE",
    "MANUAL_CLEANUP": "SESSION_MANUAL_CLEANUP",
    "ERROR_CLEANUP": "SESSION_ERROR_CLEANUP",
    "SHUTDOWN_CLEANUP": "SYSTEM_SHUTDOWN",
    "COMMAND_EXECUTING": "COMMAND_EXECUTING",
    "COMMAND_COMPLETED": "COMMAND_COMPLETED",
    "COMMAND_FAILED": "COMMAND_FAILED",
    "COMMAND_INVALID": "COMMAND_INVALID",
    "COMMAND_ERROR": "COMMAND_ERROR",
    "PROCESS_KILLED": "SYSTEM_PROCESS_KILLED",
    "RESOURCE_CLEANUP_ERROR": "ERROR_RESOURCE_CLEANUP",
    "HEARTBEAT_STOPPED": "SYSTEM_HEARTBEAT_STOPPED",
    "PROCESSING_ERROR": "ERROR_PROCESSING",
    "WEBSOCKET_READY": "SYSTEM_WEBSOCKET_READY",
    # main_routes.py 的舊 key
    "no_active_session": "SESSION_NO_ACTIVE",
    "websocket_connected": "SYSTEM_CONNECTION_ESTABLISHED",
    "new_session_created": "SESSION_CREATED",
    "user_message_recorded": "SESSION_USER_MESSAGE_RECORDED",
    "add_user_message_failed": "ERROR_USER_MESSAGE_FAILED",
    "settings_saved": "SETTINGS_SAVED",
    "save_failed": "SETTINGS_SAVE_FAILED",
    "load_failed": "SETTINGS_LOAD_FAILED",
    "settings_cleared": "SETTINGS_CLEARED",
    "clear_failed": "SETTINGS_CLEAR_FAILED",
    "session_history_saved": "SESSION_HISTORY_SAVED",
    "get_sessions_failed": "ERROR_GET_SESSIONS_FAILED",
    "get_log_level_failed": "ERROR_GET_LOG_LEVEL_FAILED",
    "invalid_log_level": "SETTINGS_INVALID_LOG_LEVEL",
    "log_level_updated": "SETTINGS_LOG_LEVEL_UPDATED",
    "set_failed": "SETTINGS_SET_FAILED",
}


def get_message_code(key: str) -> str:
    """
    獲取訊息代碼

    支援三種輸入方式：
    1. 直接使用常量名稱：get_message_code("SESSION_FEEDBACK_SUBMITTED")
    2. 使用舊的 key（向後兼容）：get_message_code("FEEDBACK_SUBMITTED")
    3. 使用小寫的舊 key（向後兼容）：get_message_code("feedback_submitted")

    Args:
        key: 訊息 key 或常量名稱

    Returns:
        訊息代碼字串（例如："session.feedbackSubmitted"）
    """
    # 嘗試直接從 MessageCodes 獲取
    if hasattr(MessageCodes, key):
        return str(getattr(MessageCodes, key))

    # 嘗試從映射表獲取（支援大寫和小寫）
    upper_key = key.upper()
    if upper_key in LEGACY_KEY_MAPPING:
        constant_name = LEGACY_KEY_MAPPING[upper_key]
        if hasattr(MessageCodes, constant_name):
            return str(getattr(MessageCodes, constant_name))

    # 如果是小寫的 key，也嘗試映射
    if key in LEGACY_KEY_MAPPING:
        constant_name = LEGACY_KEY_MAPPING[key]
        if hasattr(MessageCodes, constant_name):
            return str(getattr(MessageCodes, constant_name))

    # 如果都找不到，返回一個預設格式
    return f"unknown.{key}"
