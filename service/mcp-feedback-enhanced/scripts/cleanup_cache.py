#!/usr/bin/env python3
"""
UV Cache 清理腳本
================

定期清理 uv cache 以防止磁碟空間不斷增加
特別針對 Windows 系統「檔案正由另一個程序使用」的問題提供解決方案

使用方式：
  python scripts/cleanup_cache.py --size       # 查看 cache 大小和詳細資訊
  python scripts/cleanup_cache.py --dry-run    # 預覽將要清理的內容（不實際清理）
  python scripts/cleanup_cache.py --clean      # 執行標準清理
  python scripts/cleanup_cache.py --force      # 強制清理（會嘗試關閉相關程序）

功能特色：
  - 智能跳過正在使用中的檔案
  - 提供強制清理模式
  - 詳細的清理統計和進度顯示
  - 支援 Windows/macOS/Linux 跨平台
"""

import argparse
import os
import subprocess
from pathlib import Path


def get_cache_dir():
    """取得 uv cache 目錄"""
    # Windows 預設路徑
    if os.name == "nt":
        return Path.home() / "AppData" / "Local" / "uv"
    # macOS/Linux 預設路徑
    return Path.home() / ".cache" / "uv"


def get_cache_size(cache_dir):
    """計算 cache 目錄大小"""
    if not cache_dir.exists():
        return 0

    total_size = 0
    for dirpath, dirnames, filenames in os.walk(cache_dir):
        for filename in filenames:
            filepath = os.path.join(dirpath, filename)
            try:
                total_size += os.path.getsize(filepath)
            except (OSError, FileNotFoundError):
                pass
    return total_size


def format_size(size_bytes):
    """格式化檔案大小顯示"""
    if size_bytes == 0:
        return "0 B"

    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"


def run_uv_command(command, check=True):
    """執行 uv 命令"""
    try:
        result = subprocess.run(
            ["uv"] + command, capture_output=True, text=True, check=check
        )
        return result
    except subprocess.CalledProcessError as e:
        print(f"❌ 命令執行失敗: uv {' '.join(command)}")
        print(f"錯誤: {e.stderr}")
        return None
    except FileNotFoundError:
        print("❌ 找不到 uv 命令，請確認 uv 已正確安裝")
        return None


def show_cache_info():
    """顯示 cache 資訊"""
    print("🔍 UV Cache 資訊")
    print("=" * 50)

    cache_dir = get_cache_dir()
    print(f"Cache 目錄: {cache_dir}")

    if cache_dir.exists():
        cache_size = get_cache_size(cache_dir)
        print(f"Cache 大小: {format_size(cache_size)}")

        # 顯示子目錄大小
        subdirs = []
        for subdir in cache_dir.iterdir():
            if subdir.is_dir():
                subdir_size = get_cache_size(subdir)
                subdirs.append((subdir.name, subdir_size))

        if subdirs:
            print("\n📁 子目錄大小:")
            subdirs.sort(key=lambda x: x[1], reverse=True)
            for name, size in subdirs[:10]:  # 顯示前10大
                print(f"  {name}: {format_size(size)}")
    else:
        print("Cache 目錄不存在")


def clean_cache_selective(cache_dir, dry_run=False):
    """選擇性清理 cache，跳過正在使用的檔案"""
    cleaned_count = 0
    skipped_count = 0
    total_saved = 0

    print(f"🔍 掃描 cache 目錄: {cache_dir}")

    # 遍歷 cache 目錄
    for root, dirs, files in os.walk(cache_dir):
        # 跳過一些可能正在使用的目錄
        if any(skip_dir in root for skip_dir in ["Scripts", "Lib", "pyvenv.cfg"]):
            continue

        for file in files:
            file_path = Path(root) / file
            try:
                if dry_run:
                    file_size = file_path.stat().st_size
                    total_saved += file_size
                    cleaned_count += 1
                    if cleaned_count <= 10:  # 只顯示前10個
                        print(
                            f"  將清理: {file_path.relative_to(cache_dir)} ({format_size(file_size)})"
                        )
                else:
                    file_size = file_path.stat().st_size
                    file_path.unlink()
                    total_saved += file_size
                    cleaned_count += 1
            except (OSError, PermissionError, FileNotFoundError):
                skipped_count += 1
                if not dry_run and skipped_count <= 5:  # 只顯示前5個錯誤
                    print(f"  ⚠️  跳過: {file_path.name} (正在使用中)")

    return cleaned_count, skipped_count, total_saved


def clean_cache(dry_run=False):
    """清理 cache"""
    action = "預覽" if dry_run else "執行"
    print(f"🧹 {action} UV Cache 清理")
    print("=" * 50)

    # 顯示清理前的大小
    cache_dir = get_cache_dir()
    if cache_dir.exists():
        before_size = get_cache_size(cache_dir)
        print(f"清理前大小: {format_size(before_size)}")
    else:
        print("Cache 目錄不存在，無需清理")
        return

    if dry_run:
        print("\n🔍 將要清理的內容:")
        # 先嘗試 uv cache clean --dry-run
        result = run_uv_command(["cache", "clean", "--dry-run"], check=False)
        if result and result.returncode == 0:
            print(result.stdout)
        else:
            print("  使用自定義掃描...")
            cleaned_count, skipped_count, total_saved = clean_cache_selective(
                cache_dir, dry_run=True
            )
            print("\n📊 預覽結果:")
            print(f"  可清理檔案: {cleaned_count}")
            print(f"  預計節省: {format_size(total_saved)}")
    else:
        print("\n🗑️  正在清理...")

        # 先嘗試標準清理
        result = run_uv_command(["cache", "clean"], check=False)
        if result and result.returncode == 0:
            print("✅ 標準 Cache 清理完成")
        else:
            print("⚠️  標準清理失敗，使用選擇性清理...")
            cleaned_count, skipped_count, total_saved = clean_cache_selective(
                cache_dir, dry_run=False
            )

            print("\n📊 清理結果:")
            print(f"  已清理檔案: {cleaned_count}")
            print(f"  跳過檔案: {skipped_count}")
            print(f"  節省空間: {format_size(total_saved)}")

            if skipped_count > 0:
                print(f"\n💡 提示: {skipped_count} 個檔案正在使用中，已跳過")
                print("   建議關閉相關程序後重新執行清理")

        # 顯示清理後的大小
        if cache_dir.exists():
            after_size = get_cache_size(cache_dir)
            saved_size = before_size - after_size
            print("\n📈 總體效果:")
            print(f"  清理前: {format_size(before_size)}")
            print(f"  清理後: {format_size(after_size)}")
            print(f"  實際節省: {format_size(saved_size)}")
        else:
            print(f"  節省空間: {format_size(before_size)}")


def force_clean_cache():
    """強制清理 cache（關閉相關程序後）"""
    print("🔥 強制清理模式")
    print("=" * 50)
    print("⚠️  警告：此模式會嘗試關閉可能使用 cache 的程序")

    confirm = input("確定要繼續嗎？(y/N): ")
    if confirm.lower() != "y":
        print("❌ 已取消")
        return

    cache_dir = get_cache_dir()
    if not cache_dir.exists():
        print("Cache 目錄不存在")
        return

    before_size = get_cache_size(cache_dir)
    print(f"清理前大小: {format_size(before_size)}")

    # 嘗試關閉可能的 uvx 程序
    print("\n🔍 檢查相關程序...")
    try:
        import psutil

        killed_processes = []
        for proc in psutil.process_iter(["pid", "name", "cmdline"]):
            try:
                if proc.info["name"] and any(
                    name in proc.info["name"].lower()
                    for name in ["uvx", "uv.exe", "python.exe"]
                ):
                    cmdline = " ".join(proc.info["cmdline"] or [])
                    if "mcp-feedback-enhanced" in cmdline or "uvx" in cmdline:
                        print(
                            f"  終止程序: {proc.info['name']} (PID: {proc.info['pid']})"
                        )
                        proc.terminate()
                        killed_processes.append(proc.info["pid"])
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

        if killed_processes:
            print(f"  已終止 {len(killed_processes)} 個程序")
            import time

            time.sleep(2)  # 等待程序完全關閉
        else:
            print("  未發現相關程序")

    except ImportError:
        print("  無法檢查程序（需要 psutil），繼續清理...")

    # 再次嘗試標準清理
    print("\n🗑️  執行清理...")
    result = run_uv_command(["cache", "clean"], check=False)
    if result and result.returncode == 0:
        print("✅ 強制清理成功")
    else:
        print("⚠️  標準清理仍然失敗，使用檔案級清理...")
        cleaned_count, skipped_count, total_saved = clean_cache_selective(
            cache_dir, dry_run=False
        )
        print(f"  清理檔案: {cleaned_count}, 跳過: {skipped_count}")

    # 顯示結果
    after_size = get_cache_size(cache_dir)
    saved_size = before_size - after_size
    print("\n📈 清理結果:")
    print(f"  節省空間: {format_size(saved_size)}")


def main():
    parser = argparse.ArgumentParser(description="UV Cache 清理工具")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--size", action="store_true", help="顯示 cache 大小資訊")
    group.add_argument(
        "--dry-run", action="store_true", help="預覽清理內容（不實際清理）"
    )
    group.add_argument("--clean", action="store_true", help="執行 cache 清理")
    group.add_argument(
        "--force", action="store_true", help="強制清理（會嘗試關閉相關程序）"
    )

    args = parser.parse_args()

    if args.size:
        show_cache_info()
    elif args.dry_run:
        clean_cache(dry_run=True)
    elif args.clean:
        clean_cache(dry_run=False)
    elif args.force:
        force_clean_cache()


if __name__ == "__main__":
    main()
