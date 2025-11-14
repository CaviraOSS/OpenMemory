#!/usr/bin/env python3
"""
MCP 客戶端模擬器 - 簡化版本
"""

import asyncio
import json
import subprocess
from pathlib import Path
from typing import Any

from .test_utils import PerformanceTimer


class SimpleMCPClient:
    """簡化的 MCP 客戶端模擬器"""

    def __init__(self, timeout: int = 30):
        self.timeout = timeout
        self.server_process: subprocess.Popen | None = None
        self.stdin: Any = None
        self.stdout: Any = None
        self.stderr: Any = None
        self.initialized = False

    async def start_server(self) -> bool:
        """啟動 MCP 服務器"""
        try:
            # 使用正確的 uv run 命令啟動 MCP 服務器
            cmd = ["uv", "run", "python", "-m", "mcp_feedback_enhanced"]

            self.server_process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=0,
                cwd=Path.cwd(),
                encoding="utf-8",  # 明確指定 UTF-8 編碼
                errors="replace",  # 處理編碼錯誤
            )

            self.stdin = self.server_process.stdin
            self.stdout = self.server_process.stdout
            self.stderr = self.server_process.stderr

            # 等待服務器啟動
            await asyncio.sleep(2)

            if self.server_process.poll() is not None:
                return False

            return True

        except Exception as e:
            print(f"啟動 MCP 服務器失敗: {e}")
            return False

    async def initialize(self) -> bool:
        """初始化 MCP 連接"""
        if not self.server_process or self.server_process.poll() is not None:
            return False

        try:
            # 發送初始化請求
            init_request = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"roots": {"listChanged": True}, "sampling": {}},
                    "clientInfo": {"name": "test-client", "version": "1.0.0"},
                },
            }

            await self._send_request(init_request)
            response = await self._read_response()

            if response and "result" in response:
                self.initialized = True
                return True

        except Exception as e:
            print(f"MCP 初始化失敗: {e}")

        return False

    async def call_interactive_feedback(
        self, project_directory: str, summary: str, timeout: int = 30
    ) -> dict[str, Any]:
        """調用 interactive_feedback 工具"""
        if not self.initialized:
            return {"error": "MCP 客戶端未初始化"}

        try:
            request = {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": "interactive_feedback",
                    "arguments": {
                        "project_directory": project_directory,
                        "summary": summary,
                        "timeout": timeout,
                    },
                },
            }

            with PerformanceTimer() as timer:
                await self._send_request(request)
                response = await self._read_response(timeout=timeout + 5)

            if response and "result" in response:
                result = response["result"]
                result["performance"] = {"duration": timer.duration}
                # 修復 no-any-return 錯誤 - 確保返回明確類型
                return dict(result)  # 明確返回 dict[str, Any] 類型
            return {"error": "無效的回應格式", "response": response}

        except TimeoutError:
            return {"error": "調用超時"}
        except Exception as e:
            return {"error": f"調用失敗: {e!s}"}

    async def _send_request(self, request: dict[str, Any]):
        """發送請求"""
        if not self.stdin:
            raise RuntimeError("stdin 不可用")

        request_str = json.dumps(request) + "\n"
        self.stdin.write(request_str)
        self.stdin.flush()

    async def _read_response(self, timeout: int = 30) -> dict[str, Any] | None:
        """讀取回應"""
        if not self.stdout:
            raise RuntimeError("stdout 不可用")

        try:
            # 使用 asyncio 超時
            response_line = await asyncio.wait_for(
                asyncio.to_thread(self.stdout.readline), timeout=timeout
            )

            if response_line:
                response_data = json.loads(response_line.strip())
                # 修復 no-any-return 錯誤 - 確保返回明確類型
                return (
                    dict(response_data)
                    if isinstance(response_data, dict)
                    else response_data
                )
            return None

        except TimeoutError:
            raise
        except json.JSONDecodeError as e:
            print(f"JSON 解析錯誤: {e}, 原始數據: {response_line}")
            return None

    async def cleanup(self):
        """清理資源"""
        if self.server_process:
            try:
                # 嘗試正常終止
                self.server_process.terminate()

                # 等待進程結束
                try:
                    await asyncio.wait_for(
                        asyncio.to_thread(self.server_process.wait), timeout=5
                    )
                except TimeoutError:
                    # 強制終止
                    self.server_process.kill()
                    await asyncio.to_thread(self.server_process.wait)

            except Exception as e:
                print(f"清理 MCP 服務器失敗: {e}")
            finally:
                self.server_process = None
                self.stdin = None
                self.stdout = None
                self.stderr = None
                self.initialized = False


class MCPWorkflowTester:
    """MCP 工作流程測試器"""

    def __init__(self, timeout: int = 60):
        self.timeout = timeout
        self.client = SimpleMCPClient(timeout)

    async def test_basic_workflow(
        self, project_dir: str, summary: str
    ) -> dict[str, Any]:
        """測試基本工作流程"""
        result: dict[str, Any] = {
            "success": False,
            "steps": {},
            "errors": [],
            "performance": {},
        }

        with PerformanceTimer() as timer:
            try:
                # 1. 啟動服務器
                if await self.client.start_server():
                    result["steps"]["server_started"] = True
                else:
                    result["errors"].append("服務器啟動失敗")
                    return result

                # 2. 初始化連接
                if await self.client.initialize():
                    result["steps"]["initialized"] = True
                else:
                    result["errors"].append("初始化失敗")
                    return result

                # 3. 調用 interactive_feedback
                feedback_result = await self.client.call_interactive_feedback(
                    project_dir, summary, timeout=10
                )

                if "error" not in feedback_result:
                    result["steps"]["interactive_feedback_called"] = True
                    result["feedback_result"] = feedback_result
                    result["success"] = True
                else:
                    result["errors"].append(
                        f"interactive_feedback 調用失敗: {feedback_result['error']}"
                    )

            except Exception as e:
                result["errors"].append(f"測試異常: {e!s}")
            finally:
                await self.client.cleanup()
                result["performance"]["total_duration"] = timer.duration

        return result
