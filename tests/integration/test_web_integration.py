#!/usr/bin/env python3
"""
Web UI 集成測試
"""

import asyncio
import time

import pytest

from tests.fixtures.test_data import TestData
from tests.helpers.test_utils import TestUtils


class TestWebUIIntegration:
    """Web UI 集成測試"""

    @pytest.mark.asyncio
    async def test_web_server_startup_and_routes(self, web_ui_manager):
        """測試 Web 服務器啟動和基本路由"""
        # 啟動服務器
        web_ui_manager.start_server()

        # 等待服務器啟動
        await asyncio.sleep(3)

        # 驗證服務器正在運行
        assert web_ui_manager.server_thread is not None
        assert web_ui_manager.server_thread.is_alive()

        # 測試基本路由可訪問性
        import aiohttp

        base_url = f"http://{web_ui_manager.host}:{web_ui_manager.port}"

        async with aiohttp.ClientSession() as session:
            # 測試主頁
            async with session.get(f"{base_url}/") as response:
                assert response.status == 200
                text = await response.text()
                assert "MCP Feedback Enhanced" in text

            # 測試靜態文件
            async with session.get(f"{base_url}/static/css/style.css") as response:
                # 可能返回 200 或 404，但不應該是服務器錯誤
                assert response.status in [200, 404]

    @pytest.mark.asyncio
    async def test_session_api_integration(self, web_ui_manager, test_project_dir):
        """測試會話 API 集成"""
        import aiohttp

        # 創建會話
        session_id = web_ui_manager.create_session(
            str(test_project_dir), TestData.SAMPLE_SESSION["summary"]
        )

        # 啟動服務器
        web_ui_manager.start_server()
        await asyncio.sleep(3)

        base_url = f"http://{web_ui_manager.host}:{web_ui_manager.port}"

        async with aiohttp.ClientSession() as session:
            # 測試當前會話 API
            async with session.get(f"{base_url}/api/current-session") as response:
                assert response.status == 200
                data = await response.json()

                assert data["session_id"] == session_id
                assert data["project_directory"] == str(test_project_dir)
                assert data["summary"] == TestData.SAMPLE_SESSION["summary"]

    @pytest.mark.asyncio
    async def test_websocket_connection(self, web_ui_manager, test_project_dir):
        """測試 WebSocket 連接"""
        import aiohttp

        # 創建會話
        web_ui_manager.create_session(
            str(test_project_dir), TestData.SAMPLE_SESSION["summary"]
        )

        # 啟動服務器
        web_ui_manager.start_server()
        await asyncio.sleep(3)

        ws_url = f"ws://{web_ui_manager.host}:{web_ui_manager.port}/ws"

        async with aiohttp.ClientSession() as session:
            try:
                async with session.ws_connect(ws_url) as ws:
                    # 應該收到連接確認消息
                    msg = await asyncio.wait_for(ws.receive(), timeout=5)
                    assert msg.type == aiohttp.WSMsgType.TEXT

                    data = msg.json()
                    assert data["type"] == "connection_established"

                    # 可能會收到額外的消息（session_updated 或 status_update），先處理掉
                    try:
                        while True:
                            extra_msg = await asyncio.wait_for(ws.receive(), timeout=1)
                            if extra_msg.type == aiohttp.WSMsgType.TEXT:
                                extra_data = extra_msg.json()
                                if extra_data["type"] in [
                                    "session_updated",
                                    "status_update",
                                ]:
                                    continue
                                # 如果是其他類型的消息，可能是我們要的回應，先保存
                                break
                            break
                    except TimeoutError:
                        # 沒有額外消息，繼續測試
                        pass

                    # 測試發送心跳
                    heartbeat_msg = {
                        "type": "heartbeat",
                        "tabId": "test-tab-123",
                        "timestamp": time.time(),
                    }
                    await ws.send_str(str(heartbeat_msg).replace("'", '"'))

                    # 應該收到心跳回應
                    response = await asyncio.wait_for(ws.receive(), timeout=5)
                    if response.type == aiohttp.WSMsgType.TEXT:
                        response_data = response.json()
                        assert response_data["type"] == "heartbeat_response"

            except TimeoutError:
                pytest.fail("WebSocket 連接或通信超時")
            except Exception as e:
                pytest.fail(f"WebSocket 測試失敗: {e}")


class TestWebUISessionManagement:
    """Web UI 會話管理集成測試"""

    @pytest.mark.asyncio
    async def test_session_lifecycle(self, web_ui_manager, test_project_dir):
        """測試會話生命週期"""
        # 1. 創建會話
        session_id = web_ui_manager.create_session(str(test_project_dir), "第一個會話")

        current_session = web_ui_manager.get_current_session()
        assert current_session is not None
        assert current_session.session_id == session_id

        # 2. 創建第二個會話（模擬第二次 MCP 調用）
        session_id_2 = web_ui_manager.create_session(
            str(test_project_dir), "第二個會話"
        )

        # 當前會話應該切換到新會話
        current_session = web_ui_manager.get_current_session()
        assert current_session.session_id == session_id_2
        assert current_session.summary == "第二個會話"

        # 3. 測試會話狀態更新
        from mcp_feedback_enhanced.web.models import SessionStatus

        current_session.update_status(SessionStatus.FEEDBACK_SUBMITTED, "已提交回饋")
        assert current_session.status == SessionStatus.FEEDBACK_SUBMITTED

    @pytest.mark.asyncio
    async def test_session_feedback_flow(self, web_ui_manager, test_project_dir):
        """測試會話回饋流程"""
        # 創建會話
        web_ui_manager.create_session(
            str(test_project_dir), TestData.SAMPLE_SESSION["summary"]
        )

        session = web_ui_manager.get_current_session()

        # 模擬提交回饋
        await session.submit_feedback(
            TestData.SAMPLE_FEEDBACK["feedback"],
            TestData.SAMPLE_FEEDBACK["images"],
            TestData.SAMPLE_FEEDBACK["settings"],
        )

        # 驗證回饋已保存
        assert session.feedback_result == TestData.SAMPLE_FEEDBACK["feedback"]
        assert session.images == TestData.SAMPLE_FEEDBACK["images"]
        assert session.settings == TestData.SAMPLE_FEEDBACK["settings"]

        # 驗證狀態已更新
        from mcp_feedback_enhanced.web.models import SessionStatus

        assert session.status == SessionStatus.FEEDBACK_SUBMITTED

    @pytest.mark.asyncio
    async def test_session_timeout_handling(self, web_ui_manager, test_project_dir):
        """測試會話超時處理"""
        # 創建會話，設置短超時
        web_ui_manager.create_session(
            str(test_project_dir), TestData.SAMPLE_SESSION["summary"]
        )

        session = web_ui_manager.get_current_session()

        # 測試超時等待
        try:
            result = await asyncio.wait_for(
                session.wait_for_feedback(timeout=1),  # 1秒超時
                timeout=2,  # 外部超時保護
            )
            # 如果沒有超時，應該返回默認結果
            assert TestUtils.validate_web_response(result)
        except TimeoutError:
            # 超時是預期的行為
            pass


class TestWebUIErrorHandling:
    """Web UI 錯誤處理集成測試"""

    @pytest.mark.asyncio
    async def test_no_session_handling(self, web_ui_manager):
        """測試無會話時的處理"""
        import aiohttp

        # 確保沒有活躍會話
        web_ui_manager.clear_current_session()

        # 啟動服務器
        web_ui_manager.start_server()
        await asyncio.sleep(3)

        base_url = f"http://{web_ui_manager.host}:{web_ui_manager.port}"

        async with aiohttp.ClientSession() as session:
            # 測試主頁應該顯示等待頁面
            async with session.get(f"{base_url}/") as response:
                assert response.status == 200
                text = await response.text()
                assert "MCP Feedback Enhanced" in text

            # 測試當前會話 API 應該返回無會話狀態
            async with session.get(f"{base_url}/api/current-session") as response:
                assert response.status == 404  # 或其他適當的狀態碼

    @pytest.mark.asyncio
    async def test_websocket_without_session(self, web_ui_manager):
        """測試無會話時的 WebSocket 連接"""
        import aiohttp

        # 確保沒有活躍會話
        web_ui_manager.clear_current_session()

        # 啟動服務器
        web_ui_manager.start_server()
        await asyncio.sleep(3)

        ws_url = f"ws://{web_ui_manager.host}:{web_ui_manager.port}/ws"

        async with aiohttp.ClientSession() as session:
            try:
                async with session.ws_connect(ws_url) as ws:
                    # 連接應該被拒絕或立即關閉
                    msg = await asyncio.wait_for(ws.receive(), timeout=5)

                    if msg.type == aiohttp.WSMsgType.CLOSE:
                        # 連接被關閉是預期的
                        assert True
                    # 如果收到消息，應該是錯誤消息
                    elif msg.type == aiohttp.WSMsgType.TEXT:
                        data = msg.json()
                        assert "error" in data or data.get("type") == "error"

            except aiohttp.WSServerHandshakeError:
                # WebSocket 握手失敗也是預期的
                assert True
            except TimeoutError:
                # 超時也可能是預期的行為
                assert True


class TestWebUIPerformance:
    """Web UI 性能集成測試"""

    @pytest.mark.asyncio
    async def test_server_startup_time(self, web_ui_manager):
        """測試服務器啟動時間"""
        from tests.helpers.test_utils import PerformanceTimer

        with PerformanceTimer() as timer:
            web_ui_manager.start_server()
            await asyncio.sleep(3)  # 等待啟動完成

        # 啟動時間應該在合理範圍內
        assert timer.duration < 10, f"Web 服務器啟動時間過長: {timer.duration:.2f}秒"

        # 驗證服務器確實在運行
        assert web_ui_manager.server_thread is not None
        assert web_ui_manager.server_thread.is_alive()

    @pytest.mark.asyncio
    async def test_multiple_session_performance(self, web_ui_manager, test_project_dir):
        """測試多會話性能"""
        from tests.helpers.test_utils import PerformanceTimer

        session_ids = []

        with PerformanceTimer() as timer:
            # 創建多個會話
            for i in range(10):
                session_id = web_ui_manager.create_session(
                    str(test_project_dir), f"測試會話 {i + 1}"
                )
                session_ids.append(session_id)

        # 創建會話的時間應該是線性的，不應該有明顯的性能下降
        avg_time_per_session = timer.duration / 10
        assert avg_time_per_session < 0.1, (
            f"每個會話創建時間過長: {avg_time_per_session:.3f}秒"
        )

        # 驗證最後一個會話是當前活躍會話
        current_session = web_ui_manager.get_current_session()
        assert current_session.session_id == session_ids[-1]
