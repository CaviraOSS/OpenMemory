# 簡化發布流程 / Simplified Release Workflow

## 🎯 概述 / Overview

此專案已採用簡化的發布流程，不再需要建立版本化目錄（如 `v2.3.0/`），而是直接更新 CHANGELOG 文件。

This project now uses a simplified release workflow that no longer requires creating versioned directories (like `v2.3.0/`), but instead directly updates CHANGELOG files.

## 📋 新的發布流程 / New Release Process

### 1. 更新 CHANGELOG 文件 / Update CHANGELOG Files

在發布前，請手動更新以下三個文件：
Before releasing, manually update these three files:

- `RELEASE_NOTES/CHANGELOG.en.md`
- `RELEASE_NOTES/CHANGELOG.zh-TW.md`
- `RELEASE_NOTES/CHANGELOG.zh-CN.md`

### 2. CHANGELOG 格式要求 / CHANGELOG Format Requirements

每個新版本應該按照以下格式添加到 CHANGELOG 文件的頂部：
Each new version should be added to the top of CHANGELOG files in this format:

```markdown
## [v2.3.0] - 版本標題 / Version Title

### 🌟 亮點 / Highlights
本次發佈的主要特色...

### ✨ 新功能 / New Features
- 🆕 **功能名稱**: 功能描述

### 🐛 錯誤修復 / Bug Fixes
- 🔧 **問題修復**: 修復描述

### 🚀 改進功能 / Improvements
- ⚡ **效能優化**: 優化描述

---
```

### 3. 執行發布 / Execute Release

1. 確保所有 CHANGELOG 文件都已更新
   Ensure all CHANGELOG files are updated

2. 前往 GitHub Actions 頁面
   Go to GitHub Actions page

3. 執行 "Auto Release to PyPI" workflow
   Run "Auto Release to PyPI" workflow

4. 選擇版本類型（patch/minor/major）
   Select version type (patch/minor/major)

### 📊 版本類型說明 / Version Type Explanation

選擇適當的版本類型非常重要，請根據變更內容選擇：
Choosing the appropriate version type is important, select based on the changes:

#### 🔧 Patch (修補版本)
- **用途 / Usage**: 錯誤修復、小幅改進、安全修補
- **範例 / Example**: `2.3.0 → 2.3.1`
- **適用情況 / When to use**:
  - 🐛 修復 bug / Bug fixes
  - 🔒 安全性修補 / Security patches
  - 📝 文檔更新 / Documentation updates
  - 🎨 小幅 UI 調整 / Minor UI tweaks

#### ✨ Minor (次要版本)
- **用途 / Usage**: 新功能、功能增強、向後相容的變更
- **範例 / Example**: `2.3.0 → 2.4.0`
- **適用情況 / When to use**:
  - 🆕 新增功能 / New features
  - 🚀 功能增強 / Feature enhancements
  - 🎯 效能改進 / Performance improvements
  - 🌐 新的語言支援 / New language support

#### 🚨 Major (主要版本)
- **用途 / Usage**: 重大變更、不向後相容的修改、架構重構
- **範例 / Example**: `2.3.0 → 3.0.0`
- **適用情況 / When to use**:
  - 💥 破壞性變更 / Breaking changes
  - 🏗️ 架構重構 / Architecture refactoring
  - 🔄 API 變更 / API changes
  - 📦 依賴項重大更新 / Major dependency updates

#### 🤔 如何選擇 / How to Choose

**問自己這些問題 / Ask yourself these questions**:

1. **會破壞現有功能嗎？** / **Will it break existing functionality?**
   - 是 / Yes → Major
   - 否 / No → 繼續下一個問題 / Continue to next question

2. **是否新增了功能？** / **Does it add new functionality?**
   - 是 / Yes → Minor
   - 否 / No → 繼續下一個問題 / Continue to next question

3. **只是修復或小幅改進？** / **Just fixes or minor improvements?**
   - 是 / Yes → Patch

## 🔄 自動化流程 / Automated Process

GitHub workflow 將自動：
The GitHub workflow will automatically:

1. ✅ 版本號碼升級 / Version bump
2. ✅ 從 CHANGELOG 提取亮點 / Extract highlights from CHANGELOG
3. ✅ 生成多語系 GitHub Release / Generate multi-language GitHub Release
4. ✅ 發布到 PyPI / Publish to PyPI
5. ✅ 建立 Git 標籤 / Create Git tags

## 📦 GitHub Release 格式 / GitHub Release Format

自動生成的 Release 將包含：
Auto-generated releases will include:

- 🌟 版本亮點 / Version highlights
- 🌐 多語系 CHANGELOG 連結 / Multi-language CHANGELOG links
- 📦 安裝指令 / Installation commands
- 🔗 相關連結 / Related links

## ⚠️ 注意事項 / Important Notes

1. **不再需要版本目錄**：舊的 `RELEASE_NOTES/v2.x.x/` 目錄結構已棄用
   **No more version directories**: Old `RELEASE_NOTES/v2.x.x/` directory structure is deprecated

2. **手動更新 CHANGELOG**：發布前必須手動更新 CHANGELOG 文件
   **Manual CHANGELOG updates**: CHANGELOG files must be manually updated before release

3. **格式一致性**：請保持 CHANGELOG 格式的一致性以確保自動提取正常運作
   **Format consistency**: Maintain CHANGELOG format consistency for proper auto-extraction

## 🗂️ 舊版本目錄清理 / Old Version Directory Cleanup

現有的版本目錄（`v2.2.1` 到 `v2.2.5`）可以選擇性保留作為歷史記錄，或者清理以簡化專案結構。

Existing version directories (`v2.2.1` to `v2.2.5`) can optionally be kept for historical records or cleaned up to simplify project structure.

## 🚀 優點 / Benefits

- ✅ 減少維護負擔 / Reduced maintenance burden
- ✅ 單一真實來源 / Single source of truth
- ✅ 簡化的專案結構 / Simplified project structure
- ✅ 自動化的 Release 生成 / Automated release generation
