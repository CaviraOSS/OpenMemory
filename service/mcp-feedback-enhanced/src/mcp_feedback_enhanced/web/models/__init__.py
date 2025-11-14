#!/usr/bin/env python3
"""
Web UI 資料模型模組
==================

定義 Web UI 相關的資料結構和型別。
"""

from .feedback_result import FeedbackResult
from .feedback_session import CleanupReason, SessionStatus, WebFeedbackSession


__all__ = ["CleanupReason", "FeedbackResult", "SessionStatus", "WebFeedbackSession"]
