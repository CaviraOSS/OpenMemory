"""
資源管理器測試模組

測試 ResourceManager 類的各項功能，包括：
- 臨時文件和目錄管理
- 進程註冊和清理
- 自動清理機制
- 資源統計和監控
"""

import os
import subprocess
import time
from unittest.mock import patch

import pytest

# 移除手動路徑操作，讓 mypy 和 pytest 使用正確的模組解析
from mcp_feedback_enhanced.utils.resource_manager import (
    ResourceManager,
    cleanup_all_resources,
    create_temp_dir,
    create_temp_file,
    get_resource_manager,
)


class TestResourceManager:
    """資源管理器測試類"""

    def setup_method(self):
        """每個測試方法前的設置"""
        # 重置單例實例
        ResourceManager._instance = None

        # 重置全局資源管理器實例
        import mcp_feedback_enhanced.utils.resource_manager as rm_module

        rm_module._resource_manager = None

    def test_singleton_pattern(self):
        """測試單例模式"""
        rm1 = ResourceManager()
        rm2 = ResourceManager()
        rm3 = get_resource_manager()

        assert rm1 is rm2
        assert rm2 is rm3
        assert id(rm1) == id(rm2) == id(rm3)

    def test_create_temp_file(self):
        """測試創建臨時文件"""
        rm = get_resource_manager()

        # 測試基本創建
        temp_file = rm.create_temp_file(suffix=".txt", prefix="test_")

        assert isinstance(temp_file, str)
        assert os.path.exists(temp_file)
        assert temp_file.endswith(".txt")
        assert "test_" in os.path.basename(temp_file)
        assert temp_file in rm.temp_files

        # 清理
        os.remove(temp_file)

    def test_create_temp_dir(self):
        """測試創建臨時目錄"""
        rm = get_resource_manager()

        # 測試基本創建
        temp_dir = rm.create_temp_dir(suffix="_test", prefix="test_")

        assert isinstance(temp_dir, str)
        assert os.path.exists(temp_dir)
        assert os.path.isdir(temp_dir)
        assert temp_dir.endswith("_test")
        assert "test_" in os.path.basename(temp_dir)
        assert temp_dir in rm.temp_dirs

        # 清理
        os.rmdir(temp_dir)

    def test_convenience_functions(self):
        """測試便捷函數"""
        # 測試 create_temp_file 便捷函數
        temp_file = create_temp_file(suffix=".log", prefix="conv_")
        assert isinstance(temp_file, str)
        assert os.path.exists(temp_file)
        assert temp_file.endswith(".log")

        # 測試 create_temp_dir 便捷函數
        temp_dir = create_temp_dir(suffix="_conv", prefix="conv_")
        assert isinstance(temp_dir, str)
        assert os.path.exists(temp_dir)
        assert os.path.isdir(temp_dir)

        # 清理
        os.remove(temp_file)
        os.rmdir(temp_dir)

    def test_register_process_with_popen(self):
        """測試註冊 Popen 進程"""
        rm = get_resource_manager()

        # 創建一個簡單的進程
        process = subprocess.Popen(
            ["python", "-c", "import time; time.sleep(0.1)"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        # 註冊進程
        pid = rm.register_process(process, description="測試進程")

        assert pid == process.pid
        assert pid in rm.processes
        assert rm.processes[pid]["description"] == "測試進程"
        assert rm.processes[pid]["process"] is process

        # 等待進程結束
        process.wait()

    def test_register_process_with_pid(self):
        """測試註冊 PID"""
        rm = get_resource_manager()

        # 使用當前進程的 PID
        current_pid = os.getpid()

        # 註冊 PID
        registered_pid = rm.register_process(current_pid, description="當前進程")

        assert registered_pid == current_pid
        assert current_pid in rm.processes
        assert rm.processes[current_pid]["description"] == "當前進程"
        assert rm.processes[current_pid]["process"] is None

    def test_unregister_temp_file(self):
        """測試取消臨時文件追蹤"""
        rm = get_resource_manager()

        # 創建臨時文件
        temp_file = rm.create_temp_file()
        assert temp_file in rm.temp_files

        # 取消追蹤
        result = rm.unregister_temp_file(temp_file)
        assert result is True
        assert temp_file not in rm.temp_files

        # 再次取消追蹤（應該返回 False）
        result = rm.unregister_temp_file(temp_file)
        assert result is False

        # 清理
        if os.path.exists(temp_file):
            os.remove(temp_file)

    def test_unregister_process(self):
        """測試取消進程追蹤"""
        rm = get_resource_manager()

        # 註冊進程
        current_pid = os.getpid()
        rm.register_process(current_pid, description="測試進程")
        assert current_pid in rm.processes

        # 取消追蹤
        result = rm.unregister_process(current_pid)
        assert result is True
        assert current_pid not in rm.processes

        # 再次取消追蹤（應該返回 False）
        result = rm.unregister_process(current_pid)
        assert result is False

    def test_cleanup_temp_files(self):
        """測試清理臨時文件"""
        rm = get_resource_manager()

        # 創建多個臨時文件
        temp_files = []
        for i in range(3):
            temp_file = rm.create_temp_file(prefix=f"cleanup_test_{i}_")
            temp_files.append(temp_file)

        # 確認文件都存在
        for temp_file in temp_files:
            assert os.path.exists(temp_file)
            assert temp_file in rm.temp_files

        # 等待一小段時間讓文件有年齡
        time.sleep(0.1)

        # 執行清理（max_age=0 清理所有文件）
        cleaned_count = rm.cleanup_temp_files(max_age=0)

        assert cleaned_count == 3
        for temp_file in temp_files:
            assert not os.path.exists(temp_file)
            assert temp_file not in rm.temp_files

    def test_cleanup_temp_dirs(self):
        """測試清理臨時目錄"""
        rm = get_resource_manager()

        # 創建多個臨時目錄
        temp_dirs = []
        for i in range(2):
            temp_dir = rm.create_temp_dir(prefix=f"cleanup_test_{i}_")
            temp_dirs.append(temp_dir)

        # 確認目錄都存在
        for temp_dir in temp_dirs:
            assert os.path.exists(temp_dir)
            assert temp_dir in rm.temp_dirs

        # 執行清理
        cleaned_count = rm.cleanup_temp_dirs()

        assert cleaned_count == 2
        for temp_dir in temp_dirs:
            assert not os.path.exists(temp_dir)
            assert temp_dir not in rm.temp_dirs

    def test_cleanup_all(self):
        """測試全面清理"""
        rm = get_resource_manager()

        # 創建各種資源
        temp_file = rm.create_temp_file(prefix="cleanup_all_")
        temp_dir = rm.create_temp_dir(prefix="cleanup_all_")

        # 註冊進程
        current_pid = os.getpid()
        rm.register_process(current_pid, description="測試進程", auto_cleanup=False)

        # 等待一小段時間讓文件有年齡
        time.sleep(0.1)

        # 執行全面清理
        results = rm.cleanup_all()

        assert isinstance(results, dict)
        assert "temp_files" in results
        assert "temp_dirs" in results
        assert "processes" in results
        assert "file_handles" in results

        # 檢查文件和目錄是否被清理
        assert not os.path.exists(temp_file)
        assert not os.path.exists(temp_dir)
        assert temp_file not in rm.temp_files
        assert temp_dir not in rm.temp_dirs

        # 進程不應該被清理（auto_cleanup=False）
        assert current_pid in rm.processes

    def test_get_resource_stats(self):
        """測試獲取資源統計"""
        rm = get_resource_manager()

        # 創建一些資源
        temp_file = rm.create_temp_file()
        temp_dir = rm.create_temp_dir()
        rm.register_process(os.getpid(), description="統計測試")

        # 獲取統計
        stats = rm.get_resource_stats()

        assert isinstance(stats, dict)
        assert "current_temp_files" in stats
        assert "current_temp_dirs" in stats
        assert "current_processes" in stats
        assert "temp_files_created" in stats
        assert "temp_dirs_created" in stats
        assert "auto_cleanup_enabled" in stats

        assert stats["current_temp_files"] >= 1
        assert stats["current_temp_dirs"] >= 1
        assert stats["current_processes"] >= 1

        # 清理
        os.remove(temp_file)
        os.rmdir(temp_dir)

    def test_get_detailed_info(self):
        """測試獲取詳細信息"""
        rm = get_resource_manager()

        # 創建一些資源
        temp_file = rm.create_temp_file(prefix="detail_test_")
        rm.register_process(os.getpid(), description="詳細信息測試")

        # 獲取詳細信息
        info = rm.get_detailed_info()

        assert isinstance(info, dict)
        assert "temp_files" in info
        assert "temp_dirs" in info
        assert "processes" in info
        assert "stats" in info

        assert temp_file in info["temp_files"]
        assert os.getpid() in info["processes"]
        assert info["processes"][os.getpid()]["description"] == "詳細信息測試"

        # 清理
        os.remove(temp_file)

    def test_configure(self):
        """測試配置功能"""
        rm = get_resource_manager()

        # 測試配置更新
        rm.configure(
            auto_cleanup_enabled=False, cleanup_interval=120, temp_file_max_age=1800
        )

        assert rm.auto_cleanup_enabled is False
        assert rm.cleanup_interval == 120
        assert rm.temp_file_max_age == 1800

        # 測試最小值限制
        rm.configure(
            cleanup_interval=30,  # 小於最小值 60
            temp_file_max_age=100,  # 小於最小值 300
        )

        assert rm.cleanup_interval == 60  # 應該被限制為最小值
        assert rm.temp_file_max_age == 300  # 應該被限制為最小值

    def test_cleanup_all_convenience_function(self):
        """測試全面清理便捷函數"""
        # 創建一些資源
        temp_file = create_temp_file(prefix="conv_cleanup_")
        temp_dir = create_temp_dir(prefix="conv_cleanup_")

        # 執行清理
        results = cleanup_all_resources()

        assert isinstance(results, dict)
        assert not os.path.exists(temp_file)
        assert not os.path.exists(temp_dir)

    def test_error_handling(self):
        """測試錯誤處理"""
        rm = get_resource_manager()

        # 測試創建臨時文件時的錯誤處理
        with patch("tempfile.mkstemp", side_effect=OSError("Mock error")):
            with pytest.raises(OSError):
                rm.create_temp_file()

        # 測試創建臨時目錄時的錯誤處理
        with patch("tempfile.mkdtemp", side_effect=OSError("Mock error")):
            with pytest.raises(OSError):
                rm.create_temp_dir()

    def test_file_handle_registration(self):
        """測試文件句柄註冊"""
        rm = get_resource_manager()

        # 創建一個文件句柄
        temp_file = rm.create_temp_file()
        with open(temp_file, "w") as f:
            f.write("test")
            rm.register_file_handle(f)

            # 檢查是否註冊成功
            assert len(rm.file_handles) > 0

        # 清理
        os.remove(temp_file)

    def test_auto_cleanup_thread(self):
        """測試自動清理線程"""
        rm = get_resource_manager()

        # 確保自動清理已啟動
        assert rm.auto_cleanup_enabled is True
        assert rm._cleanup_thread is not None
        assert rm._cleanup_thread.is_alive()

        # 測試停止自動清理
        # 修復 unreachable 錯誤 - 確保方法調用後的代碼可達
        try:
            rm.stop_auto_cleanup()
        except Exception:
            pass  # 忽略可能的異常
        assert rm._cleanup_thread is None

        # 重新啟動
        rm.configure(auto_cleanup_enabled=True)  # type: ignore[unreachable]
        assert rm._cleanup_thread is not None


if __name__ == "__main__":
    # 運行測試
    pytest.main([__file__, "-v"])
