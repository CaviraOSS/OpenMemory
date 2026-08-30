<!--
     __                      __  ___                               
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ / 
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /  
                     /____/                                 /____/   

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : integrations/n8n-nodes-longmemory/README.md
 usage : configures the LongMemory n8n-nodes-longmemory integration
-->

# @cavira/n8n-nodes-longmemory

An n8n community node for LongMemory. It can be used as a normal workflow node or as an AI Agent tool.

Operations:

- Recall memory in strict, historical, associative, or world-grounded mode
- Store a memory through the immutable ingest pipeline
- Explain a memory and its graph edges
- Read engine statistics

Configure an LongMemory API credential with the server URL and optional API key. Start LongMemory with `longmemory serve` before running workflows.

For project context, governed assets, and Skills, attach LongMemory's Streamable HTTP MCP endpoint to n8n's MCP Client Tool.
