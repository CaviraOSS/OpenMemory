<!--
     __                      __  ___                               
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ / 
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /  
                     /____/                                 /____/   

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : integrations/mcp-configs/README.md
 usage : configures the LongMemory mcp-configs integration
-->

# LongMemory MCP configuration packs

These ready-to-merge templates connect hosts that support MCP without requiring a dedicated plugin runtime.

## Cline

Merge `cline.json` into the MCP settings opened from Cline's **MCP Servers > Configure** panel, or use it as `~/.cline/mcp.json` with Cline CLI. The server starts through local stdio and leaves all tools approval-gated.

## Continue

Copy `continue.yaml` into the workspace's `.continue/mcpServers/` directory. LongMemory tools are available in Continue agent mode.

## LibreChat

Merge `librechat.yaml` into `librechat.yaml`, set `LONGMEMORY_API_KEY` in the LibreChat server environment, and start LongMemory with:

```bash
longmemory serve --mcp-http
```

The sample assumes LibreChat runs in Docker and LongMemory runs on the host. Change both `url` and `mcpSettings.allowedAddresses` together for another deployment topology.
