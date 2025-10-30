# OpenMemory - Persistent Memory for AI Assistants

Give your AI tools instant access to your entire coding history. OpenMemory remembers everything you code and automatically provides context to GitHub Copilot, Cursor, Claude, and other AI assistants.

## Features

- Works with GitHub Copilot, Cursor, Claude, Windsurf, Codex, and any MCP-compatible AI
- Auto-configures all AI tools on first run with zero manual setup
- Tracks every file edit, save, and open automatically
- Compresses memories to reduce tokens by 30-70%
- Query responses under 80ms with smart caching
- Real-time token savings and compression metrics
- Background processing never blocks UI

## Quick Start

1. Install this extension
2. Start backend
3. Click OpenMemory icon in status bar to verify connection
4. Start coding - AI tools now access your coding memory

## Requirements

Backend server required.

## Settings

- `openmemory.backendUrl`: Backend URL (default: `http://localhost:8080`)
- `openmemory.apiKey`: API key for auth (optional)
- `openmemory.useMCP`: Use MCP protocol mode (default: `false`)

## Commands

- `OpenMemory: Query Context` - Search your coding memory
- `OpenMemory: View Patterns` - View detected patterns
- `OpenMemory: Toggle Tracking` - Pause or resume tracking
- `OpenMemory: Setup` - Configure backend and settings

## Privacy

All data stores locally. No telemetry. Open source code available for audit.

## Troubleshooting

Check backend running: `curl http://localhost:8080/health`

For issues, see [GitHub](https://github.com/CaviraOSS/OpenMemory/issues)

## Links

- [GitHub](https://github.com/CaviraOSS/OpenMemory)
- [Documentation](https://github.com/CaviraOSS/OpenMemory/blob/main/README.md)
- [Changelog](https://github.com/CaviraOSS/OpenMemory/blob/main/CHANGELOG.md)

Made by the Cavira team
