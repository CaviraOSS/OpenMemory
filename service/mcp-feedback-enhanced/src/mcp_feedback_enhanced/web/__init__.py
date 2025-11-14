#!/usr/bin/env python3
"""
MCP Feedback Enhanced Web UI 模組

基於 FastAPI 和 WebSocket 的 Web 用戶介面，提供豐富的互動回饋功能。
支援文字輸入、圖片上傳、命令執行等功能，設計採用現代化的 Web UI 架構。

主要功能：
- FastAPI Web 應用程式
- WebSocket 實時通訊
- 多語言國際化支援
- 圖片上傳與預覽
- 命令執行與結果展示
- 響應式設計
- 本地和遠端環境適配
"""

from .main import WebUIManager, get_web_ui_manager, launch_web_feedback_ui, stop_web_ui


__all__ = [
    "WebUIManager",
    "get_web_ui_manager",
    "launch_web_feedback_ui",
    "stop_web_ui",
]
