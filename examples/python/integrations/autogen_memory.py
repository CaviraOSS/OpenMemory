
import asyncio
from openmemory.client import Memory
# import autogen # standard import

# ==================================================================================
# AUTOGEN MEMORY
# ==================================================================================
# Define functions that AutoGen agents can call to access memory.
# ==================================================================================

mem = Memory()
UID = "autogen_user"

async def store_info(info: str) -> str:
    """Store important information."""
    await mem.add(info, user_id=UID, tags=["autogen"])
    return "Stored."

async def recall_info(query: str) -> str:
    """Search for information."""
    hits = await mem.search(query, user_id=UID, limit=3)
    if not hits: return "No info found."
    return "\n".join([h['content'] for h in hits])

# AutoGen Wrapper
# Since AutoGen often expects Sync functions for tool calls (depending on config),
# we might need sync wrappers.

def store_info_sync(info: str) -> str:
    return asyncio.run(store_info(info))

def recall_info_sync(query: str) -> str:
    return asyncio.run(recall_info(query))

def main():
    config_list = [{"model": "gpt-4", "api_key": "..."}]
    
    # 1. Define Agent
    # assistant = autogen.AssistantAgent("assistant", llm_config={"config_list": config_list})
    # user_proxy = autogen.UserProxyAgent("user", human_input_mode="NEVER")
    
    # 2. Register Functions
    # autogen.register_function(store_info_sync, caller=assistant, executor=user_proxy, description="Save info")
    # autogen.register_function(recall_info_sync, caller=assistant, executor=user_proxy, description="Search info")
    
    # 3. Chat
    # user_proxy.initiate_chat(assistant, message="My favorite color is blue. Remember that.")
    pass

if __name__ == "__main__":
    # Mock run since we don't assume autogen package is installed
    print("AutoGen function wrappers defined. Register `store_info_sync` and `recall_info_sync` with your agents.")
    print(store_info_sync("Test memory"))
    print(recall_info_sync("Test"))
