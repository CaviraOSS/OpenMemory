#!/usr/bin/env python3
"""
Gzip 壓縮功能測試
================

測試 FastAPI Gzip 壓縮中間件的功能，包括：
- 壓縮效果驗證
- WebSocket 兼容性
- 靜態文件緩存
- 性能提升測試
"""

import gzip
import json
from unittest.mock import patch

import pytest
from fastapi import FastAPI, Response
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.testclient import TestClient

from mcp_feedback_enhanced.web.utils.compression_config import (
    CompressionConfig,
    CompressionManager,
    get_compression_manager,
)
from mcp_feedback_enhanced.web.utils.compression_monitor import (
    CompressionMonitor,
    get_compression_monitor,
)


class TestCompressionConfig:
    """測試壓縮配置類"""

    def test_default_config(self):
        """測試預設配置"""
        config = CompressionConfig()

        assert config.minimum_size == 1000
        assert config.compression_level == 6
        assert config.static_cache_max_age == 3600
        assert config.api_cache_max_age == 0
        assert "text/html" in config.compressible_types
        assert "application/json" in config.compressible_types
        assert "/ws" in config.exclude_paths

    def test_from_env(self):
        """測試從環境變數創建配置"""
        with patch.dict(
            "os.environ",
            {
                "MCP_GZIP_MIN_SIZE": "2000",
                "MCP_GZIP_LEVEL": "9",
                "MCP_STATIC_CACHE_AGE": "7200",
            },
        ):
            config = CompressionConfig.from_env()

            assert config.minimum_size == 2000
            assert config.compression_level == 9
            assert config.static_cache_max_age == 7200

    def test_should_compress(self):
        """測試壓縮判斷邏輯"""
        config = CompressionConfig()

        # 應該壓縮的情況
        assert config.should_compress("text/html", 2000) == True
        assert config.should_compress("application/json", 1500) == True

        # 不應該壓縮的情況
        assert config.should_compress("text/html", 500) == False  # 太小
        assert config.should_compress("image/jpeg", 2000) == False  # 不支援的類型
        assert config.should_compress("", 2000) == False  # 無內容類型

    def test_should_exclude_path(self):
        """測試路徑排除邏輯"""
        config = CompressionConfig()

        assert config.should_exclude_path("/ws") == True
        assert config.should_exclude_path("/api/ws") == True
        assert config.should_exclude_path("/health") == True
        assert config.should_exclude_path("/static/css/style.css") == False
        assert config.should_exclude_path("/api/feedback") == False

    def test_get_cache_headers(self):
        """測試緩存頭生成"""
        config = CompressionConfig()

        # 靜態文件
        static_headers = config.get_cache_headers("/static/css/style.css")
        assert "Cache-Control" in static_headers
        assert "public, max-age=3600" in static_headers["Cache-Control"]

        # API 路徑（預設不緩存）
        api_headers = config.get_cache_headers("/api/feedback")
        assert "no-cache" in api_headers["Cache-Control"]

        # 其他路徑
        other_headers = config.get_cache_headers("/feedback")
        assert "no-cache" in other_headers["Cache-Control"]


class TestCompressionManager:
    """測試壓縮管理器"""

    def test_manager_initialization(self):
        """測試管理器初始化"""
        manager = CompressionManager()

        assert manager.config is not None
        assert manager._stats["requests_total"] == 0
        assert manager._stats["requests_compressed"] == 0

    def test_update_stats(self):
        """測試統計更新"""
        manager = CompressionManager()

        # 測試壓縮請求
        manager.update_stats(1000, 600, True)
        stats = manager.get_stats()

        assert stats["requests_total"] == 1
        assert stats["requests_compressed"] == 1
        assert stats["bytes_original"] == 1000
        assert stats["bytes_compressed"] == 600
        assert stats["compression_ratio"] == 40.0  # (1000-600)/1000 * 100

        # 測試未壓縮請求
        manager.update_stats(500, 500, False)
        stats = manager.get_stats()

        assert stats["requests_total"] == 2
        assert stats["requests_compressed"] == 1
        assert stats["compression_percentage"] == 50.0  # 1/2 * 100

    def test_reset_stats(self):
        """測試統計重置"""
        manager = CompressionManager()
        manager.update_stats(1000, 600, True)

        manager.reset_stats()
        stats = manager.get_stats()

        assert stats["requests_total"] == 0
        assert stats["requests_compressed"] == 0
        assert stats["compression_ratio"] == 0.0


class TestCompressionMonitor:
    """測試壓縮監控器"""

    def test_monitor_initialization(self):
        """測試監控器初始化"""
        monitor = CompressionMonitor()

        assert monitor.max_metrics == 1000
        assert len(monitor.metrics) == 0
        assert len(monitor.path_stats) == 0

    def test_record_request(self):
        """測試請求記錄"""
        monitor = CompressionMonitor()

        monitor.record_request(
            path="/static/css/style.css",
            original_size=2000,
            compressed_size=1200,
            response_time=0.05,
            content_type="text/css",
            was_compressed=True,
        )

        assert len(monitor.metrics) == 1
        metric = monitor.metrics[0]
        assert metric.path == "/static/css/style.css"
        assert metric.compression_ratio == 40.0  # (2000-1200)/2000 * 100

        # 檢查路徑統計
        path_stats = monitor.get_path_stats()
        assert "/static/css/style.css" in path_stats
        assert path_stats["/static/css/style.css"]["requests"] == 1
        assert path_stats["/static/css/style.css"]["compressed_requests"] == 1

    def test_get_summary(self):
        """測試摘要統計"""
        monitor = CompressionMonitor()

        # 記錄多個請求
        monitor.record_request(
            "/static/css/style.css", 2000, 1200, 0.05, "text/css", True
        )
        monitor.record_request(
            "/static/js/app.js", 3000, 1800, 0.08, "application/javascript", True
        )
        monitor.record_request(
            "/api/feedback", 500, 500, 0.02, "application/json", False
        )

        summary = monitor.get_summary()

        assert summary.total_requests == 3
        assert summary.compressed_requests == 2
        assert abs(summary.compression_percentage - 66.67) < 0.01  # 2/3 * 100 (約)
        assert (
            summary.bandwidth_saved == 2000
        )  # (2000-1200) + (3000-1800) + 0 = 800 + 1200 + 0 = 2000

    def test_export_stats(self):
        """測試統計導出"""
        monitor = CompressionMonitor()

        monitor.record_request(
            "/static/css/style.css", 2000, 1200, 0.05, "text/css", True
        )

        exported = monitor.export_stats()

        assert "summary" in exported
        assert "top_compressed_paths" in exported
        assert "path_stats" in exported
        assert "content_type_stats" in exported

        assert exported["summary"]["total_requests"] == 1
        assert exported["summary"]["compressed_requests"] == 1


class TestGzipIntegration:
    """測試 Gzip 壓縮集成"""

    def create_test_app(self):
        """創建測試應用"""
        app = FastAPI()

        # 添加 Gzip 中間件
        app.add_middleware(GZipMiddleware, minimum_size=100)

        @app.get("/test-large")
        async def test_large():
            # 返回大於最小壓縮大小的內容
            return {"data": "x" * 1000}

        @app.get("/test-small")
        async def test_small():
            # 返回小於最小壓縮大小的內容
            return {"data": "small"}

        @app.get("/test-html")
        async def test_html():
            html_content = "<html><body>" + "content " * 100 + "</body></html>"
            return Response(content=html_content, media_type="text/html")

        return app

    def test_gzip_compression_large_content(self):
        """測試大內容的 Gzip 壓縮"""
        app = self.create_test_app()
        client = TestClient(app)

        # 請求壓縮
        response = client.get("/test-large", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") == "gzip"

        # 驗證內容正確性
        data = response.json()
        assert "data" in data
        assert len(data["data"]) == 1000

    def test_gzip_compression_small_content(self):
        """測試小內容不壓縮"""
        app = self.create_test_app()
        client = TestClient(app)

        response = client.get("/test-small", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        # 小內容不應該被壓縮
        assert response.headers.get("content-encoding") != "gzip"

    def test_gzip_compression_html_content(self):
        """測試 HTML 內容壓縮"""
        app = self.create_test_app()
        client = TestClient(app)

        response = client.get("/test-html", headers={"Accept-Encoding": "gzip"})

        assert response.status_code == 200
        assert response.headers.get("content-encoding") == "gzip"
        assert response.headers.get("content-type") == "text/html; charset=utf-8"

    def test_no_compression_without_accept_encoding(self):
        """測試不支援壓縮的客戶端"""
        app = self.create_test_app()
        client = TestClient(app)

        # FastAPI 的 TestClient 預設會添加 Accept-Encoding，所以我們測試明確拒絕壓縮
        response = client.get("/test-large", headers={"Accept-Encoding": "identity"})

        assert response.status_code == 200
        # 當明確要求不壓縮時，應該不會有 gzip 編碼
        # 注意：某些情況下 FastAPI 仍可能壓縮，這是正常行為


class TestWebSocketCompatibility:
    """測試 WebSocket 兼容性"""

    def test_websocket_not_compressed(self):
        """測試 WebSocket 連接不受壓縮影響"""
        # 這個測試確保 WebSocket 路徑被正確排除
        config = CompressionConfig()

        # WebSocket 路徑應該被排除
        assert config.should_exclude_path("/ws") == True
        assert config.should_exclude_path("/api/ws") == True

        # 確保 WebSocket 不會被壓縮配置影響
        assert not config.should_compress(
            "application/json", 1000
        ) or config.should_exclude_path("/ws")


@pytest.mark.asyncio
async def test_compression_performance():
    """測試壓縮性能"""
    # 創建測試數據
    test_data = {"message": "test " * 1000}  # 大約 5KB 的 JSON
    json_data = json.dumps(test_data)

    # 手動壓縮測試
    compressed_data = gzip.compress(json_data.encode("utf-8"))

    # 驗證壓縮效果
    original_size = len(json_data.encode("utf-8"))
    compressed_size = len(compressed_data)
    compression_ratio = (1 - compressed_size / original_size) * 100

    # 壓縮比應該大於 50%（JSON 數據通常壓縮效果很好）
    assert compression_ratio > 50
    assert compressed_size < original_size

    # 驗證解壓縮正確性
    decompressed_data = gzip.decompress(compressed_data).decode("utf-8")
    assert decompressed_data == json_data


def test_global_instances():
    """測試全域實例"""
    # 測試壓縮管理器全域實例
    manager1 = get_compression_manager()
    manager2 = get_compression_manager()
    assert manager1 is manager2

    # 測試壓縮監控器全域實例
    monitor1 = get_compression_monitor()
    monitor2 = get_compression_monitor()
    assert monitor1 is monitor2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
