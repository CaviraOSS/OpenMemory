#!/usr/bin/env python3
"""
壓縮配置管理器
==============

管理 Web UI 的 Gzip 壓縮配置和靜態文件緩存策略。
支援可配置的壓縮參數和性能優化選項。
"""

import os
from dataclasses import dataclass, field
from typing import Any


@dataclass
class CompressionConfig:
    """壓縮配置類"""

    # Gzip 壓縮設定
    minimum_size: int = 1000  # 最小壓縮大小（bytes）
    compression_level: int = 6  # 壓縮級別 (1-9, 6為平衡點)

    # 緩存設定
    static_cache_max_age: int = 3600  # 靜態文件緩存時間（秒）
    api_cache_max_age: int = 0  # API 響應緩存時間（秒，0表示不緩存）

    # 支援的 MIME 類型
    compressible_types: list[str] = field(default_factory=list)

    # 排除的路徑
    exclude_paths: list[str] = field(default_factory=list)

    def __post_init__(self):
        """初始化後處理"""
        if not self.compressible_types:
            self.compressible_types = [
                "text/html",
                "text/css",
                "text/javascript",
                "text/plain",
                "application/json",
                "application/javascript",
                "application/xml",
                "application/rss+xml",
                "application/atom+xml",
                "image/svg+xml",
            ]

        if not self.exclude_paths:
            self.exclude_paths = [
                "/ws",  # WebSocket 連接
                "/api/ws",  # WebSocket API
                "/health",  # 健康檢查
            ]

    @classmethod
    def from_env(cls) -> "CompressionConfig":
        """從環境變數創建配置"""
        return cls(
            minimum_size=int(os.getenv("MCP_GZIP_MIN_SIZE", "1000")),
            compression_level=int(os.getenv("MCP_GZIP_LEVEL", "6")),
            static_cache_max_age=int(os.getenv("MCP_STATIC_CACHE_AGE", "3600")),
            api_cache_max_age=int(os.getenv("MCP_API_CACHE_AGE", "0")),
        )

    def should_compress(self, content_type: str, content_length: int) -> bool:
        """判斷是否應該壓縮"""
        if content_length < self.minimum_size:
            return False

        if not content_type:
            return False

        # 檢查 MIME 類型
        for mime_type in self.compressible_types:
            if content_type.startswith(mime_type):
                return True

        return False

    def should_exclude_path(self, path: str) -> bool:
        """判斷路徑是否應該排除壓縮"""
        for exclude_path in self.exclude_paths:
            if path.startswith(exclude_path):
                return True
        return False

    def get_cache_headers(self, path: str) -> dict[str, str]:
        """獲取緩存頭"""
        headers = {}

        if path.startswith("/static/"):
            # 靜態文件緩存
            headers["Cache-Control"] = f"public, max-age={self.static_cache_max_age}"
            headers["Expires"] = self._get_expires_header(self.static_cache_max_age)
        elif path.startswith("/api/") and self.api_cache_max_age > 0:
            # API 緩存（如果啟用）
            headers["Cache-Control"] = f"public, max-age={self.api_cache_max_age}"
            headers["Expires"] = self._get_expires_header(self.api_cache_max_age)
        else:
            # 其他路徑不緩存
            headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            headers["Pragma"] = "no-cache"
            headers["Expires"] = "0"

        return headers

    def _get_expires_header(self, max_age: int) -> str:
        """生成 Expires 頭"""
        from datetime import datetime, timedelta

        expires_time = datetime.utcnow() + timedelta(seconds=max_age)
        return expires_time.strftime("%a, %d %b %Y %H:%M:%S GMT")

    def get_compression_stats(self) -> dict[str, Any]:
        """獲取壓縮配置統計"""
        return {
            "minimum_size": self.minimum_size,
            "compression_level": self.compression_level,
            "static_cache_max_age": self.static_cache_max_age,
            "compressible_types_count": len(self.compressible_types),
            "exclude_paths_count": len(self.exclude_paths),
            "compressible_types": self.compressible_types,
            "exclude_paths": self.exclude_paths,
        }


class CompressionManager:
    """壓縮管理器"""

    def __init__(self, config: CompressionConfig | None = None):
        self.config = config or CompressionConfig.from_env()
        self._stats = {
            "requests_total": 0,
            "requests_compressed": 0,
            "bytes_original": 0,
            "bytes_compressed": 0,
            "compression_ratio": 0.0,
        }

    def update_stats(
        self, original_size: int, compressed_size: int, was_compressed: bool
    ):
        """更新壓縮統計"""
        self._stats["requests_total"] += 1
        self._stats["bytes_original"] += original_size

        if was_compressed:
            self._stats["requests_compressed"] += 1
            self._stats["bytes_compressed"] += compressed_size
        else:
            self._stats["bytes_compressed"] += original_size

        # 計算壓縮比率
        if self._stats["bytes_original"] > 0:
            self._stats["compression_ratio"] = (
                1 - self._stats["bytes_compressed"] / self._stats["bytes_original"]
            ) * 100

    def get_stats(self) -> dict[str, Any]:
        """獲取壓縮統計"""
        stats = self._stats.copy()
        stats["compression_percentage"] = (
            self._stats["requests_compressed"]
            / max(self._stats["requests_total"], 1)
            * 100
        )
        return stats

    def reset_stats(self):
        """重置統計"""
        self._stats = {
            "requests_total": 0,
            "requests_compressed": 0,
            "bytes_original": 0,
            "bytes_compressed": 0,
            "compression_ratio": 0.0,
        }


# 全域壓縮管理器實例
_compression_manager: CompressionManager | None = None


def get_compression_manager() -> CompressionManager:
    """獲取全域壓縮管理器實例"""
    global _compression_manager
    if _compression_manager is None:
        _compression_manager = CompressionManager()
    return _compression_manager
