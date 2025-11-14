# GitHub Actions 工作流程說明

本項目使用雙工作流程架構來優化構建和發佈流程。

## 🏗️ 工作流程架構

### 1. 桌面應用構建工作流程 (build-desktop.yml)

**用途**: 專門負責構建多平台桌面應用二進制文件

**觸發條件**:
- 手動觸發 (workflow_dispatch)
- 桌面應用代碼變更時自動觸發 (`src-tauri/**`, `scripts/build_desktop.py`)
- Pull Request 中的桌面應用變更

**功能**:
- 在各自原生平台上構建桌面應用
- 支援選擇性平台構建
- 上傳構建產物到 GitHub Artifacts (保留 30 天)
- 提供詳細的構建摘要

**支援平台**:
- Windows x64 (`windows-latest`)
- macOS Intel (`macos-latest` + `x86_64-apple-darwin`)
- macOS Apple Silicon (`macos-latest` + `aarch64-apple-darwin`)
- Linux x64 (`ubuntu-latest`)

### 2. 發佈工作流程 (publish.yml)

**用途**: 負責版本管理和 PyPI 發佈

**觸發條件**:
- 手動觸發 (workflow_dispatch)

**功能**:
- 自動或手動版本號管理
- 可選擇是否包含桌面應用
- 從最新的桌面應用構建下載二進制文件
- 發佈到 PyPI
- 創建 GitHub Release

## 🚀 使用方式

### 開發桌面應用時

1. **修改桌面應用代碼** (`src-tauri/` 目錄)
2. **自動觸發構建** - 推送到 main 分支會自動觸發桌面應用構建
3. **手動觸發構建** (可選) - 在 GitHub Actions 頁面手動運行 "Build Desktop Applications"

### 發佈新版本時

1. **確保桌面應用已構建** - 檢查最新的 "Build Desktop Applications" 工作流程是否成功
2. **手動觸發發佈** - 在 GitHub Actions 頁面運行 "Auto Release to PyPI"
3. **選擇發佈選項**:
   - `version_type`: patch/minor/major (或使用 custom_version)
   - `include_desktop`: 是否包含桌面應用 (預設: true)
   - `desktop_build_run_id`: 指定特定的構建 ID (可選)

## 📋 最佳實踐

### 桌面應用構建

```bash
# 本地測試桌面應用構建
python scripts/build_desktop.py --release

# 檢查構建產物
ls -la src/mcp_feedback_enhanced/desktop_release/
ls -la src/mcp_feedback_enhanced/desktop_app/
```

### 發佈流程

1. **準備發佈**:
   - 更新 CHANGELOG 文件
   - 確保桌面應用構建成功
   - 測試本地功能

2. **執行發佈**:
   - 手動觸發 "Auto Release to PyPI" 工作流程
   - 選擇適當的版本類型
   - 確認包含桌面應用 (如果需要)

3. **發佈後驗證**:
   - 檢查 PyPI 上的新版本
   - 測試安裝: `uvx mcp-feedback-enhanced@latest`
   - 測試桌面模式: `uvx mcp-feedback-enhanced@latest test --desktop`

## 🚀 一鍵構建和發佈

### Build Desktop & Release 工作流程

最簡單的方式是使用 **Build Desktop & Release** 工作流程，它會自動：
1. 構建所有平台的桌面應用
2. 等待構建完成
3. 自動觸發發佈流程

**使用方法**：
1. 前往 [Build Desktop & Release](../../actions/workflows/build-and-release.yml)
2. 點擊 "Run workflow"
3. 選擇版本類型或輸入自定義版本
4. 選擇要構建的平台（默認：all）
5. 如果只想構建不發佈，勾選 "只構建桌面應用，不進行發佈"

**優勢**：
- ✅ 自動化整個流程
- ✅ 確保桌面應用構建成功後才發佈
- ✅ 統一的狀態報告
- ✅ 減少手動操作錯誤

## 🔧 故障排除

### 桌面應用構建失敗

1. **檢查構建日誌** - 查看 GitHub Actions 中的詳細錯誤信息
2. **平台特定問題**:
   - **macOS**: 可能缺少 Xcode 命令行工具或系統依賴
   - **Linux**: 可能缺少系統依賴 (GTK, WebKit, Cairo 等)
   - **Windows**: 通常構建成功，如失敗檢查 MSVC 工具鏈

### 發佈流程問題

1. **桌面應用缺失**:
   - 確認 "Build Desktop Applications" 工作流程已成功運行
   - 檢查指定的 Run ID 是否正確
   - 驗證 Artifacts 是否已正確上傳

2. **版本衝突**:
   - 檢查 PyPI 上是否已存在相同版本
   - 確認版本號格式正確 (X.Y.Z)

3. **權限問題**:
   - 確認 PYPI_API_TOKEN 密鑰已正確設置
   - 檢查 GitHub Token 權限

3. **本地測試** - 在對應平台上運行本地構建腳本

### 發佈時桌面應用缺失

1. **檢查構建狀態** - 確保最新的桌面應用構建成功
2. **手動指定構建** - 使用 `desktop_build_run_id` 參數指定特定的成功構建
3. **跳過桌面應用** - 設置 `include_desktop: false` 僅發佈 Web 版本

## 📊 工作流程優勢

### 效率提升
- **分離關注點**: 構建和發佈獨立進行
- **避免重複構建**: 不是每次發佈都需要重新構建桌面應用
- **快速發佈**: 發佈流程更快速，特別是僅修改 Python 代碼時

### 靈活性
- **選擇性構建**: 可以只構建特定平台
- **選擇性發佈**: 可以選擇是否包含桌面應用
- **版本控制**: 可以使用不同的桌面應用構建版本

### 可靠性
- **原生構建**: 每個平台在其原生環境中構建
- **構建緩存**: 利用 GitHub Actions 緩存加速構建
- **錯誤隔離**: 桌面應用構建失敗不會影響 Web 版本發佈
