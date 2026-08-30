<!--
     __                      __  ___                               
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ / 
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /  
                     /____/                                 /____/   

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : integrations/claude-code-longmemory/README.md
 usage : configures the LongMemory claude-code-longmemory integration
-->

# LongMemory for Claude Code

A native Claude Code plugin containing an LongMemory skill and local stdio MCP server configuration.

Prerequisite: install and initialize the `longmemory` CLI.

```bash
claude plugin validate ./integrations/claude-code-longmemory --strict
claude --plugin-dir ./integrations/claude-code-longmemory
```

For permanent distribution, add this plugin to a Claude Code marketplace and install it with `claude plugin install`.
