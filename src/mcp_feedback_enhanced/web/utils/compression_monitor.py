#!/usr/bin/env python3
"""
壓縮性能監控工具
================

監控 Gzip 壓縮的性能效果，包括壓縮比率、響應時間和文件大小統計。
提供實時性能數據和優化建議。
"""

import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta


@dataclass
class CompressionMetrics:
    """壓縮指標數據類"""

    timestamp: datetime
    path: str
    original_size: int
    compressed_size: int
    compression_ratio: float
    response_time: float
    content_type: str
    was_compressed: bool


@dataclass
class CompressionSummary:
    """壓縮摘要統計"""

    total_requests: int = 0
    compressed_requests: int = 0
    total_original_bytes: int = 0
    total_compressed_bytes: int = 0
    average_compression_ratio: float = 0.0
    average_response_time: float = 0.0
    compression_percentage: float = 0.0
    bandwidth_saved: int = 0
    top_compressed_paths: list[tuple[str, float]] = field(default_factory=list)


class CompressionMonitor:
    """壓縮性能監控器"""

    def __init__(self, max_metrics: int = 1000):
        self.max_metrics = max_metrics
        self.metrics: list[CompressionMetrics] = []
        self.lock = threading.Lock()
        self._start_time = datetime.now()

        # 路徑統計
        self.path_stats: dict[str, dict] = {}

        # 內容類型統計
        self.content_type_stats: dict[str, dict] = {}

    def record_request(
        self,
        path: str,
        original_size: int,
        compressed_size: int,
        response_time: float,
        content_type: str = "",
        was_compressed: bool = False,
    ):
        """記錄請求的壓縮數據"""

        compression_ratio = 0.0
        if original_size > 0 and was_compressed:
            compression_ratio = (1 - compressed_size / original_size) * 100

        metric = CompressionMetrics(
            timestamp=datetime.now(),
            path=path,
            original_size=original_size,
            compressed_size=compressed_size,
            compression_ratio=compression_ratio,
            response_time=response_time,
            content_type=content_type,
            was_compressed=was_compressed,
        )

        with self.lock:
            self.metrics.append(metric)

            # 限制記錄數量
            if len(self.metrics) > self.max_metrics:
                self.metrics = self.metrics[-self.max_metrics :]

            # 更新路徑統計
            self._update_path_stats(metric)

            # 更新內容類型統計
            self._update_content_type_stats(metric)

    def _update_path_stats(self, metric: CompressionMetrics):
        """更新路徑統計"""
        path = metric.path
        if path not in self.path_stats:
            self.path_stats[path] = {
                "requests": 0,
                "compressed_requests": 0,
                "total_original_bytes": 0,
                "total_compressed_bytes": 0,
                "total_response_time": 0.0,
                "best_compression_ratio": 0.0,
            }

        stats = self.path_stats[path]
        stats["requests"] += 1
        stats["total_original_bytes"] += metric.original_size
        stats["total_compressed_bytes"] += metric.compressed_size
        stats["total_response_time"] += metric.response_time

        if metric.was_compressed:
            stats["compressed_requests"] += 1
            stats["best_compression_ratio"] = max(
                stats["best_compression_ratio"], metric.compression_ratio
            )

    def _update_content_type_stats(self, metric: CompressionMetrics):
        """更新內容類型統計"""
        content_type = metric.content_type or "unknown"
        if content_type not in self.content_type_stats:
            self.content_type_stats[content_type] = {
                "requests": 0,
                "compressed_requests": 0,
                "total_original_bytes": 0,
                "total_compressed_bytes": 0,
                "average_compression_ratio": 0.0,
            }

        stats = self.content_type_stats[content_type]
        stats["requests"] += 1
        stats["total_original_bytes"] += metric.original_size
        stats["total_compressed_bytes"] += metric.compressed_size

        if metric.was_compressed:
            stats["compressed_requests"] += 1

            # 重新計算平均壓縮比
            if stats["total_original_bytes"] > 0:
                stats["average_compression_ratio"] = (
                    1 - stats["total_compressed_bytes"] / stats["total_original_bytes"]
                ) * 100

    def get_summary(self, time_window: timedelta | None = None) -> CompressionSummary:
        """獲取壓縮摘要統計"""
        with self.lock:
            metrics = self.metrics

            # 如果指定時間窗口，過濾數據
            if time_window:
                cutoff_time = datetime.now() - time_window
                metrics = [m for m in metrics if m.timestamp >= cutoff_time]

            if not metrics:
                return CompressionSummary()

            total_requests = len(metrics)
            compressed_requests = sum(1 for m in metrics if m.was_compressed)
            total_original_bytes = sum(m.original_size for m in metrics)
            total_compressed_bytes = sum(m.compressed_size for m in metrics)
            total_response_time = sum(m.response_time for m in metrics)

            # 計算統計數據
            compression_percentage = (
                (compressed_requests / total_requests * 100)
                if total_requests > 0
                else 0
            )
            average_compression_ratio = 0.0
            bandwidth_saved = 0

            if total_original_bytes > 0:
                average_compression_ratio = (
                    1 - total_compressed_bytes / total_original_bytes
                ) * 100
                bandwidth_saved = total_original_bytes - total_compressed_bytes

            average_response_time = (
                total_response_time / total_requests if total_requests > 0 else 0
            )

            # 獲取壓縮效果最好的路徑
            top_compressed_paths = self._get_top_compressed_paths()

            return CompressionSummary(
                total_requests=total_requests,
                compressed_requests=compressed_requests,
                total_original_bytes=total_original_bytes,
                total_compressed_bytes=total_compressed_bytes,
                average_compression_ratio=average_compression_ratio,
                average_response_time=average_response_time,
                compression_percentage=compression_percentage,
                bandwidth_saved=bandwidth_saved,
                top_compressed_paths=top_compressed_paths,
            )

    def _get_top_compressed_paths(self, limit: int = 5) -> list[tuple[str, float]]:
        """獲取壓縮效果最好的路徑"""
        path_ratios = []

        for path, stats in self.path_stats.items():
            if stats["compressed_requests"] > 0 and stats["total_original_bytes"] > 0:
                compression_ratio = (
                    1 - stats["total_compressed_bytes"] / stats["total_original_bytes"]
                ) * 100
                path_ratios.append((path, compression_ratio))

        # 按壓縮比排序
        path_ratios.sort(key=lambda x: x[1], reverse=True)
        return path_ratios[:limit]

    def get_path_stats(self) -> dict[str, dict]:
        """獲取路徑統計"""
        with self.lock:
            return self.path_stats.copy()

    def get_content_type_stats(self) -> dict[str, dict]:
        """獲取內容類型統計"""
        with self.lock:
            return self.content_type_stats.copy()

    def get_recent_metrics(self, limit: int = 100) -> list[CompressionMetrics]:
        """獲取最近的指標數據"""
        with self.lock:
            return self.metrics[-limit:] if self.metrics else []

    def reset_stats(self):
        """重置統計數據"""
        with self.lock:
            self.metrics.clear()
            self.path_stats.clear()
            self.content_type_stats.clear()
            self._start_time = datetime.now()

    def export_stats(self) -> dict:
        """導出統計數據為字典格式"""
        summary = self.get_summary()

        return {
            "summary": {
                "total_requests": summary.total_requests,
                "compressed_requests": summary.compressed_requests,
                "compression_percentage": round(summary.compression_percentage, 2),
                "average_compression_ratio": round(
                    summary.average_compression_ratio, 2
                ),
                "bandwidth_saved_mb": round(summary.bandwidth_saved / (1024 * 1024), 2),
                "average_response_time_ms": round(
                    summary.average_response_time * 1000, 2
                ),
                "monitoring_duration_hours": round(
                    (datetime.now() - self._start_time).total_seconds() / 3600, 2
                ),
            },
            "top_compressed_paths": [
                {"path": path, "compression_ratio": round(ratio, 2)}
                for path, ratio in summary.top_compressed_paths
            ],
            "path_stats": {
                path: {
                    "requests": stats["requests"],
                    "compression_percentage": round(
                        stats["compressed_requests"] / stats["requests"] * 100, 2
                    )
                    if stats["requests"] > 0
                    else 0,
                    "average_response_time_ms": round(
                        stats["total_response_time"] / stats["requests"] * 1000, 2
                    )
                    if stats["requests"] > 0
                    else 0,
                    "bandwidth_saved_kb": round(
                        (
                            stats["total_original_bytes"]
                            - stats["total_compressed_bytes"]
                        )
                        / 1024,
                        2,
                    ),
                }
                for path, stats in self.path_stats.items()
            },
            "content_type_stats": {
                content_type: {
                    "requests": stats["requests"],
                    "compression_percentage": round(
                        stats["compressed_requests"] / stats["requests"] * 100, 2
                    )
                    if stats["requests"] > 0
                    else 0,
                    "average_compression_ratio": round(
                        stats["average_compression_ratio"], 2
                    ),
                }
                for content_type, stats in self.content_type_stats.items()
            },
        }


# 全域監控器實例
_compression_monitor: CompressionMonitor | None = None


def get_compression_monitor() -> CompressionMonitor:
    """獲取全域壓縮監控器實例"""
    global _compression_monitor
    if _compression_monitor is None:
        _compression_monitor = CompressionMonitor()
    return _compression_monitor
