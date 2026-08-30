<!--
     __                      __  ___                               
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ / 
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /  
                     /____/                                 /____/   

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : integrations/frameworks/README.md
 usage : demonstrates LongMemory with README.md
-->

# LongMemory agent framework examples

Runnable examples connect popular Python agent frameworks to the installed LongMemory CLI through each framework's native MCP client.

| Framework           | Native integration                                    |
| ------------------- | ----------------------------------------------------- |
| CrewAI              | `Agent.mcps` with `MCPServerStdio`                    |
| AutoGen             | `McpWorkbench` with `StdioServerParams`               |
| LangGraph/LangChain | `MultiServerMCPClient` tools passed to `create_agent` |
| OpenAI Agents SDK   | `MCPServerStdio` attached through `Agent.mcp_servers` |
| PydanticAI          | `MCPToolset` backed by FastMCP `StdioTransport`       |

## Run an example

Install and initialize the LongMemory CLI first. Then create an isolated Python environment inside the chosen example directory:

```powershell
cd integrations/frameworks/crewai
py -3.11 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python main.py
```

Use the same steps for `autogen`, `langgraph`, `openai-agents`, or `pydantic-ai`.

Each example accepts:

- `LONGMEMORY_COMMAND`: override the LongMemory executable; defaults to `longmemory.cmd` on Windows and `longmemory` elsewhere.
- `LONGMEMORY_MODEL`: override the framework-specific model identifier.
- `LONGMEMORY_TASK`: replace the default project-context request.

The model provider's own credentials are still required by the selected framework. No credential belongs in these files.

## Deployment boundary

The examples use local stdio so the framework owns the LongMemory subprocess lifecycle. For a hosted or multi-user deployment, use the framework's Streamable HTTP MCP class with `longmemory serve --mcp-http`, bearer authentication, and a server-bound tenant, user, project, agent, and framework identity. Never derive those identities from model-generated tool arguments.
