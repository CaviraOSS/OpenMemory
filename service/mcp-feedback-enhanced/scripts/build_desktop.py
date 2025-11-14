#!/usr/bin/env python3
"""
桌面應用程式構建腳本

此腳本負責構建 Tauri 桌面應用程式和 Python 擴展模組，
確保在 PyPI 發布時包含預編譯的二進制檔案。

使用方法：
    python scripts/build_desktop.py [--release] [--clean]
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


def run_command(
    cmd: list[str], cwd: str = None, check: bool = True, show_info: bool = True
) -> subprocess.CompletedProcess:
    """執行命令並返回結果"""
    if show_info:
        print(f"🔧 執行命令: {' '.join(cmd)}")
        if cwd:
            print(f"📁 工作目錄: {cwd}")

    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=False)

    # 處理標準輸出
    if result.stdout and show_info:
        print("📤 輸出:")
        print(result.stdout.strip())

    # 智能處理標準錯誤 - 區分信息和真正的錯誤
    if result.stderr:
        stderr_lines = result.stderr.strip().split("\n")
        info_lines = []
        error_lines = []

        for line in stderr_lines:
            stripped_line = line.strip()
            if not stripped_line:
                continue
            # 識別信息性消息和正常編譯輸出
            if (
                stripped_line.startswith("info:")
                or "is up to date" in stripped_line
                or "downloading component" in stripped_line
                or "installing component" in stripped_line
                or stripped_line.startswith("Compiling")
                or stripped_line.startswith("Finished")
                or stripped_line.startswith("Building")
                or "target(s) in" in stripped_line
            ):
                info_lines.append(stripped_line)
            else:
                error_lines.append(stripped_line)

        # 顯示信息性消息
        if info_lines and show_info:
            print("ℹ️  信息:")
            for line in info_lines:
                print(f"   {line}")

        # 顯示真正的錯誤
        if error_lines:
            print("❌ 錯誤:")
            for line in error_lines:
                print(f"   {line}")

    if check and result.returncode != 0:
        raise subprocess.CalledProcessError(result.returncode, cmd)

    return result


def check_rust_environment():
    """檢查 Rust 開發環境"""
    print("🔍 檢查 Rust 開發環境...")

    try:
        result = run_command(["rustc", "--version"])
        print(f"✅ Rust 編譯器: {result.stdout.strip()}")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ 未找到 Rust 編譯器")
        print("💡 請安裝 Rust: https://rustup.rs/")
        return False

    try:
        result = run_command(["cargo", "--version"])
        print(f"✅ Cargo: {result.stdout.strip()}")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ 未找到 Cargo")
        return False

    try:
        result = run_command(["cargo", "install", "--list"])
        if "tauri-cli" in result.stdout:
            print("✅ Tauri CLI 已安裝")
        else:
            print("⚠️  Tauri CLI 未安裝，嘗試安裝...")
            run_command(["cargo", "install", "tauri-cli"])
            print("✅ Tauri CLI 安裝完成")
    except subprocess.CalledProcessError:
        print("❌ 無法安裝 Tauri CLI")
        return False

    return True


def install_rust_targets():
    """安裝跨平台編譯所需的 Rust targets"""
    print("🎯 安裝跨平台編譯 targets...")

    # 定義需要的 targets
    targets = [
        ("x86_64-pc-windows-msvc", "Windows x64"),
        ("x86_64-apple-darwin", "macOS Intel"),
        ("aarch64-apple-darwin", "macOS Apple Silicon"),
        ("x86_64-unknown-linux-gnu", "Linux x64"),
    ]

    installed_count = 0
    updated_count = 0

    for target, description in targets:
        print(f"📦 檢查 target: {target} ({description})")
        try:
            result = run_command(
                ["rustup", "target", "add", target], check=False, show_info=False
            )

            if result.returncode == 0:
                # 檢查是否是新安裝還是已存在
                if "is up to date" in result.stderr:
                    print(f"✅ {description} - 已是最新版本")
                    updated_count += 1
                elif "installing component" in result.stderr:
                    print(f"🆕 {description} - 新安裝完成")
                    installed_count += 1
                else:
                    print(f"✅ {description} - 安裝成功")
                    installed_count += 1
            else:
                print(f"⚠️  {description} - 安裝失敗")
                if result.stderr:
                    print(f"   錯誤: {result.stderr.strip()}")
        except Exception as e:
            print(f"⚠️  安裝 {description} 時發生錯誤: {e}")

    print(
        f"✅ Rust targets 檢查完成 (新安裝: {installed_count}, 已存在: {updated_count})"
    )


def clean_build_artifacts(project_root: Path):
    """清理構建產物"""
    print("🧹 清理構建產物...")

    # 清理 Rust 構建產物
    rust_target = project_root / "src-tauri" / "target"
    if rust_target.exists():
        print(f"清理 Rust target 目錄: {rust_target}")
        shutil.rmtree(rust_target)

    # 清理 Python 構建產物
    python_build_dirs = [
        project_root / "build",
        project_root / "dist",
        project_root / "*.egg-info",
    ]

    for build_dir in python_build_dirs:
        if build_dir.exists():
            print(f"清理 Python 構建目錄: {build_dir}")
            if build_dir.is_dir():
                shutil.rmtree(build_dir)
            else:
                build_dir.unlink()


def build_rust_extension(project_root: Path, release: bool = True):
    """構建 Rust 擴展模組"""
    print("🔨 構建 Rust 擴展模組...")

    src_tauri = project_root / "src-tauri"
    if not src_tauri.exists():
        raise FileNotFoundError(f"src-tauri 目錄不存在: {src_tauri}")

    # 構建 Rust 庫
    build_cmd = ["cargo", "build"]
    if release:
        build_cmd.append("--release")

    run_command(build_cmd, cwd=str(src_tauri))
    print("✅ Rust 擴展模組構建完成")


def build_tauri_app_multiplatform(project_root: Path, release: bool = True):
    """構建多平台 Tauri 桌面應用程式"""
    print("🖥️ 構建多平台 Tauri 桌面應用程式...")

    src_tauri = project_root / "src-tauri"

    # 定義目標平台
    targets = [
        ("x86_64-pc-windows-msvc", "mcp-feedback-enhanced-desktop.exe"),
        ("x86_64-apple-darwin", "mcp-feedback-enhanced-desktop"),
        ("aarch64-apple-darwin", "mcp-feedback-enhanced-desktop"),
        ("x86_64-unknown-linux-gnu", "mcp-feedback-enhanced-desktop"),
    ]

    successful_builds = []

    # 平台描述映射
    platform_descriptions = {
        "x86_64-pc-windows-msvc": "Windows x64",
        "x86_64-apple-darwin": "macOS Intel",
        "aarch64-apple-darwin": "macOS Apple Silicon",
        "x86_64-unknown-linux-gnu": "Linux x64",
    }

    for target, binary_name in targets:
        description = platform_descriptions.get(target, target)
        print(f"🔨 構建 {description} ({target})...")

        # 構建命令
        build_cmd = [
            "cargo",
            "build",
            "--bin",
            "mcp-feedback-enhanced-desktop",
            "--target",
            target,
        ]
        if release:
            build_cmd.append("--release")

        try:
            run_command(build_cmd, cwd=str(src_tauri), show_info=False)
            successful_builds.append((target, binary_name))
            print(f"✅ {description} 構建成功")
        except subprocess.CalledProcessError as e:
            print(f"⚠️  {description} 構建失敗")
            print("💡 可能缺少該平台的編譯工具鏈或依賴")
            # 顯示具體錯誤信息
            if hasattr(e, "stderr") and e.stderr:
                print(f"   錯誤詳情: {e.stderr.strip()}")
        except Exception as e:
            print(f"❌ {description} 構建時發生未預期錯誤: {e}")

    if successful_builds:
        print(f"✅ 成功構建 {len(successful_builds)} 個平台")

        # 如果只構建了當前平台，給出提示
        if len(successful_builds) == 1:
            print("")
            print("💡 注意：只成功構建了當前平台的二進制文件")
            print("   其他平台的構建失敗通常是因為缺少跨平台編譯工具鏈")
            print("   完整的多平台支援將在 GitHub Actions CI 中完成")
            print("   發佈到 PyPI 時會包含所有平台的二進制文件")

        return successful_builds
    print("❌ 所有平台構建都失敗了")
    return []


def copy_multiplatform_artifacts(
    project_root: Path, successful_builds: list, release: bool = True
):
    """複製多平台構建產物到適當位置"""
    print("📦 複製多平台構建產物...")

    src_tauri = project_root / "src-tauri"
    build_type = "release" if release else "debug"

    # 創建目標目錄
    desktop_dir = project_root / "src" / "mcp_feedback_enhanced" / "desktop_release"
    desktop_dir.mkdir(parents=True, exist_ok=True)

    # 定義平台到文件名的映射
    platform_mapping = {
        "x86_64-pc-windows-msvc": "mcp-feedback-enhanced-desktop.exe",
        "x86_64-apple-darwin": "mcp-feedback-enhanced-desktop-macos-intel",
        "aarch64-apple-darwin": "mcp-feedback-enhanced-desktop-macos-arm64",
        "x86_64-unknown-linux-gnu": "mcp-feedback-enhanced-desktop-linux",
    }

    copied_files = []

    for target, original_binary_name in successful_builds:
        # 源文件路徑
        src_file = src_tauri / "target" / target / build_type / original_binary_name

        # 目標文件名
        dst_filename = platform_mapping.get(target, original_binary_name)
        dst_file = desktop_dir / dst_filename

        if src_file.exists():
            shutil.copy2(src_file, dst_file)
            # 設置執行權限（非 Windows）
            # 0o755 權限是必要的，因為這些是可執行的二進制檔案
            if not dst_filename.endswith(".exe"):
                os.chmod(dst_file, 0o755)  # noqa: S103
            copied_files.append(dst_filename)
            print(f"✅ 複製 {target} 二進制檔案: {src_file} -> {dst_file}")
        else:
            print(f"⚠️  找不到 {target} 的二進制檔案: {src_file}")

    if not copied_files:
        print("⚠️  沒有找到可複製的二進制檔案")
        return False

    # 創建 __init__.py 文件，讓 desktop 目錄成為 Python 包
    desktop_init = desktop_dir / "__init__.py"
    if not desktop_init.exists():
        desktop_init.write_text('"""桌面應用程式二進制檔案"""', encoding="utf-8")
        print(f"✅ 創建 __init__.py: {desktop_init}")

    print(f"✅ 成功複製 {len(copied_files)} 個平台的二進制檔案")
    return True


def copy_desktop_python_module(project_root: Path):
    """複製桌面應用 Python 模組到發佈位置"""
    print("📦 複製桌面應用 Python 模組...")

    # 源路徑和目標路徑
    python_src = project_root / "src-tauri" / "python" / "mcp_feedback_enhanced_desktop"
    python_dst = project_root / "src" / "mcp_feedback_enhanced" / "desktop_app"

    if not python_src.exists():
        print(f"⚠️  源模組不存在: {python_src}")
        return False

    # 如果目標目錄存在，先刪除
    if python_dst.exists():
        shutil.rmtree(python_dst)
        print(f"🗑️  清理舊的模組目錄: {python_dst}")

    # 複製模組
    shutil.copytree(python_src, python_dst)
    print(f"✅ 複製桌面應用模組: {python_src} -> {python_dst}")

    return True


def main():
    """主函數"""
    parser = argparse.ArgumentParser(
        description="構建 MCP Feedback Enhanced 桌面應用程式",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
範例:
  python scripts/build_desktop.py                # 構建 Debug 版本
  python scripts/build_desktop.py --release      # 構建 Release 版本
  python scripts/build_desktop.py --clean        # 清理構建產物

構建完成後，可以使用以下命令測試:
  python -m mcp_feedback_enhanced test --desktop

或使用 Makefile:
  make build-desktop          # 構建 Debug 版本
  make build-desktop-release  # 構建 Release 版本
  make test-desktop          # 構建並測試
        """,
    )
    parser.add_argument(
        "--release", action="store_true", help="構建發布版本 (預設為 Debug)"
    )
    parser.add_argument("--clean", action="store_true", help="清理構建產物")

    args = parser.parse_args()

    # 獲取專案根目錄
    project_root = Path(__file__).parent.parent.resolve()
    print(f"專案根目錄: {project_root}")

    try:
        # 清理構建產物（如果需要）
        if args.clean:
            clean_build_artifacts(project_root)

        # 檢查 Rust 環境
        if not check_rust_environment():
            sys.exit(1)

        # 安裝跨平台編譯 targets
        install_rust_targets()

        # 構建 Rust 擴展
        build_rust_extension(project_root, args.release)

        # 構建多平台 Tauri 應用程式
        successful_builds = build_tauri_app_multiplatform(project_root, args.release)

        if not successful_builds:
            print("❌ 沒有成功構建任何平台")
            sys.exit(1)

        # 複製多平台構建產物
        if not copy_multiplatform_artifacts(
            project_root, successful_builds, args.release
        ):
            print("⚠️  構建產物複製失敗，但 Rust 編譯成功")
            return

        # 複製桌面應用 Python 模組
        if not copy_desktop_python_module(project_root):
            print("⚠️  桌面應用模組複製失敗")
            return

        print("🎉 多平台桌面應用程式構建完成！")
        print("")
        print("📍 構建產物位置:")
        print("   多平台二進制檔案: src/mcp_feedback_enhanced/desktop_release/")
        print("   桌面應用模組: src/mcp_feedback_enhanced/desktop_app/")
        print("   開發環境模組: src-tauri/python/mcp_feedback_enhanced_desktop/")
        print("")
        print("🌍 支援的平台:")
        for target, _ in successful_builds:
            print(f"   ✅ {target}")
        print("")
        print("🚀 下一步:")
        print("   測試桌面應用程式: python -m mcp_feedback_enhanced test --desktop")
        print("   或使用 Makefile: make test-desktop")
        print("   構建發布包: make build-all")

    except Exception as e:
        print(f"❌ 構建失敗: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
