# SSH Remote 环境浏览器启动问题解决方案

## 问题描述

在 SSH Remote 环境（如 Cursor SSH Remote、VS Code Remote SSH 等）中使用 MCP Feedback Enhanced 时，可能会遇到以下问题：

- 🚫 浏览器无法自动启动
- ❌ 显示「无法启动浏览器」错误
- 🔗 Web UI 无法在本地浏览器中打开

## 原因分析

SSH Remote 环境的限制：
1. **显示环境隔离**: 远程服务器没有图形界面环境
2. **网络隔离**: 远程端口无法直接在本地访问
3. **浏览器不存在**: 远程环境通常没有安装浏览器

## 解决方案

### 步骤一：设置端口（可选）

MCP Feedback Enhanced 默认使用端口 **8765**，您也可以自定义端口：

![设置端口](../images/ssh-remote-port-setting.png)

### 步骤二：等待 MCP 调用

**重要**：不要手动启动 Web UI，而是要等待 AI 模型调用 MCP 工具时自动启动。

当 AI 模型调用 `interactive_feedback` 工具时，系统会自动启动 Web UI。

### 步骤三：查看端口并连接

如果浏览器没有自动启动，您需要手动连接到 Web UI：

#### 方法一：查看端口转发
查看您的 SSH Remote 环境的端口转发设置，找到对应的本地端口：

![连接到 URL](../images/ssh-remote-connect-url.png)

#### 方法二：使用 Debug 模式查看
在 IDE 中开启 Debug 模式，选择「输出」→「MCP Log」，可以看到 Web UI 的 URL：

![Debug 模式查看端口](../images/ssh-remote-debug-port.png)

### 步骤四：在本地浏览器打开

1. 复制 URL（通常是 `http://localhost:8765` 或其他端口）
2. 在本地浏览器中粘贴并打开
3. 开始使用 Web UI 进行反馈

## 端口转发设置

### VS Code Remote SSH
1. 在 VS Code 中按 `Ctrl+Shift+P`
2. 输入 "Forward a Port"
3. 输入端口号（默认 8765）
4. 在本地浏览器中访问 `http://localhost:8765`

### Cursor SSH Remote
1. 查看 Cursor 的端口转发设置
2. 手动添加端口转发规则（端口 8765）
3. 在本地浏览器中访问转发的端口

## 重要提醒

### ⚠️ 不要手动启动
**请勿**手动执行 `uvx mcp-feedback-enhanced test --web` 等指令，这样无法与 MCP 系统整合。

### ✅ 正确流程
1. 等待 AI 模型调用 MCP 工具
2. 系统自动启动 Web UI
3. 查看端口转发或 Debug 日志
4. 在本地浏览器中打开对应 URL

## 常见问题

### Q: 为什么在 SSH Remote 环境中无法自动打开浏览器？
A: SSH Remote 环境是无头环境（headless），没有图形界面，因此无法直接启动浏览器。需要通过端口转发在本地浏览器中访问。

### Q: 如何确认 Web UI 是否正常启动？
A: 查看 IDE 的 Debug 输出或 MCP Log，如果看到 "Web UI 已启动" 的信息，表示启动成功。

### Q: 端口被占用怎么办？
A: 在 MCP 设置中修改端口号，或者等待系统自动选择其他可用端口。

### Q: 找不到端口转发设置怎么办？
A: 查看您的 SSH Remote 工具文档，或使用 Debug 模式查看 MCP Log 中的 URL。

### Q: 为什么没有接收到 MCP 新的反馈？
A: 可能是 WebSocket 连接有问题。**解决方法**：直接重新刷新浏览器页面，这会重新建立 WebSocket 连接。

### Q: 为什么没有调用出 MCP？
A: 请确认 MCP 工具状态为绿灯（表示正常运作）。**解决方法**：
- 检查 IDE 中的 MCP 工具状态指示灯
- 如果不是绿灯，尝试反复开关 MCP 工具
- 等待几秒钟让系统重新连接

### Q: 为什么 Augment 无法启动 MCP？
A: 有时候可能会有错误导致 MCP 工具没有显示绿灯状态。**解决方法**：
- 完全关闭并重新启动 VS Code 或 Cursor
- 重新打开项目
- 等待 MCP 工具重新加载并显示绿灯

## v2.3.0 改进

本版本针对 SSH Remote 环境的改进：
- ✅ 自动检测 SSH Remote 环境
- ✅ 在无法启动浏览器时提供清晰的指引
- ✅ 显示正确的访问 URL
- ✅ 改善错误提示和解决建议

## 相关资源

- [主要文档](../../README.zh-CN.md)
