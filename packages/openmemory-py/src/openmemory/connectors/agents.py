from typing import Any, List, Dict
from ..main import Memory
class CrewAIMemory:
    """
    Adapter for CrewAI's memory system.
    Usage:
    crew = Crew(..., memory=True, memory_config={"provider": CrewAIMemory(mem_instance)})
    """
    def __init__(self, memory: Memory, user_id: str = "crew_agent"):
        self.mem = memory
        self.user_id = user_id

    def save(self, value: Any, metadata: Dict[str, Any] = None) -> None:
        if isinstance(value, str):
            self.mem.add(value, user_id=self.user_id, meta=metadata)

    def search(self, query: str, limit: int = 3) -> List[Any]:
        results = self.mem.search(query, user_id=self.user_id)
        return [r["content"] for r in results[:limit]]
def memory_node(state: Dict, memory: Memory, user_key: str = "user_id", input_key: str = "messages"):
    """
    LangGraph node to automatically persist state to memory.
    """
    messages = state.get(input_key, [])
    user_id = state.get(user_key, "anonymous")

    if messages:
        last_msg = messages[-1]
        content = getattr(last_msg, "content", str(last_msg))
        memory.add(content, user_id=user_id)
    return state
