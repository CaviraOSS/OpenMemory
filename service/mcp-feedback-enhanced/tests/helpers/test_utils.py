#!/usr/bin/env python3
"""
測試工具函數
"""

import asyncio
import socket
import time
from typing import Any


class TestUtils:
    """測試工具類"""

    @staticmethod
    def find_free_port(start_port: int = 8000, max_attempts: int = 100) -> int:
        """尋找可用端口"""
        for port in range(start_port, start_port + max_attempts):
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.bind(("127.0.0.1", port))
                    return port
            except OSError:
                continue
        raise RuntimeError(
            f"無法找到可用端口 (嘗試範圍: {start_port}-{start_port + max_attempts})"
        )

    @staticmethod
    async def wait_for_condition(
        condition_func, timeout: float = 10.0, check_interval: float = 0.1
    ) -> bool:
        """等待條件滿足"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            if (
                await condition_func()
                if asyncio.iscoroutinefunction(condition_func)
                else condition_func()
            ):
                return True
            await asyncio.sleep(check_interval)
        return False

    @staticmethod
    def create_test_session_data(
        session_id: str = "test-session-123",
        project_directory: str = "/test/project",
        summary: str = "測試摘要",
    ) -> dict[str, Any]:
        """創建測試會話數據"""
        return {
            "session_id": session_id,
            "project_directory": project_directory,
            "summary": summary,
            "status": "waiting",
            "created_at": time.time(),
            "last_activity": time.time(),
        }

    @staticmethod
    def create_test_feedback_data(
        feedback: str = "測試回饋", images: list[dict] | None = None
    ) -> dict[str, Any]:
        """創建測試回饋數據"""
        return {
            "feedback": feedback,
            "images": images or [],
            "settings": {
                "image_size_limit": 1024 * 1024,  # 1MB
                "enable_base64_detail": True,
            },
        }

    @staticmethod
    def validate_web_response(response_data: dict[str, Any]) -> bool:
        """驗證 Web 回應格式"""
        required_fields = ["command_logs", "interactive_feedback", "images"]
        return all(field in response_data for field in required_fields)

    @staticmethod
    def validate_session_info(session_info: dict[str, Any]) -> bool:
        """驗證會話信息格式"""
        required_fields = ["session_id", "project_directory", "summary", "status"]
        return all(field in session_info for field in required_fields)


class MockWebSocketClient:
    """模擬 WebSocket 客戶端"""

    def __init__(self):
        self.connected = False
        self.messages = []
        self.responses = []

    async def connect(self, url: str) -> bool:
        """模擬連接"""
        self.connected = True
        return True

    async def send_json(self, data: dict[str, Any]):
        """模擬發送 JSON 數據"""
        if not self.connected:
            raise RuntimeError("WebSocket 未連接")
        self.messages.append(data)

    async def receive_json(self) -> dict[str, Any]:
        """模擬接收 JSON 數據"""
        if not self.connected:
            raise RuntimeError("WebSocket 未連接")
        if self.responses:
            response = self.responses.pop(0)
            # 修復 no-any-return 錯誤 - 確保返回明確類型
            return dict(response)  # 明確返回 dict[str, Any] 類型
        # 返回默認回應
        return {"type": "connection_established", "message": "連接成功"}

    def add_response(self, response: dict[str, Any]):
        """添加模擬回應"""
        self.responses.append(response)

    async def close(self):
        """關閉連接"""
        self.connected = False


class PerformanceTimer:
    """性能計時器"""

    def __init__(self):
        self.start_time: float | None = None
        self.end_time: float | None = None

    def start(self):
        """開始計時"""
        self.start_time = time.time()

    def stop(self):
        """停止計時"""
        self.end_time = time.time()

    @property
    def duration(self) -> float:
        """獲取持續時間"""
        if self.start_time is None:
            return 0.0
        end = self.end_time or time.time()
        return end - self.start_time

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop()
