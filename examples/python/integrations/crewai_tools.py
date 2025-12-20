
from crewai_tools import BaseTool
from openmemory.client import Memory
import asyncio

# ==================================================================================
# CREWAI TOOLS
# ==================================================================================
# Custom Tools for CrewAI agents to interact with OpenMemory.
# Enables agents to "Remember" and "Recall" during task execution.
# ==================================================================================

class MemorySearchTool(BaseTool):
    name: str = "Search Memory"
    description: str = "Search for past knowledge, facts, or context. Input should be a specific query string."
    
    def _run(self, query: str) -> str:
        # CrewAI tools are often sync, so we wrap async call
        return asyncio.run(self._async_run(query))

    async def _async_run(self, query: str) -> str:
        mem = Memory()
        # In a real app, pass user_id via tool args or context
        results = await mem.search(query, user_id="crew_agent", limit=3)
        if not results:
            return "No relevant memories found."
        return "\n".join([f"- {r['content']}" for r in results])

class MemoryStoreTool(BaseTool):
    name: str = "Store Memory"
    description: str = "Save important information for later. Input should be the text to remember."

    def _run(self, content: str) -> str:
        return asyncio.run(self._async_run(content))

    async def _async_run(self, content: str) -> str:
        mem = Memory()
        await mem.add(content, user_id="crew_agent", tags=["crewai"])
        return "Memory stored successfully."

# Example Usage Mock
if __name__ == "__main__":
    search_tool = MemorySearchTool()
    store_tool = MemoryStoreTool()
    
    print("CrewAI Tool Test:")
    print(store_tool.run("Projects deadline is next Friday."))
    print(search_tool.run("When is the deadline?"))
