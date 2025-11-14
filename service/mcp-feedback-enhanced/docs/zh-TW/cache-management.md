# UV Cache 管理指南

## 🔍 問題說明

由於本專案使用 `uvx` 執行，每次運行都會在系統中建立 cache 檔案。隨著時間推移，這些 cache 可能會佔用大量磁碟空間。

### Cache 位置
- **Windows**: `%USERPROFILE%\AppData\Local\uv\cache`
- **macOS/Linux**: `~/.cache/uv`

## 🧹 清理方法

### 方法一：使用 UV 內建命令（推薦）

```bash
# 查看 cache 位置
uv cache dir

# 清理所有 cache
uv cache clean
```

### 方法二：使用專案提供的清理工具

```bash
# 查看 cache 大小
python scripts/cleanup_cache.py --size

# 預覽清理內容
python scripts/cleanup_cache.py --dry-run

# 執行清理
python scripts/cleanup_cache.py --clean

# 強制清理（會嘗試關閉相關程序）
python scripts/cleanup_cache.py --force
```

## ⚠️ 常見問題

### 問題：清理時出現「檔案正由另一個程序使用」錯誤

**原因**：有 MCP 服務器或其他 uvx 程序正在運行

**解決方案**：
1. **關閉相關程序**：
   - 關閉 Claude Desktop 或其他使用 MCP 的應用
   - 結束所有 `uvx` 相關程序

2. **使用強制清理**：
   ```bash
   python scripts/cleanup_cache.py --force
   ```

3. **手動清理**：
   ```bash
   # Windows
   taskkill /f /im uvx.exe
   taskkill /f /im python.exe /fi "WINDOWTITLE eq *mcp-feedback-enhanced*"

   # 然後執行清理
   uv cache clean
   ```

### 問題：清理後 cache 很快又變大

**原因**：頻繁使用 `uvx mcp-feedback-enhanced@latest`

**建議**：
1. **定期清理**：建議每週或每月清理一次
2. **監控大小**：定期檢查 cache 大小
3. **考慮本地安裝**：如果是開發者，可考慮本地安裝而非每次使用 uvx

## 📊 Cache 大小監控

### 檢查 Cache 大小

```bash
# 使用清理工具
python scripts/cleanup_cache.py --size

# 或直接查看目錄大小（Windows）
dir "%USERPROFILE%\AppData\Local\uv\cache" /s

# macOS/Linux
du -sh ~/.cache/uv
```

### 建議的清理頻率

| Cache 大小 | 建議動作 |
|-----------|---------|
| < 100MB   | 無需清理 |
| 100MB-500MB | 可考慮清理 |
| > 500MB   | 建議清理 |
| > 1GB     | 強烈建議清理 |

## 🔧 自動化清理

### Windows 排程任務

```batch
@echo off
cd /d "G:\github\interactive-feedback-mcp"
python scripts/cleanup_cache.py --clean
```

### macOS/Linux Cron Job

```bash
# 每週日清理一次
0 2 * * 0 cd /path/to/interactive-feedback-mcp && python scripts/cleanup_cache.py --clean
```

## 💡 最佳實踐

1. **定期監控**：每月檢查一次 cache 大小
2. **適時清理**：當 cache 超過 500MB 時進行清理
3. **關閉程序**：清理前確保關閉相關 MCP 服務
4. **備份重要資料**：清理前確保重要專案已備份

## 🆘 故障排除

### 清理失敗的常見原因

1. **程序佔用**：MCP 服務器正在運行
2. **權限不足**：需要管理員權限
3. **磁碟錯誤**：檔案系統錯誤

### 解決步驟

1. 關閉所有 MCP 相關程序
2. 以管理員身份運行清理命令
3. 如果仍然失敗，重啟電腦後再試
4. 考慮手動刪除部分 cache 目錄

## 📞 支援

如果遇到清理問題，請：
1. 查看本文檔的故障排除部分
2. 在 [GitHub Issues](https://github.com/Minidoracat/mcp-feedback-enhanced/issues) 回報問題
3. 提供錯誤訊息和系統資訊
