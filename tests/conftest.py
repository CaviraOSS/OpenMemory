#!/usr/bin/env python3
"""
測試配置和共用 fixtures
"""

import asyncio
import os
import shutil
import tempfile
from collections.abc import Generator
from pathlib import Path
from typing import Any

import pytest

# 使用正確的模組導入，不手動修改 sys.path
from mcp_feedback_enhanced.i18n import get_i18n_manager
from mcp_feedback_enhanced.web.main import WebUIManager


@pytest.fixture(scope="session")
def event_loop():
    """創建事件循環 fixture"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def temp_dir() -> Generator[Path, None, None]:
    """創建臨時目錄 fixture"""
    temp_path = Path(tempfile.mkdtemp())
    yield temp_path
    shutil.rmtree(temp_path, ignore_errors=True)


@pytest.fixture
def test_project_dir(temp_dir: Path) -> Path:
    """創建測試專案目錄"""
    project_dir = temp_dir / "test_project"
    project_dir.mkdir()

    # 創建一些測試文件
    (project_dir / "README.md").write_text("# Test Project")
    (project_dir / "main.py").write_text("print('Hello World')")

    return project_dir


@pytest.fixture
def web_ui_manager() -> Generator[WebUIManager, None, None]:
    """創建 WebUIManager fixture"""
    import os

    # 設置測試模式環境變數
    original_test_mode = os.environ.get("MCP_TEST_MODE")
    original_web_host = os.environ.get("MCP_WEB_HOST")
    original_web_port = os.environ.get("MCP_WEB_PORT")

    os.environ["MCP_TEST_MODE"] = "true"
    os.environ["MCP_WEB_HOST"] = "127.0.0.1"  # 確保測試使用本地主機
    # 使用動態端口範圍避免衝突
    os.environ["MCP_WEB_PORT"] = "0"  # 讓系統自動分配端口

    try:
        manager = WebUIManager()  # 使用環境變數控制主機和端口
        yield manager
    finally:
        # 恢復原始環境變數
        if original_test_mode is not None:
            os.environ["MCP_TEST_MODE"] = original_test_mode
        else:
            os.environ.pop("MCP_TEST_MODE", None)

        if original_web_host is not None:
            os.environ["MCP_WEB_HOST"] = original_web_host
        else:
            os.environ.pop("MCP_WEB_HOST", None)

        if original_web_port is not None:
            os.environ["MCP_WEB_PORT"] = original_web_port
        else:
            os.environ.pop("MCP_WEB_PORT", None)

        # 清理
        if manager.server_thread and manager.server_thread.is_alive():
            # 這裡可以添加服務器停止邏輯
            pass


@pytest.fixture
def i18n_manager():
    """創建 I18N 管理器 fixture"""
    return get_i18n_manager()


@pytest.fixture
def test_config() -> dict[str, Any]:
    """測試配置 fixture"""
    return {
        "timeout": 30,
        "debug": True,
        "web_port": 8765,
        "test_summary": "測試摘要 - 這是一個自動化測試",
        "test_feedback": "這是測試回饋內容",
    }


@pytest.fixture(autouse=True)
def setup_test_env():
    """自動設置測試環境"""
    # 設置測試環境變數
    original_debug = os.environ.get("MCP_DEBUG")
    os.environ["MCP_DEBUG"] = "true"

    yield

    # 恢復原始環境
    if original_debug is not None:
        os.environ["MCP_DEBUG"] = original_debug
    else:
        os.environ.pop("MCP_DEBUG", None)
