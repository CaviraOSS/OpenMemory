# 桌面應用構建和發佈流程改進

## 🎯 改進目標

確保 GitHub Actions 能夠健全地構建所有平台的桌面應用執行檔，並在發佈流程中正確使用這些構建產物。

## 🔧 主要改進

### 1. 增強桌面構建工作流程 (`.github/workflows/build-desktop.yml`)

#### 新增功能：
- **平台特定依賴安裝**：為 Linux 平台自動安裝必要的系統依賴
- **詳細構建驗證**：檢查二進制文件存在性、大小和類型
- **錯誤處理改進**：如果找不到構建產物則立即失敗
- **構建摘要增強**：提供詳細的構建狀態報告和下一步指導

#### 技術改進：
```yaml
# Linux 依賴安裝
- name: Install platform-specific dependencies (Linux)
  if: matrix.os == 'ubuntu-latest'
  run: |
    sudo apt-get update
    sudo apt-get install -y \
      libwebkit2gtk-4.1-dev \
      libappindicator3-dev \
      librsvg2-dev \
      patchelf \
      libgtk-3-dev \
      libayatana-appindicator3-dev

# 增強的構建驗證
- name: Verify build output
  run: |
    BINARY_PATH="src-tauri/target/${{ matrix.target }}/release/${{ matrix.binary }}"
    if [ -f "$BINARY_PATH" ]; then
      echo "✅ 找到二進制文件: $BINARY_PATH"
      FILE_SIZE=$(stat -f%z "$BINARY_PATH" 2>/dev/null || stat -c%s "$BINARY_PATH" 2>/dev/null)
      echo "📏 文件大小: $FILE_SIZE bytes"
    else
      echo "❌ 二進制文件不存在: $BINARY_PATH"
      exit 1
    fi
```

### 2. 優化發佈工作流程 (`.github/workflows/publish.yml`)

#### 新增功能：
- **智能桌面構建檢測**：自動查找最新成功的桌面構建
- **健壯的產物下載**：改進錯誤處理和產物驗證
- **多平台二進制處理**：統一的平台映射和文件重命名
- **詳細驗證步驟**：確保所有平台的二進制文件都有效

#### 技術改進：
```yaml
# 智能構建檢測
- name: Check desktop build availability
  run: |
    if [ -n "${{ github.event.inputs.desktop_build_run_id }}" ]; then
      echo "🎯 使用指定的構建 Run ID"
    else
      LATEST_RUN=$(curl -s -H "Authorization: Bearer ${{ secrets.GITHUB_TOKEN }}" \
        "https://api.github.com/repos/${{ github.repository }}/actions/workflows/build-desktop.yml/runs?status=success&per_page=1" \
        | jq -r '.workflow_runs[0].id // empty')
      echo "run_id=$LATEST_RUN" >> $GITHUB_OUTPUT
    fi

# 統一平台映射
declare -A PLATFORM_MAP=(
  ["desktop-windows"]="mcp-feedback-enhanced-desktop.exe"
  ["desktop-macos-intel"]="mcp-feedback-enhanced-desktop-macos-intel"
  ["desktop-macos-arm64"]="mcp-feedback-enhanced-desktop-macos-arm64"
  ["desktop-linux"]="mcp-feedback-enhanced-desktop-linux"
)
```

### 3. 新增一鍵構建發佈工作流程 (`.github/workflows/build-and-release.yml`)

#### 功能特點：
- **自動化整個流程**：構建 → 驗證 → 發佈
- **靈活的平台選擇**：支援選擇特定平台或全平台構建
- **可選發佈模式**：可以只構建不發佈
- **統一狀態報告**：提供完整的流程摘要

#### 使用方式：
1. 前往 [Build Desktop & Release](../../actions/workflows/build-and-release.yml)
2. 點擊 "Run workflow"
3. 選擇版本類型或輸入自定義版本
4. 選擇要構建的平台（默認：all）
5. 可選：勾選 "只構建桌面應用，不進行發佈"

### 4. 工作流程驗證腳本 (`scripts/validate_workflows.py`)

#### 功能：
- **YAML 語法驗證**：確保所有工作流程文件語法正確
- **結構完整性檢查**：驗證必需字段和配置
- **特定工作流程驗證**：針對桌面構建和發佈流程的專項檢查

#### 使用方式：
```bash
python scripts/validate_workflows.py
```

## 🚀 使用指南

### 方案 1：使用一鍵構建發佈（推薦）
1. 觸發 "Build Desktop & Release" 工作流程
2. 系統自動構建所有平台
3. 構建成功後自動發佈

### 方案 2：分步執行
1. 先觸發 "Build Desktop Applications" 工作流程
2. 等待所有平台構建完成
3. 記錄 Run ID
4. 觸發 "Auto Release to PyPI" 工作流程
5. 設置 `include_desktop: true` 和對應的 Run ID

## 🔍 驗證清單

### 構建階段
- [ ] Windows x64 構建成功
- [ ] macOS Intel 構建成功  
- [ ] macOS ARM64 構建成功
- [ ] Linux x64 構建成功
- [ ] 所有二進制文件大小 > 1MB
- [ ] Artifacts 正確上傳

### 發佈階段
- [ ] 桌面構建產物正確下載
- [ ] 所有平台二進制文件正確重命名
- [ ] 執行權限正確設置
- [ ] PyPI 包包含桌面應用
- [ ] GitHub Release 創建成功

## 🛠️ 故障排除

### 常見問題

1. **Windows 平台 PowerShell 語法錯誤**
   - **問題**：`Missing '(' after 'if' in if statement`
   - **原因**：在 Windows 上使用了 bash 語法
   - **解決方案**：為所有 shell 腳本添加 `shell: bash` 指定

2. **Linux 依賴包衝突**
   - **問題**：`libayatana-appindicator3-dev` 與 `libappindicator3-dev` 衝突
   - **原因**：Ubuntu 24.04 中兩個包不能同時安裝
   - **解決方案**：優先嘗試 ayatana 版本，失敗時回退到傳統版本

3. **Linux 構建失敗**
   - 檢查系統依賴是否正確安裝
   - 確認 GTK 和 WebKit 版本兼容性
   - 檢查 appindicator 依賴是否正確安裝

4. **macOS 構建失敗**
   - 檢查 Xcode 命令行工具
   - 確認 target 配置正確
   - 驗證 Rust 工具鏈是否支援目標架構

5. **桌面產物下載失敗**
   - 確認指定的 Run ID 存在且成功
   - 檢查 Artifacts 保留期限（30天）
   - 驗證工作流程權限設置

6. **發佈包缺少桌面應用**
   - 驗證 `include_desktop` 設置為 true
   - 檢查桌面應用驗證步驟是否通過
   - 確認平台選擇邏輯正確執行

7. **部分平台構建失敗導致發佈被阻擋**
   - **問題**：只有部分平台構建成功（例如 2/4 個平台）
   - **原因**：發佈流程要求所有 4 個平台都必須成功
   - **解決方案**：
     - 重新運行桌面構建工作流程，確保所有平台成功
     - 檢查失敗平台的構建日誌
     - 或者設置 `include_desktop=false` 僅發佈 Web 版本

8. **多平台完整性要求**
   - **必須平台**：Windows x64、macOS Intel、macOS Apple Silicon、Linux x64
   - **驗證標準**：每個平台的二進制文件必須 > 1MB
   - **失敗處理**：任何平台缺失或無效都會阻擋發佈

### 調試步驟

1. **檢查工作流程配置**：
   ```bash
   python scripts/validate_workflows.py
   ```

2. **查看構建日誌**：
   - 前往 GitHub Actions 頁面
   - 檢查失敗步驟的詳細日誌

3. **驗證產物**：
   - 下載 Artifacts 手動檢查
   - 確認文件大小和執行權限

## 📈 效果評估

### 改進前的問題
- ❌ 跨平台編譯在本地環境失敗
- ❌ 發佈流程缺少桌面應用驗證
- ❌ 錯誤處理不夠健壯
- ❌ 缺少統一的構建發佈流程

### 改進後的優勢
- ✅ 所有平台在原生環境構建
- ✅ 完整的產物驗證和錯誤處理
- ✅ 自動化的端到端流程
- ✅ 詳細的狀態報告和故障排除指導
- ✅ 靈活的構建和發佈選項

## 🎯 下一步

1. **測試新工作流程**：
   - 觸發桌面構建測試所有平台
   - 驗證發佈流程包含桌面應用

2. **監控和優化**：
   - 收集構建時間數據
   - 根據實際使用情況調整配置

3. **文檔更新**：
   - 更新用戶指南
   - 添加更多故障排除案例
