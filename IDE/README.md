# OpenMemory for VS Code

> Transform your IDE into a cognitive memory system that remembers your coding context across sessions.

## Features

- **Automatic Context Capture**: Tracks file opens, edits, and saves
- **Session Management**: Maintains memory across coding sessions
- **Smart Event Batching**: Optimizes performance with configurable batching
- **Context Retrieval**: Query your coding history through command palette
- **Multi-Sector Memory**: Organizes memories into episodic, semantic, procedural, emotional, and reflective sectors

## Installation

### Prerequisites

1. OpenMemory backend running (default: `http://localhost:3000`)
2. VS Code 1.85.0 or higher

### Setup

1. Install dependencies:

```bash
cd IDE/vscode
npm install
```

2. Compile the extension:

```bash
npm run compile
```

3. Press F5 in VS Code to launch Extension Development Host

## Configuration

Configure OpenMemory through VS Code settings:

- **`openmemory.backendUrl`**: URL of your OpenMemory backend (default: `http://localhost:3000`)

## Usage

### Automatic Tracking

OpenMemory automatically tracks:

- File opens
- Text edits (with line numbers)
- File saves (with full content)

### Query Context

Use the Command Palette (Ctrl+Shift+P / Cmd+Shift+P):

```
OpenMemory: Query Context
```

Enter a natural language query like:

- "How did I implement authentication?"
- "What database queries did I write yesterday?"
- "Show me the bug fix I did last week"

Results appear in the Output panel with salience scores.

## Architecture

```
┌─────────────────┐
│   VS Code IDE   │
│  (File Events)  │
└────────┬────────┘
         │
         │ fetch() REST API
         │
┌────────▼────────┐
│  OpenMemory     │
│    Backend      │
│  (port 3000)    │
└─────────────────┘
```

### Event Flow

1. User edits `src/auth.ts`
2. VS Code fires `onDidChangeTextDocument`
3. Extension batches event (default: 10 events or 2 seconds)
4. Sends POST to `/api/ide/events`
5. Backend stores in appropriate memory sector

### Session Lifecycle

```typescript
activate() → start_new_session()
  ↓
[User codes for hours]
  ↓
deactivate() → end_current_session()
```

## API Reference

### OpenMemoryIdeClient

```typescript
class OpenMemoryIdeClient {
  // Start tracking session
  async start_new_session(
    user_id: string,
    project_name: string,
    ide_name: string,
  ): Promise<void>;

  // End session
  async end_current_session(): Promise<void>;

  // Add IDE event (auto-batched)
  async add_ide_event(event_data: IdeEventData): Promise<void>;

  // Query relevant memories
  async query_relevant_context(
    query_text: string,
    top_k_results: number = 5,
  ): Promise<MemoryResponse[]>;
}
```

### Event Types

- `edit`: Text change in file
- `open`: File opened in editor
- `close`: File closed
- `save`: File saved to disk
- `refactor`: Code refactoring detected
- `comment`: Comment added/modified
- `pattern_detected`: Coding pattern identified
- `api_call`: External API call made
- `definition`: Go to definition navigation
- `reflection`: User reflection/note

## Performance

- **Event Batching**: Reduces API calls by 10-50x
- **Default Batch Size**: 10 events
- **Default Batch Interval**: 2 seconds
- **Typical Latency**: <50ms per batch

## Development

### Build

```bash
npm run compile
```

### Watch Mode

```bash
npm run watch
```

### Debug

1. Open `IDE/vscode` in VS Code
2. Press F5
3. Extension Development Host launches
4. Set breakpoints in `extension.ts`

## Troubleshooting

### Extension not connecting

Check backend is running:

```bash
curl http://localhost:3000/api/system/health
```

### Events not appearing

1. Check Output panel for errors
2. Verify `openmemory.backendUrl` setting
3. Check backend logs for incoming requests

### Session not starting

Ensure backend `/api/ide/session/start` endpoint is available:

```bash
curl -X POST http://localhost:3000/api/ide/session/start \
  -H "Content-Type: application/json" \
  -d '{"user_identifier_for_session":"test","project_name_or_workspace":"test","ide_name_and_version":"test"}'
```

## License

MIT License - See LICENSE file

## Contributing

See CONTRIBUTING.md

## Support

- GitHub Issues: https://github.com/CaviraOSS/OpenMemory/issues
- Documentation: https://github.com/CaviraOSS/OpenMemory
