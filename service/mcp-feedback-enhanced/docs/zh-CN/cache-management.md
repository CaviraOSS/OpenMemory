# UV Cache 管理指南

## 🔍 问题说明

由于本项目使用 `uvx` 执行，每次运行都会在系统中建立 cache 文件。随着时间推移，这些 cache 可能会占用大量磁盘空间。

### Cache 位置
- **Windows**: `%USERPROFILE%\AppData\Local\uv\cache`
- **macOS/Linux**: `~/.cache/uv`

## 🧹 清理方法

### 方法一：使用 UV 内建命令（推荐）

```bash
# 查看 cache 位置
uv cache dir

# 清理所有 cache
uv cache clean
```

### 方法二：使用项目提供的清理工具

```bash
# 查看 cache 大小
python scripts/cleanup_cache.py --size

# 预览清理内容
python scripts/cleanup_cache.py --dry-run

# 执行清理
python scripts/cleanup_cache.py --clean

# 强制清理（会尝试关闭相关程序）
python scripts/cleanup_cache.py --force
```

## ⚠️ 常见问题

### 问题：清理时出现「文件正由另一个程序使用」错误

**原因**：有 MCP 服务器或其他 uvx 程序正在运行

**解决方案**：
1. **关闭相关程序**：
   - 关闭 Claude Desktop 或其他使用 MCP 的应用
   - 结束所有 `uvx` 相关程序

2. **使用强制清理**：
   ```bash
   python scripts/cleanup_cache.py --force
   ```

3. **手动清理**：
   ```bash
   # Windows
   taskkill /f /im uvx.exe
   taskkill /f /im python.exe /fi "WINDOWTITLE eq *mcp-feedback-enhanced*"

   # 然后执行清理
   uv cache clean
   ```

### 问题：清理后 cache 很快又变大

**原因**：频繁使用 `uvx mcp-feedback-enhanced@latest`

**建议**：
1. **定期清理**：建议每周或每月清理一次
2. **监控大小**：定期检查 cache 大小
3. **考虑本地安装**：如果是开发者，可考虑本地安装而非每次使用 uvx

## 📊 Cache 大小监控

### 检查 Cache 大小

```bash
# 使用清理工具
python scripts/cleanup_cache.py --size

# 或直接查看目录大小（Windows）
dir "%USERPROFILE%\AppData\Local\uv\cache" /s

# macOS/Linux
du -sh ~/.cache/uv
```

### 建议的清理频率

| Cache 大小 | 建议动作 |
|-----------|---------|
| < 100MB   | 无需清理 |
| 100MB-500MB | 可考虑清理 |
| > 500MB   | 建议清理 |
| > 1GB     | 强烈建议清理 |

## 🔧 自动化清理

### Windows 计划任务

```batch
@echo off
cd /d "G:\github\interactive-feedback-mcp"
python scripts/cleanup_cache.py --clean
```

### macOS/Linux Cron Job

```bash
# 每周日清理一次
0 2 * * 0 cd /path/to/interactive-feedback-mcp && python scripts/cleanup_cache.py --clean
```

## 💡 最佳实践

1. **定期监控**：每月检查一次 cache 大小
2. **适时清理**：当 cache 超过 500MB 时进行清理
3. **关闭程序**：清理前确保关闭相关 MCP 服务
4. **备份重要资料**：清理前确保重要项目已备份

## 🆘 故障排除

### 清理失败的常见原因

1. **程序占用**：MCP 服务器正在运行
2. **权限不足**：需要管理员权限
3. **磁盘错误**：文件系统错误

### 解决步骤

1. 关闭所有 MCP 相关程序
2. 以管理员身份运行清理命令
3. 如果仍然失败，重启电脑后再试
4. 考虑手动删除部分 cache 目录

## 📞 支持

如果遇到清理问题，请：
1. 查看本文档的故障排除部分
2. 在 [GitHub Issues](https://github.com/Minidoracat/mcp-feedback-enhanced/issues) 报告问题
3. 提供错误信息和系统信息
