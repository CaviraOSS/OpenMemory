# API 參考文檔

本文檔提供 MCP Feedback Enhanced 的完整 API 參考，包括 MCP 工具、Web API、WebSocket 通信協議和內部 API 接口。

## 📡 MCP 工具 API

MCP Feedback Enhanced 基於 FastMCP 框架實現，提供標準的 MCP 協議支援。

### interactive_feedback

AI 助手與用戶進行交互式回饋的核心 MCP 工具。

#### 函數簽名
```python
async def interactive_feedback(
    project_directory: str,
    summary: str,
    timeout: int = 600
) -> dict
```

#### 參數說明

| 參數 | 類型 | 必需 | 預設值 | 描述 |
|------|------|------|--------|------|
| `project_directory` | `str` | ✅ | - | 專案目錄路徑，用於上下文顯示 |
| `summary` | `str` | ✅ | - | AI 助手的工作摘要，向用戶說明當前狀態 |
| `timeout` | `int` | ❌ | `600` | 等待用戶回饋的超時時間（秒） |

#### 返回值
```python
{
    "command_logs": "",  # 命令執行日誌（保留字段）
    "interactive_feedback": str,  # 用戶回饋內容
    "images": List[str]  # 用戶上傳的圖片（Base64 編碼）
}
```

#### 使用示例
```python
# 基本調用
result = await interactive_feedback(
    project_directory="./my-web-app",
    summary="我已完成登入功能的實現，包括表單驗證和錯誤處理。請檢查代碼品質。"
)

# 自定義超時
result = await interactive_feedback(
    project_directory="./complex-project",
    summary="重構完成，請詳細測試所有功能模組。",
    timeout=1200  # 20分鐘
)
```

#### 錯誤處理
```python
try:
    result = await interactive_feedback(...)
except TimeoutError:
    print("用戶回饋超時")
except ValidationError as e:
    print(f"參數驗證錯誤: {e}")
except EnvironmentError as e:
    print(f"環境檢測錯誤: {e}")
```

## 🌐 Web API

### HTTP 端點

#### GET /
主頁重定向到回饋頁面。

**響應**: `302 Redirect` → `/feedback`

#### GET /feedback
回饋頁面主入口。

**響應**: `200 OK`
```html
<!DOCTYPE html>
<html>
<!-- 回饋頁面 HTML 內容 -->
</html>
```

#### GET /static/{path}
靜態資源服務（CSS、JS、圖片等）。

**參數**:
- `path`: 靜態資源路徑

**響應**: `200 OK` 或 `404 Not Found`

#### GET /api/translations
獲取多語言翻譯資源。

**響應**: `200 OK`
```json
{
    "zh-TW": {
        "app": {
            "title": "MCP Feedback Enhanced"
        }
    },
    "en": {
        "app": {
            "title": "MCP Feedback Enhanced"
        }
    },
    "zh-CN": {
        "app": {
            "title": "MCP Feedback Enhanced"
        }
    }
}
```

#### GET /api/session-status
獲取當前會話狀態。

**響應**: `200 OK`
```json
{
    "has_session": true,
    "status": "active",
    "session_info": {
        "project_directory": "./my-project",
        "summary": "代碼審查完成",
        "feedback_completed": false
    }
}
```

#### GET /api/current-session
獲取當前會話詳細信息。

**響應**: `200 OK`
```json
{
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "project_directory": "./my-project",
    "summary": "代碼審查完成",
    "feedback_completed": false,
    "command_logs": "",
    "images_count": 0
}
```

**錯誤響應**: `404 Not Found`
```json
{
    "error": "沒有活躍會話"
}
```

### WebSocket API

#### 連接端點
```
ws://localhost:{port}/ws
```

#### 訊息格式
所有 WebSocket 訊息都使用 JSON 格式：
```json
{
    "type": "message_type",
    "data": { /* 訊息數據 */ },
    "timestamp": "2024-12-XX 10:30:00"
}
```

### 📤 客戶端 → 服務器訊息

#### submit_feedback
提交用戶回饋。

```json
{
    "type": "submit_feedback",
    "data": {
        "feedback": "這個功能很好，但建議增加輸入驗證。",
        "images": [
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
        ],
        "settings": {
            "language": "zh-TW",
            "compress_images": true
        }
    }
}
```

**字段說明**:
- `feedback`: 用戶回饋文字內容
- `images`: 圖片數組（Base64 編碼）
- `settings.language`: 界面語言
- `settings.compress_images`: 是否壓縮圖片

#### heartbeat
心跳檢測訊息。

```json
{
    "type": "heartbeat",
    "data": {
        "timestamp": 1703123456789
    }
}
```

#### language_switch
切換界面語言。

```json
{
    "type": "language_switch",
    "data": {
        "language": "en"
    }
}
```

#### prompt_management
提示詞管理操作。

```json
{
    "type": "prompt_management",
    "data": {
        "action": "add|update|delete|use",
        "prompt": {
            "id": "prompt_1_1703123456789",
            "name": "代碼審查提示",
            "content": "請檢查這段代碼的邏輯正確性和性能優化建議。",
            "isAutoSubmit": false
        }
    }
}
```

**字段說明**:
- `action`: 操作類型（add=新增, update=更新, delete=刪除, use=使用）
- `prompt.id`: 提示詞唯一標識符
- `prompt.name`: 提示詞名稱
- `prompt.content`: 提示詞內容
- `prompt.isAutoSubmit`: 是否為自動提交提示詞

#### auto_submit_control
自動提交功能控制。

```json
{
    "type": "auto_submit_control",
    "data": {
        "action": "start|stop|update_settings",
        "settings": {
            "enabled": true,
            "timeout": 30,
            "promptId": "prompt_1_1703123456789"
        }
    }
}
```

**字段說明**:
- `action`: 控制動作（start=啟動, stop=停止, update_settings=更新設定）
- `settings.enabled`: 是否啟用自動提交
- `settings.timeout`: 自動提交倒數時間（秒）
- `settings.promptId`: 自動提交使用的提示詞 ID

#### session_management（v2.4.3 重構增強）
會話管理操作。

```json
{
    "type": "session_management",
    "data": {
        "action": "get_history|get_stats|clear_history|export_history|view_details",
        "sessionId": "550e8400-e29b-41d4-a716-446655440000",
        "options": {
            "retentionHours": 72,
            "privacyLevel": "full",
            "includeUserMessages": true
        }
    }
}
```

**字段說明**:
- `action`: 管理動作（get_history=獲取歷史, get_stats=獲取統計, clear_history=清除歷史, export_history=匯出歷史, view_details=查看詳情）
- `sessionId`: 會話 ID（可選）
- `options.retentionHours`: 歷史保存時間（小時）
- `options.privacyLevel`: 隱私等級（full=完整, basic=基本, disabled=停用）
- `options.includeUserMessages`: 是否包含用戶訊息記錄

#### audio_management（v2.4.3 新增）
音效管理操作。

```json
{
    "type": "audio_management",
    "data": {
        "action": "update_settings|test_audio|upload_custom|delete_custom",
        "settings": {
            "enabled": true,
            "volume": 75,
            "selectedAudioId": "notification-ding"
        },
        "customAudio": {
            "id": "custom_1_1703123456789",
            "name": "自訂提示音",
            "data": "data:audio/mp3;base64,//uQx...",
            "mimeType": "audio/mp3"
        }
    }
}
```

**字段說明**:
- `action`: 操作類型（update_settings=更新設定, test_audio=測試播放, upload_custom=上傳自訂音效, delete_custom=刪除自訂音效）
- `settings.enabled`: 是否啟用音效通知
- `settings.volume`: 音量（0-100）
- `settings.selectedAudioId`: 選中的音效 ID
- `customAudio`: 自訂音效數據

#### height_management（v2.4.3 新增）
輸入框高度管理。

```json
{
    "type": "height_management",
    "data": {
        "action": "save_height|load_height",
        "elementId": "combinedFeedbackText",
        "height": 200,
        "settingKey": "combinedFeedbackTextHeight"
    }
}
```

**字段說明**:
- `action`: 操作類型（save_height=保存高度, load_height=載入高度）
- `elementId`: 元素 ID
- `height`: 高度值（像素）
- `settingKey`: 設定鍵名

### 📥 服務器 → 客戶端訊息

#### connection_established
WebSocket 連接建立確認。

```json
{
    "type": "connection_established",
    "data": {
        "session_id": "550e8400-e29b-41d4-a716-446655440000",
        "server_time": "2024-12-XX 10:30:00"
    }
}
```

#### session_updated
會話更新通知（AI 再次調用時）。

```json
{
    "type": "session_updated",
    "data": {
        "session_id": "new-session-id",
        "summary": "根據您的建議，我已修改了錯誤處理邏輯。",
        "project_directory": "./my-project",
        "timestamp": "2024-12-XX 10:35:00"
    }
}
```

#### feedback_received
回饋接收確認。

```json
{
    "type": "feedback_received",
    "data": {
        "session_id": "session-id",
        "status": "success",
        "message": "回饋已成功接收"
    }
}
```

#### status_update
狀態更新通知。

```json
{
    "type": "status_update",
    "data": {
        "status": "FEEDBACK_PROCESSING",
        "message": "正在處理您的回饋...",
        "progress": 50
    }
}
```

#### auto_submit_status
自動提交狀態更新。

```json
{
    "type": "auto_submit_status",
    "data": {
        "enabled": true,
        "countdown": 25,
        "promptId": "prompt_1_1703123456789",
        "promptName": "代碼審查提示"
    }
}
```

**字段說明**:
- `enabled`: 自動提交是否啟用
- `countdown`: 剩餘倒數時間（秒）
- `promptId`: 當前自動提交提示詞 ID
- `promptName`: 當前自動提交提示詞名稱

#### session_history（v2.4.3 增強）
會話歷史數據。

```json
{
    "type": "session_history",
    "data": {
        "sessions": [
            {
                "session_id": "session-1",
                "summary": "代碼審查完成",
                "status": "completed",
                "created_at": "2024-12-13T10:30:00Z",
                "completed_at": "2024-12-13T10:35:00Z",
                "feedback_length": 150,
                "user_messages": [
                    {
                        "timestamp": "2024-12-13T10:32:00Z",
                        "content": "代碼看起來不錯",
                        "type": "text",
                        "submission_method": "manual"
                    }
                ],
                "project_directory": "./my-project"
            }
        ],
        "stats": {
            "total": 10,
            "completed": 8,
            "average_feedback_length": 120,
            "today_count": 3,
            "average_duration": 300
        },
        "retention_info": {
            "retention_hours": 72,
            "oldest_session": "2024-12-11T10:30:00Z",
            "cleanup_count": 2
        }
    }
}
```

#### audio_notification（v2.4.3 新增）
音效通知觸發。

```json
{
    "type": "audio_notification",
    "data": {
        "trigger": "session_updated",
        "audioId": "notification-ding",
        "volume": 75,
        "timestamp": "2024-12-13T10:30:00Z"
    }
}
```

**字段說明**:
- `trigger`: 觸發事件（session_updated=會話更新, feedback_received=回饋接收）
- `audioId`: 播放的音效 ID
- `volume`: 播放音量
- `timestamp`: 觸發時間

#### audio_settings_update（v2.4.3 新增）
音效設定更新通知。

```json
{
    "type": "audio_settings_update",
    "data": {
        "settings": {
            "enabled": true,
            "volume": 75,
            "selectedAudioId": "soft-chime"
        },
        "availableAudios": [
            {
                "id": "default-beep",
                "name": "經典提示音",
                "isDefault": true
            },
            {
                "id": "custom_1",
                "name": "自訂音效1",
                "isDefault": false
            }
        ]
    }
}
```

#### height_settings_update（v2.4.3 新增）
高度設定更新通知。

```json
{
    "type": "height_settings_update",
    "data": {
        "elementId": "combinedFeedbackText",
        "height": 200,
        "saved": true,
        "timestamp": "2024-12-13T10:30:00Z"
    }
}
```

#### error
錯誤訊息。

```json
{
    "type": "error",
    "data": {
        "error_code": "VALIDATION_ERROR",
        "message": "回饋內容不能為空",
        "details": {
            "field": "feedback",
            "value": ""
        }
    }
}
```

## 🔧 內部 API

### WebUIManager API

#### create_session()
```python
async def create_session(
    self,
    summary: str,
    project_directory: str
) -> WebFeedbackSession
```

創建新的回饋會話。

#### smart_open_browser()
```python
async def smart_open_browser(self, url: str) -> bool
```

智能開啟瀏覽器，避免重複開啟。

**返回值**:
- `True`: 檢測到活躍標籤頁，未開啟新視窗
- `False`: 開啟了新瀏覽器視窗

### WebFeedbackSession API

#### submit_feedback()
```python
async def submit_feedback(
    self,
    feedback: str,
    images: List[str],
    settings: dict
) -> None
```

提交用戶回饋到會話。

#### wait_for_feedback()
```python
async def wait_for_feedback(self, timeout: int = 600) -> dict
```

等待用戶回饋完成。

#### add_websocket()
```python
def add_websocket(self, websocket: WebSocket) -> None
```

添加 WebSocket 連接到會話。

### PromptManager API

#### addPrompt()
```python
def addPrompt(self, name: str, content: str) -> dict
```

新增提示詞到管理器。

**參數**:
- `name`: 提示詞名稱（必須唯一）
- `content`: 提示詞內容

**返回值**: 新建的提示詞對象

#### updatePrompt()
```python
def updatePrompt(self, id: str, name: str, content: str) -> dict
```

更新現有提示詞。

#### deletePrompt()
```python
def deletePrompt(self, id: str) -> bool
```

刪除指定提示詞。

#### usePrompt()
```python
def usePrompt(self, id: str) -> dict
```

使用提示詞（更新最近使用記錄）。

#### getPromptsSortedByUsage()
```python
def getPromptsSortedByUsage(self) -> List[dict]
```

獲取按使用頻率排序的提示詞列表，自動提交提示詞優先顯示。

### SessionManager API（v2.4.3 重構增強）

#### getCurrentSession()
```python
def getCurrentSession(self) -> dict
```

獲取當前活躍會話信息。

#### getSessionHistory()
```python
def getSessionHistory(self, retentionHours: int = 72) -> List[dict]
```

獲取會話歷史記錄，支援保存期限過濾。

#### getSessionStats()
```python
def getSessionStats(self) -> dict
```

獲取會話統計信息，包含今日統計和平均時長。

#### exportSessionHistory()
```python
def exportSessionHistory(self, format: str = "json") -> str
```

匯出會話歷史數據。

**參數**:
- `format`: 匯出格式（json, csv）

#### cleanupExpiredSessions()
```python
def cleanupExpiredSessions(self, retentionHours: int = 72) -> int
```

清理過期會話記錄。

**返回值**: 清理的會話數量

### AudioManager API（v2.4.3 新增）

#### playNotification()
```python
def playNotification(self) -> None
```

播放通知音效。

#### updateSettings()
```python
def updateSettings(self, enabled: bool, volume: int, selectedAudioId: str) -> None
```

更新音效設定。

#### addCustomAudio()
```python
def addCustomAudio(self, name: str, audioData: str, mimeType: str) -> dict
```

新增自訂音效。

**參數**:
- `name`: 音效名稱
- `audioData`: Base64 編碼的音效數據
- `mimeType`: MIME 類型（audio/mp3, audio/wav, audio/ogg）

#### deleteCustomAudio()
```python
def deleteCustomAudio(self, audioId: str) -> bool
```

刪除自訂音效。

#### getAllAudios()
```python
def getAllAudios(self) -> List[dict]
```

獲取所有可用音效（內建 + 自訂）。

### TextareaHeightManager API（v2.4.3 新增）

#### registerTextarea()
```python
def registerTextarea(self, elementId: str, settingKey: str) -> bool
```

註冊 textarea 元素進行高度管理。

#### saveHeight()
```python
def saveHeight(self, elementId: str, height: int) -> None
```

保存 textarea 高度到設定。

#### loadHeight()
```python
def loadHeight(self, elementId: str) -> int
```

從設定載入 textarea 高度。

#### unregisterTextarea()
```python
def unregisterTextarea(self, elementId: str) -> None
```

取消註冊 textarea 元素。

### AutoSubmitManager API

#### start()
```python
def start(self, timeoutSeconds: int, promptId: str) -> None
```

啟動自動提交倒數計時器。

#### stop()
```python
def stop(self) -> None
```

停止自動提交倒數計時器。

#### updateSettings()
```python
def updateSettings(self, enabled: bool, timeout: int, promptId: str) -> None
```

更新自動提交設定。

## 📊 狀態碼和錯誤碼

### HTTP 狀態碼
- `200 OK`: 請求成功
- `302 Found`: 重定向
- `404 Not Found`: 資源不存在
- `500 Internal Server Error`: 服務器內部錯誤

### WebSocket 錯誤碼
```python
class ErrorCodes:
    VALIDATION_ERROR = "VALIDATION_ERROR"
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND"
    TIMEOUT_ERROR = "TIMEOUT_ERROR"
    PROCESSING_ERROR = "PROCESSING_ERROR"
    CONNECTION_ERROR = "CONNECTION_ERROR"
```

### 會話狀態
```python
class SessionStatus:
    WAITING = "FEEDBACK_WAITING"
    PROCESSING = "FEEDBACK_PROCESSING"
    SUBMITTED = "FEEDBACK_SUBMITTED"
    ERROR = "ERROR"
```

### 提示詞狀態
```python
class PromptStatus:
    ACTIVE = "active"           # 活躍提示詞
    AUTO_SUBMIT = "auto_submit" # 自動提交提示詞
    ARCHIVED = "archived"       # 已歸檔提示詞
```

### 自動提交狀態
```python
class AutoSubmitStatus:
    DISABLED = "disabled"       # 已停用
    ENABLED = "enabled"         # 已啟用
    COUNTDOWN = "countdown"     # 倒數計時中
    COMPLETED = "completed"     # 已完成提交
```

### 音效通知狀態（v2.4.3 新增）
```python
class AudioNotificationStatus:
    DISABLED = "disabled"       # 已停用
    ENABLED = "enabled"         # 已啟用
    PLAYING = "playing"         # 播放中
    ERROR = "error"             # 播放錯誤
```

### 會話歷史狀態（v2.4.3 新增）
```python
class SessionHistoryStatus:
    ACTIVE = "active"           # 活躍會話
    COMPLETED = "completed"     # 已完成會話
    EXPIRED = "expired"         # 已過期會話
    ARCHIVED = "archived"       # 已歸檔會話
```

### 隱私等級（v2.4.3 新增）
```python
class PrivacyLevel:
    FULL = "full"               # 完整記錄
    BASIC = "basic"             # 基本記錄
    DISABLED = "disabled"       # 停用記錄
```

## 🔒 安全考慮

### 輸入驗證
- 回饋內容長度限制：最大 10,000 字符
- 圖片大小限制：單張最大 5MB
- 圖片數量限制：最多 10 張
- 支援的圖片格式：PNG, JPEG, GIF, WebP
- 提示詞名稱長度限制：最大 100 字符
- 提示詞內容長度限制：最大 5,000 字符
- 提示詞數量限制：最多 50 個
- **音效文件限制（v2.4.3 新增）**：
  - 支援格式：MP3, WAV, OGG
  - 單個文件最大：2MB
  - 自訂音效數量：最多 20 個
  - 音效名稱長度：最大 50 字符
- **會話歷史限制（v2.4.3 新增）**：
  - 預設保存期限：72 小時
  - 最大保存期限：168 小時（7天）
  - 單個會話最大用戶訊息數：100 條

### 資源保護
- WebSocket 連接數限制：每會話最多 5 個連接
- 會話超時自動清理
- 內存使用監控和限制

### 跨域設置
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 開發環境，生產環境應限制
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 📚 相關文檔

- **[系統架構總覽](./system-overview.md)** - 了解整體架構設計理念和技術棧
- **[組件詳細說明](./component-details.md)** - 深入了解各層組件的具體實現
- **[交互流程文檔](./interaction-flows.md)** - 詳細的用戶交互和系統流程
- **[部署指南](./deployment-guide.md)** - 環境配置和部署最佳實踐

---

**版本**: 2.4.3
**最後更新**: 2025年6月14日
**維護者**: Minidoracat
**API 版本**: v1
**協議支援**: MCP 2.0+, WebSocket, HTTP/1.1, Web Audio API
**v2.4.3 新功能**: 音效通知系統、會話管理重構、智能記憶功能、一鍵複製
**歷史功能**: 自動提交、提示詞管理、會話管理、語系切換優化
