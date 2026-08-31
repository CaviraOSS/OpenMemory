<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : integrations/longmemory-agent-plugin/README.md
 usage : configures the LongMemory longmemory-agent-plugin integration
-->

# LongMemory Agent Plugin

A portable Agent Plugins 1.0 bundle for OpenClaw and compatible hosts.

## Install in OpenClaw

1. Start LongMemory with `longmemory serve --mcp-http`.
2. Set `LONGMEMORY_API_KEY` in the OpenClaw gateway environment.
3. Install this directory:

```bash
openclaw plugins install ./integrations/longmemory-agent-plugin
openclaw plugins inspect longmemory
openclaw gateway restart
```

The bundle contributes the LongMemory Streamable HTTP MCP server and an `longmemory` skill. It contains no executable plugin runtime code.

To use a different server URL, override `mcp.servers.longmemory` in OpenClaw configuration; operator configuration takes precedence over bundle defaults.
