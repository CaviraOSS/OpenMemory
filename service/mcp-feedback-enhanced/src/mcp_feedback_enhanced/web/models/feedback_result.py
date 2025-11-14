#!/usr/bin/env python3
"""
回饋結果資料模型

定義回饋收集的資料結構，用於 Web UI 與後端的資料傳輸。
"""

from typing import TypedDict


class FeedbackResult(TypedDict):
    """回饋結果的型別定義"""

    command_logs: str
    interactive_feedback: str
    images: list[dict]
