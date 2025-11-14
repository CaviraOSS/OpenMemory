#!/usr/bin/env python3
"""
集成式內存監控系統
==================

提供與資源管理器深度集成的內存監控功能，包括：
- 系統和進程內存使用監控
- 智能清理觸發機制
- 內存洩漏檢測和趨勢分析
- 性能優化建議
"""

import gc
import threading
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import psutil

from ..debug import debug_log
from .error_handler import ErrorHandler, ErrorType


@dataclass
class MemorySnapshot:
    """內存快照數據類"""

    timestamp: datetime
    system_total: int  # 系統總內存 (bytes)
    system_available: int  # 系統可用內存 (bytes)
    system_used: int  # 系統已用內存 (bytes)
    system_percent: float  # 系統內存使用率 (%)
    process_rss: int  # 進程常駐內存 (bytes)
    process_vms: int  # 進程虛擬內存 (bytes)
    process_percent: float  # 進程內存使用率 (%)
    gc_objects: int  # Python 垃圾回收對象數量


@dataclass
class MemoryAlert:
    """內存警告數據類"""

    level: str  # warning, critical, emergency
    message: str
    timestamp: datetime
    memory_percent: float
    recommended_action: str


@dataclass
class MemoryStats:
    """內存統計數據類"""

    monitoring_duration: float  # 監控持續時間 (秒)
    snapshots_count: int  # 快照數量
    average_system_usage: float  # 平均系統內存使用率
    peak_system_usage: float  # 峰值系統內存使用率
    average_process_usage: float  # 平均進程內存使用率
    peak_process_usage: float  # 峰值進程內存使用率
    alerts_count: int  # 警告數量
    cleanup_triggers: int  # 清理觸發次數
    memory_trend: str  # 內存趨勢 (stable, increasing, decreasing)


class MemoryMonitor:
    """集成式內存監控器"""

    def __init__(
        self,
        warning_threshold: float = 0.8,
        critical_threshold: float = 0.9,
        emergency_threshold: float = 0.95,
        monitoring_interval: int = 30,
        max_snapshots: int = 1000,
    ):
        """
        初始化內存監控器

        Args:
            warning_threshold: 警告閾值 (0.0-1.0)
            critical_threshold: 危險閾值 (0.0-1.0)
            emergency_threshold: 緊急閾值 (0.0-1.0)
            monitoring_interval: 監控間隔 (秒)
            max_snapshots: 最大快照數量
        """
        self.warning_threshold = warning_threshold
        self.critical_threshold = critical_threshold
        self.emergency_threshold = emergency_threshold
        self.monitoring_interval = monitoring_interval
        self.max_snapshots = max_snapshots

        # 監控狀態
        self.is_monitoring = False
        self.monitor_thread: threading.Thread | None = None
        self._stop_event = threading.Event()

        # 數據存儲
        self.snapshots: deque = deque(maxlen=max_snapshots)
        self.alerts: list[MemoryAlert] = []
        self.max_alerts = 100

        # 回調函數
        self.cleanup_callbacks: list[Callable] = []
        self.alert_callbacks: list[Callable[[MemoryAlert], None]] = []

        # 統計數據
        self.start_time: datetime | None = None
        self.cleanup_triggers_count = 0

        # 進程信息
        self.process = psutil.Process()

        debug_log("MemoryMonitor 初始化完成")

    def start_monitoring(self) -> bool:
        """
        開始內存監控

        Returns:
            bool: 是否成功啟動
        """
        if self.is_monitoring:
            debug_log("內存監控已在運行")
            return True

        try:
            self.is_monitoring = True
            self.start_time = datetime.now()
            self._stop_event.clear()

            self.monitor_thread = threading.Thread(
                target=self._monitoring_loop, name="MemoryMonitor", daemon=True
            )
            self.monitor_thread.start()

            debug_log(f"內存監控已啟動，間隔 {self.monitoring_interval} 秒")
            return True

        except Exception as e:
            self.is_monitoring = False
            error_id = ErrorHandler.log_error_with_context(
                e, context={"operation": "啟動內存監控"}, error_type=ErrorType.SYSTEM
            )
            debug_log(f"啟動內存監控失敗 [錯誤ID: {error_id}]: {e}")
            return False

    def stop_monitoring(self) -> bool:
        """
        停止內存監控

        Returns:
            bool: 是否成功停止
        """
        if not self.is_monitoring:
            debug_log("內存監控未在運行")
            return True

        try:
            self.is_monitoring = False
            self._stop_event.set()

            if self.monitor_thread and self.monitor_thread.is_alive():
                self.monitor_thread.join(timeout=5)

            debug_log("內存監控已停止")
            return True

        except Exception as e:
            error_id = ErrorHandler.log_error_with_context(
                e, context={"operation": "停止內存監控"}, error_type=ErrorType.SYSTEM
            )
            debug_log(f"停止內存監控失敗 [錯誤ID: {error_id}]: {e}")
            return False

    def _monitoring_loop(self):
        """內存監控主循環"""
        debug_log("內存監控循環開始")

        while not self._stop_event.is_set():
            try:
                # 收集內存快照
                snapshot = self._collect_memory_snapshot()
                self.snapshots.append(snapshot)

                # 檢查內存使用情況
                self._check_memory_usage(snapshot)

                # 等待下次監控
                if self._stop_event.wait(self.monitoring_interval):
                    break

            except Exception as e:
                error_id = ErrorHandler.log_error_with_context(
                    e,
                    context={"operation": "內存監控循環"},
                    error_type=ErrorType.SYSTEM,
                )
                debug_log(f"內存監控循環錯誤 [錯誤ID: {error_id}]: {e}")

                # 發生錯誤時等待較短時間後重試
                if self._stop_event.wait(5):
                    break

        debug_log("內存監控循環結束")

    def _collect_memory_snapshot(self) -> MemorySnapshot:
        """收集內存快照"""
        try:
            # 系統內存信息
            system_memory = psutil.virtual_memory()

            # 進程內存信息
            process_memory = self.process.memory_info()
            process_percent = self.process.memory_percent()

            # Python 垃圾回收信息
            gc_objects = len(gc.get_objects())

            return MemorySnapshot(
                timestamp=datetime.now(),
                system_total=system_memory.total,
                system_available=system_memory.available,
                system_used=system_memory.used,
                system_percent=system_memory.percent,
                process_rss=process_memory.rss,
                process_vms=process_memory.vms,
                process_percent=process_percent,
                gc_objects=gc_objects,
            )

        except Exception as e:
            error_id = ErrorHandler.log_error_with_context(
                e, context={"operation": "收集內存快照"}, error_type=ErrorType.SYSTEM
            )
            debug_log(f"收集內存快照失敗 [錯誤ID: {error_id}]: {e}")
            raise

    def _check_memory_usage(self, snapshot: MemorySnapshot):
        """檢查內存使用情況並觸發相應動作"""
        usage_percent = snapshot.system_percent / 100.0

        # 檢查緊急閾值
        if usage_percent >= self.emergency_threshold:
            alert = MemoryAlert(
                level="emergency",
                message=f"內存使用率達到緊急水平: {snapshot.system_percent:.1f}%",
                timestamp=snapshot.timestamp,
                memory_percent=snapshot.system_percent,
                recommended_action="立即執行強制清理和垃圾回收",
            )
            self._handle_alert(alert)
            self._trigger_emergency_cleanup()

        # 檢查危險閾值
        elif usage_percent >= self.critical_threshold:
            alert = MemoryAlert(
                level="critical",
                message=f"內存使用率達到危險水平: {snapshot.system_percent:.1f}%",
                timestamp=snapshot.timestamp,
                memory_percent=snapshot.system_percent,
                recommended_action="執行資源清理和垃圾回收",
            )
            self._handle_alert(alert)
            self._trigger_cleanup()

        # 檢查警告閾值
        elif usage_percent >= self.warning_threshold:
            alert = MemoryAlert(
                level="warning",
                message=f"內存使用率較高: {snapshot.system_percent:.1f}%",
                timestamp=snapshot.timestamp,
                memory_percent=snapshot.system_percent,
                recommended_action="考慮執行輕量級清理",
            )
            self._handle_alert(alert)

    def _handle_alert(self, alert: MemoryAlert):
        """處理內存警告"""
        # 添加到警告列表
        self.alerts.append(alert)

        # 限制警告數量
        if len(self.alerts) > self.max_alerts:
            self.alerts = self.alerts[-self.max_alerts :]

        # 調用警告回調
        for callback in self.alert_callbacks:
            try:
                callback(alert)
            except Exception as e:
                debug_log(f"警告回調執行失敗: {e}")

        debug_log(f"內存警告 [{alert.level}]: {alert.message}")

    def _trigger_cleanup(self):
        """觸發清理操作"""
        self.cleanup_triggers_count += 1
        debug_log("觸發內存清理操作")

        # 執行 Python 垃圾回收
        collected = gc.collect()
        debug_log(f"垃圾回收清理了 {collected} 個對象")

        # 調用清理回調
        for callback in self.cleanup_callbacks:
            try:
                callback()
            except Exception as e:
                debug_log(f"清理回調執行失敗: {e}")

    def _trigger_emergency_cleanup(self):
        """觸發緊急清理操作"""
        debug_log("觸發緊急內存清理操作")

        # 執行強制垃圾回收
        for _ in range(3):
            collected = gc.collect()
            debug_log(f"強制垃圾回收清理了 {collected} 個對象")

        # 調用清理回調（強制模式）
        for callback in self.cleanup_callbacks:
            try:
                # 修復 unreachable 錯誤 - 簡化邏輯，移除不可達的 else 分支
                # 嘗試傳遞 force 參數
                import inspect

                sig = inspect.signature(callback)
                if "force" in sig.parameters:
                    callback(force=True)
                else:
                    callback()
            except Exception as e:
                debug_log(f"緊急清理回調執行失敗: {e}")

    def add_cleanup_callback(self, callback: Callable):
        """添加清理回調函數"""
        if callback not in self.cleanup_callbacks:
            self.cleanup_callbacks.append(callback)
            debug_log("添加清理回調函數")

    def add_alert_callback(self, callback: Callable[[MemoryAlert], None]):
        """添加警告回調函數"""
        if callback not in self.alert_callbacks:
            self.alert_callbacks.append(callback)
            debug_log("添加警告回調函數")

    def remove_cleanup_callback(self, callback: Callable):
        """移除清理回調函數"""
        if callback in self.cleanup_callbacks:
            self.cleanup_callbacks.remove(callback)
            debug_log("移除清理回調函數")

    def remove_alert_callback(self, callback: Callable[[MemoryAlert], None]):
        """移除警告回調函數"""
        if callback in self.alert_callbacks:
            self.alert_callbacks.remove(callback)
            debug_log("移除警告回調函數")

    def get_current_memory_info(self) -> dict[str, Any]:
        """獲取當前內存信息"""
        try:
            snapshot = self._collect_memory_snapshot()
            return {
                "timestamp": snapshot.timestamp.isoformat(),
                "system": {
                    "total_gb": round(snapshot.system_total / (1024**3), 2),
                    "available_gb": round(snapshot.system_available / (1024**3), 2),
                    "used_gb": round(snapshot.system_used / (1024**3), 2),
                    "usage_percent": round(snapshot.system_percent, 1),
                },
                "process": {
                    "rss_mb": round(snapshot.process_rss / (1024**2), 2),
                    "vms_mb": round(snapshot.process_vms / (1024**2), 2),
                    "usage_percent": round(snapshot.process_percent, 1),
                },
                "gc_objects": snapshot.gc_objects,
                "status": self._get_memory_status(snapshot.system_percent / 100.0),
            }
        except Exception as e:
            error_id = ErrorHandler.log_error_with_context(
                e,
                context={"operation": "獲取當前內存信息"},
                error_type=ErrorType.SYSTEM,
            )
            debug_log(f"獲取內存信息失敗 [錯誤ID: {error_id}]: {e}")
            return {}

    def get_memory_stats(self) -> MemoryStats:
        """獲取內存統計數據"""
        if not self.snapshots:
            return MemoryStats(
                monitoring_duration=0.0,
                snapshots_count=0,
                average_system_usage=0.0,
                peak_system_usage=0.0,
                average_process_usage=0.0,
                peak_process_usage=0.0,
                alerts_count=0,
                cleanup_triggers=0,
                memory_trend="unknown",
            )

        # 計算統計數據
        system_usages = [s.system_percent for s in self.snapshots]
        process_usages = [s.process_percent for s in self.snapshots]

        duration = 0.0
        if self.start_time:
            duration = (datetime.now() - self.start_time).total_seconds()

        return MemoryStats(
            monitoring_duration=duration,
            snapshots_count=len(self.snapshots),
            average_system_usage=sum(system_usages) / len(system_usages),
            peak_system_usage=max(system_usages),
            average_process_usage=sum(process_usages) / len(process_usages),
            peak_process_usage=max(process_usages),
            alerts_count=len(self.alerts),
            cleanup_triggers=self.cleanup_triggers_count,
            memory_trend=self._analyze_memory_trend(),
        )

    def get_recent_alerts(self, limit: int = 10) -> list[MemoryAlert]:
        """獲取最近的警告"""
        return self.alerts[-limit:] if self.alerts else []

    def _get_memory_status(self, usage_percent: float) -> str:
        """獲取內存狀態描述"""
        if usage_percent >= self.emergency_threshold:
            return "emergency"
        if usage_percent >= self.critical_threshold:
            return "critical"
        if usage_percent >= self.warning_threshold:
            return "warning"
        return "normal"

    def _analyze_memory_trend(self) -> str:
        """分析內存使用趨勢"""
        if len(self.snapshots) < 10:
            return "insufficient_data"

        # 取最近的快照進行趨勢分析
        recent_snapshots = list(self.snapshots)[-10:]
        usages = [s.system_percent for s in recent_snapshots]

        # 簡單的線性趨勢分析
        first_half = usages[:5]
        second_half = usages[5:]

        avg_first = sum(first_half) / len(first_half)
        avg_second = sum(second_half) / len(second_half)

        diff = avg_second - avg_first

        if abs(diff) < 2.0:  # 變化小於 2%
            return "stable"
        if diff > 0:
            return "increasing"
        return "decreasing"

    def force_cleanup(self):
        """手動觸發清理操作"""
        debug_log("手動觸發內存清理")
        self._trigger_cleanup()

    def force_emergency_cleanup(self):
        """手動觸發緊急清理操作"""
        debug_log("手動觸發緊急內存清理")
        self._trigger_emergency_cleanup()

    def reset_stats(self):
        """重置統計數據"""
        self.snapshots.clear()
        self.alerts.clear()
        self.cleanup_triggers_count = 0
        self.start_time = datetime.now() if self.is_monitoring else None
        debug_log("內存監控統計數據已重置")

    def export_memory_data(self) -> dict[str, Any]:
        """導出內存數據"""
        return {
            "config": {
                "warning_threshold": self.warning_threshold,
                "critical_threshold": self.critical_threshold,
                "emergency_threshold": self.emergency_threshold,
                "monitoring_interval": self.monitoring_interval,
            },
            "current_info": self.get_current_memory_info(),
            "stats": self.get_memory_stats().__dict__,
            "recent_alerts": [
                {
                    "level": alert.level,
                    "message": alert.message,
                    "timestamp": alert.timestamp.isoformat(),
                    "memory_percent": alert.memory_percent,
                    "recommended_action": alert.recommended_action,
                }
                for alert in self.get_recent_alerts()
            ],
            "is_monitoring": self.is_monitoring,
        }


# 全域內存監控器實例
_memory_monitor: MemoryMonitor | None = None
_monitor_lock = threading.Lock()


def get_memory_monitor() -> MemoryMonitor:
    """獲取全域內存監控器實例"""
    global _memory_monitor
    if _memory_monitor is None:
        with _monitor_lock:
            if _memory_monitor is None:
                _memory_monitor = MemoryMonitor()
    return _memory_monitor
