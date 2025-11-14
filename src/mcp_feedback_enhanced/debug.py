#!/usr/bin/env python3
"""
統一調試日誌模組
================

提供統一的調試日誌功能，確保調試輸出不會干擾 MCP 通信。
所有調試輸出都會發送到 stderr，並且只在調試模式啟用時才輸出。

使用方法：
```python
from .debug import debug_log

debug_log("這是一條調試信息")
```

環境變數控制：
- MCP_DEBUG=true/1/yes/on: 啟用調試模式
- MCP_DEBUG=false/0/no/off: 關閉調試模式（默認）

作者: Minidoracat
"""

import os
import sys
from typing import Any


def debug_log(message: Any, prefix: str = "DEBUG") -> None:
    """
    輸出調試訊息到標準錯誤，避免污染標準輸出

    Args:
        message: 要輸出的調試信息
        prefix: 調試信息的前綴標識，默認為 "DEBUG"
    """
    # 只在啟用調試模式時才輸出，避免干擾 MCP 通信
    if os.getenv("MCP_DEBUG", "").lower() not in ("true", "1", "yes", "on"):
        return

    try:
        # 確保消息是字符串類型
        if not isinstance(message, str):
            message = str(message)

        # 安全地輸出到 stderr，處理編碼問題
        try:
            print(f"[{prefix}] {message}", file=sys.stderr, flush=True)
        except UnicodeEncodeError:
            # 如果遇到編碼問題，使用 ASCII 安全模式
            safe_message = message.encode("ascii", errors="replace").decode("ascii")
            print(f"[{prefix}] {safe_message}", file=sys.stderr, flush=True)
    except Exception:
        # 最後的備用方案：靜默失敗，不影響主程序
        pass


def i18n_debug_log(message: Any) -> None:
    """國際化模組專用的調試日誌"""
    debug_log(message, "I18N")


def server_debug_log(message: Any) -> None:
    """伺服器模組專用的調試日誌"""
    debug_log(message, "SERVER")


def web_debug_log(message: Any) -> None:
    """Web UI 模組專用的調試日誌"""
    debug_log(message, "WEB")


def is_debug_enabled() -> bool:
    """檢查是否啟用了調試模式"""
    return os.getenv("MCP_DEBUG", "").lower() in ("true", "1", "yes", "on")


def set_debug_mode(enabled: bool) -> None:
    """設置調試模式（用於測試）"""
    os.environ["MCP_DEBUG"] = "true" if enabled else "false"
