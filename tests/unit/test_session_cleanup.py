#!/usr/bin/env python3
"""
會話清理優化測試
================

測試 WebFeedbackSession 和 SessionCleanupManager 的清理功能。
"""

import asyncio
import time
from unittest.mock import Mock

import pytest

# 移除手動路徑操作，讓 mypy 和 pytest 使用正確的模組解析
from mcp_feedback_enhanced.web.models.feedback_session import (
    CleanupReason,
    SessionStatus,
    WebFeedbackSession,
)
from mcp_feedback_enhanced.web.utils.session_cleanup_manager import (
    CleanupPolicy,
    CleanupTrigger,
    SessionCleanupManager,
)


class TestWebFeedbackSessionCleanup:
    """測試 WebFeedbackSession 清理功能"""

    def setup_method(self):
        """測試前設置"""
        self.session_id = "test_session_001"
        self.project_dir = "/tmp/test_project"
        self.summary = "測試會話摘要"

        # 創建測試會話
        self.session = WebFeedbackSession(
            self.session_id,
            self.project_dir,
            self.summary,
            auto_cleanup_delay=60,  # 1分鐘自動清理
            max_idle_time=30,  # 30秒最大空閒時間
        )

    def teardown_method(self):
        """測試後清理"""
        if hasattr(self, "session") and self.session:
            try:
                self.session._cleanup_sync_enhanced(CleanupReason.MANUAL)
            except:
                pass

    def test_session_initialization(self):
        """測試會話初始化"""
        assert self.session.session_id == self.session_id
        assert self.session.project_directory == self.project_dir
        assert self.session.summary == self.summary
        assert self.session.status == SessionStatus.WAITING
        assert self.session.auto_cleanup_delay == 60
        assert self.session.max_idle_time == 30
        assert self.session.cleanup_timer is not None
        assert len(self.session.cleanup_stats) > 0

    def test_is_expired_by_idle_time(self):
        """測試空閒時間過期檢測"""
        # 新創建的會話不應該過期
        assert not self.session.is_expired()

        # 模擬空閒時間過長
        self.session.last_activity = time.time() - 40  # 40秒前
        assert self.session.is_expired()

    def test_is_expired_by_status(self):
        """測試狀態過期檢測"""
        # 設置為錯誤狀態
        self.session.status = SessionStatus.ERROR
        self.session.last_activity = time.time() - 400  # 400秒前
        assert self.session.is_expired()

        # 設置為已過期狀態
        self.session.status = SessionStatus.EXPIRED
        assert self.session.is_expired()

    def test_get_age_and_idle_time(self):
        """測試年齡和空閒時間計算"""
        # 測試年齡
        age = self.session.get_age()
        assert age >= 0
        assert age < 1  # 剛創建，應該小於1秒

        # 測試空閒時間
        idle_time = self.session.get_idle_time()
        assert idle_time >= 0
        assert idle_time < 1  # 剛創建，應該小於1秒

    def test_cleanup_timer_scheduling(self):
        """測試清理定時器調度"""
        # 檢查定時器是否已設置
        assert self.session.cleanup_timer is not None
        assert self.session.cleanup_timer.is_alive()

        # 測試延長定時器
        old_timer = self.session.cleanup_timer
        self.session.extend_cleanup_timer(120)

        # 應該創建新的定時器
        assert self.session.cleanup_timer != old_timer
        assert self.session.cleanup_timer.is_alive()

    def test_cleanup_callbacks(self):
        """測試清理回調函數"""
        callback_called = False
        callback_session = None
        callback_reason = None

        def test_callback(session, reason):
            nonlocal callback_called, callback_session, callback_reason
            callback_called = True
            callback_session = session
            callback_reason = reason

        # 添加回調
        self.session.add_cleanup_callback(test_callback)
        assert len(self.session.cleanup_callbacks) == 1

        # 執行清理
        self.session._cleanup_sync_enhanced(CleanupReason.MANUAL)

        # 檢查回調是否被調用
        assert callback_called
        assert callback_session == self.session
        assert callback_reason == CleanupReason.MANUAL

        # 移除回調
        self.session.remove_cleanup_callback(test_callback)
        assert len(self.session.cleanup_callbacks) == 0

    def test_cleanup_stats(self):
        """測試清理統計"""
        # 初始統計
        stats = self.session.get_cleanup_stats()
        assert stats["cleanup_count"] == 0
        assert stats["session_id"] == self.session_id
        assert stats["is_active"] == True

        # 執行清理
        self.session._cleanup_sync_enhanced(CleanupReason.EXPIRED)

        # 檢查統計更新
        stats = self.session.get_cleanup_stats()
        assert stats["cleanup_count"] == 1
        assert stats["cleanup_reason"] == CleanupReason.EXPIRED.value
        assert stats["last_cleanup_time"] is not None
        assert stats["cleanup_duration"] >= 0

    @pytest.mark.asyncio
    async def test_async_cleanup(self):
        """測試異步清理"""
        # 模擬 WebSocket 連接
        mock_websocket = Mock()
        mock_websocket.send_json = Mock(return_value=asyncio.Future())
        mock_websocket.send_json.return_value.set_result(None)
        mock_websocket.close = Mock(return_value=asyncio.Future())
        mock_websocket.close.return_value.set_result(None)
        mock_websocket.client_state.DISCONNECTED = False

        self.session.websocket = mock_websocket

        # 執行異步清理
        await self.session._cleanup_resources_enhanced(CleanupReason.TIMEOUT)

        # 檢查 WebSocket 是否被正確處理
        mock_websocket.send_json.assert_called_once()

        # 檢查清理統計
        stats = self.session.get_cleanup_stats()
        assert stats["cleanup_count"] == 1
        assert stats["cleanup_reason"] == CleanupReason.TIMEOUT.value

    def test_status_update_resets_timer(self):
        """測試狀態更新重置定時器"""
        old_timer = self.session.cleanup_timer

        # 更新狀態為活躍 - 使用 next_step 方法
        self.session.next_step("測試活躍狀態")

        # 檢查定時器是否被重置
        assert self.session.cleanup_timer != old_timer
        # 修復 union-attr 錯誤 - 檢查 Timer 是否存在且活躍
        assert self.session.cleanup_timer is not None
        assert self.session.cleanup_timer.is_alive()
        assert self.session.status == SessionStatus.ACTIVE


class TestSessionCleanupManager:
    """測試 SessionCleanupManager 功能"""

    def setup_method(self):
        """測試前設置"""
        # 創建模擬的 WebUIManager
        self.mock_web_ui_manager = Mock()
        self.mock_web_ui_manager.sessions = {}
        self.mock_web_ui_manager.current_session = None
        self.mock_web_ui_manager.cleanup_expired_sessions = Mock(return_value=0)
        self.mock_web_ui_manager.cleanup_sessions_by_memory_pressure = Mock(
            return_value=0
        )

        # 創建清理策略
        self.policy = CleanupPolicy(
            max_idle_time=30,
            max_session_age=300,
            max_sessions=5,
            cleanup_interval=10,
            enable_auto_cleanup=True,
        )

        # 創建清理管理器
        self.cleanup_manager = SessionCleanupManager(
            self.mock_web_ui_manager, self.policy
        )

    def teardown_method(self):
        """測試後清理"""
        if hasattr(self, "cleanup_manager"):
            self.cleanup_manager.stop_auto_cleanup()

    def test_cleanup_manager_initialization(self):
        """測試清理管理器初始化"""
        assert self.cleanup_manager.web_ui_manager == self.mock_web_ui_manager
        assert self.cleanup_manager.policy == self.policy
        assert not self.cleanup_manager.is_running
        assert self.cleanup_manager.cleanup_thread is None
        assert len(self.cleanup_manager.cleanup_callbacks) == 0
        assert len(self.cleanup_manager.cleanup_history) == 0

    def test_auto_cleanup_start_stop(self):
        """測試自動清理啟動和停止"""
        # 啟動自動清理
        result = self.cleanup_manager.start_auto_cleanup()
        assert result == True
        assert self.cleanup_manager.is_running == True
        assert self.cleanup_manager.cleanup_thread is not None
        assert self.cleanup_manager.cleanup_thread.is_alive()

        # 停止自動清理
        result = self.cleanup_manager.stop_auto_cleanup()
        assert result == True
        assert self.cleanup_manager.is_running == False

    def test_trigger_cleanup_memory_pressure(self):
        """測試內存壓力清理觸發"""
        # 設置模擬返回值
        self.mock_web_ui_manager.cleanup_sessions_by_memory_pressure.return_value = 3

        # 觸發內存壓力清理
        cleaned = self.cleanup_manager.trigger_cleanup(
            CleanupTrigger.MEMORY_PRESSURE, force=True
        )

        # 檢查結果
        assert cleaned == 3
        self.mock_web_ui_manager.cleanup_sessions_by_memory_pressure.assert_called_once_with(
            True
        )

        # 檢查統計更新
        stats = self.cleanup_manager.get_cleanup_statistics()
        assert stats["total_cleanups"] == 1
        assert stats["memory_pressure_cleanups"] == 1
        assert stats["total_sessions_cleaned"] == 3

    def test_trigger_cleanup_expired(self):
        """測試過期清理觸發"""
        # 設置模擬返回值
        self.mock_web_ui_manager.cleanup_expired_sessions.return_value = 2

        # 觸發過期清理
        cleaned = self.cleanup_manager.trigger_cleanup(CleanupTrigger.EXPIRED)

        # 檢查結果
        assert cleaned == 2
        self.mock_web_ui_manager.cleanup_expired_sessions.assert_called_once()

        # 檢查統計更新
        stats = self.cleanup_manager.get_cleanup_statistics()
        assert stats["total_cleanups"] == 1
        assert stats["expired_cleanups"] == 1
        assert stats["total_sessions_cleaned"] == 2

    def test_cleanup_statistics(self):
        """測試清理統計功能"""
        # 初始統計
        stats = self.cleanup_manager.get_cleanup_statistics()
        assert stats["total_cleanups"] == 0
        assert stats["total_sessions_cleaned"] == 0
        assert stats["is_auto_cleanup_running"] == False

        # 執行一些清理操作
        self.mock_web_ui_manager.cleanup_expired_sessions.return_value = 1
        self.cleanup_manager.trigger_cleanup(CleanupTrigger.EXPIRED)

        self.mock_web_ui_manager.cleanup_sessions_by_memory_pressure.return_value = 2
        self.cleanup_manager.trigger_cleanup(CleanupTrigger.MEMORY_PRESSURE)

        # 檢查統計
        stats = self.cleanup_manager.get_cleanup_statistics()
        assert stats["total_cleanups"] == 2
        assert stats["expired_cleanups"] == 1
        assert stats["memory_pressure_cleanups"] == 1
        assert stats["total_sessions_cleaned"] == 3
        assert stats["average_cleanup_time"] >= 0

    def test_cleanup_history(self):
        """測試清理歷史記錄"""
        # 初始歷史為空
        history = self.cleanup_manager.get_cleanup_history()
        assert len(history) == 0

        # 執行清理操作
        self.mock_web_ui_manager.cleanup_expired_sessions.return_value = 1
        self.cleanup_manager.trigger_cleanup(CleanupTrigger.EXPIRED)

        # 檢查歷史記錄
        history = self.cleanup_manager.get_cleanup_history()
        assert len(history) == 1

        record = history[0]
        assert record["trigger"] == CleanupTrigger.EXPIRED.value
        assert record["cleaned_count"] == 1
        assert "timestamp" in record
        assert "duration" in record

    def test_policy_update(self):
        """測試策略更新"""
        # 更新策略
        self.cleanup_manager.update_policy(
            max_idle_time=60, max_sessions=10, enable_auto_cleanup=False
        )

        # 檢查策略是否更新
        assert self.cleanup_manager.policy.max_idle_time == 60
        assert self.cleanup_manager.policy.max_sessions == 10
        assert self.cleanup_manager.policy.enable_auto_cleanup == False

    def test_stats_reset(self):
        """測試統計重置"""
        # 執行一些操作產生統計
        self.mock_web_ui_manager.cleanup_expired_sessions.return_value = 1
        self.cleanup_manager.trigger_cleanup(CleanupTrigger.EXPIRED)

        # 檢查有統計數據
        stats = self.cleanup_manager.get_cleanup_statistics()
        assert stats["total_cleanups"] > 0

        # 重置統計
        self.cleanup_manager.reset_stats()

        # 檢查統計已重置
        stats = self.cleanup_manager.get_cleanup_statistics()
        assert stats["total_cleanups"] == 0
        assert stats["total_sessions_cleaned"] == 0

        history = self.cleanup_manager.get_cleanup_history()
        assert len(history) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
