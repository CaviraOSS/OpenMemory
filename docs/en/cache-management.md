# UV Cache Management Guide

## 🔍 Problem Description

Since this project uses `uvx` for execution, cache files are created in the system with each run. Over time, these caches can consume significant disk space.

### Cache Location
- **Windows**: `%USERPROFILE%\AppData\Local\uv\cache`
- **macOS/Linux**: `~/.cache/uv`

## 🧹 Cleanup Methods

### Method 1: Using UV Built-in Commands (Recommended)

```bash
# Check cache location
uv cache dir

# Clean all cache
uv cache clean
```

### Method 2: Using Project-Provided Cleanup Tool

```bash
# Check cache size
python scripts/cleanup_cache.py --size

# Preview cleanup content
python scripts/cleanup_cache.py --dry-run

# Execute cleanup
python scripts/cleanup_cache.py --clean

# Force cleanup (attempts to close related processes)
python scripts/cleanup_cache.py --force
```

## ⚠️ Common Issues

### Issue: "File is being used by another process" error during cleanup

**Cause**: MCP server or other uvx processes are running

**Solutions**:
1. **Close related processes**:
   - Close Claude Desktop or other MCP-using applications
   - Terminate all `uvx` related processes

2. **Use force cleanup**:
   ```bash
   python scripts/cleanup_cache.py --force
   ```

3. **Manual cleanup**:
   ```bash
   # Windows
   taskkill /f /im uvx.exe
   taskkill /f /im python.exe /fi "WINDOWTITLE eq *mcp-feedback-enhanced*"

   # Then execute cleanup
   uv cache clean
   ```

### Issue: Cache grows large again quickly after cleanup

**Cause**: Frequent use of `uvx mcp-feedback-enhanced@latest`

**Recommendations**:
1. **Regular cleanup**: Recommend weekly or monthly cleanup
2. **Monitor size**: Regularly check cache size
3. **Consider local installation**: For developers, consider local installation instead of uvx

## 📊 Cache Size Monitoring

### Check Cache Size

```bash
# Using cleanup tool
python scripts/cleanup_cache.py --size

# Or check directory size directly (Windows)
dir "%USERPROFILE%\AppData\Local\uv\cache" /s

# macOS/Linux
du -sh ~/.cache/uv
```

### Recommended Cleanup Frequency

| Cache Size | Recommended Action |
|-----------|-------------------|
| < 100MB   | No cleanup needed |
| 100MB-500MB | Consider cleanup |
| > 500MB   | Cleanup recommended |
| > 1GB     | Cleanup strongly recommended |

## 🔧 Automated Cleanup

### Windows Scheduled Task

```batch
@echo off
cd /d "G:\github\interactive-feedback-mcp"
python scripts/cleanup_cache.py --clean
```

### macOS/Linux Cron Job

```bash
# Weekly cleanup on Sunday
0 2 * * 0 cd /path/to/interactive-feedback-mcp && python scripts/cleanup_cache.py --clean
```

## 💡 Best Practices

1. **Regular monitoring**: Check cache size monthly
2. **Timely cleanup**: Clean when cache exceeds 500MB
3. **Close processes**: Ensure related MCP services are closed before cleanup
4. **Backup important data**: Ensure important projects are backed up before cleanup

## 🆘 Troubleshooting

### Common Causes of Cleanup Failure

1. **Process occupation**: MCP server is running
2. **Insufficient permissions**: Administrator privileges required
3. **Disk errors**: File system errors

### Resolution Steps

1. Close all MCP-related processes
2. Run cleanup command as administrator
3. If still failing, restart computer and try again
4. Consider manually deleting parts of cache directory

## 📞 Support

If you encounter cleanup issues, please:
1. Check the troubleshooting section in this document
2. Report issues on [GitHub Issues](https://github.com/Minidoracat/mcp-feedback-enhanced/issues)
3. Provide error messages and system information
