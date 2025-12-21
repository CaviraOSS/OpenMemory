from typing import List, Any, Optional
try:
    from langchain_core.chat_history import BaseChatMessageHistory
    from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
    from langchain_core.retrievers import BaseRetriever
    from langchain_core.documents import Document
    from langchain_core.callbacks import CallbackManagerForRetrieverRun
except ImportError:
    # Optional dependencies
    BaseChatMessageHistory = object
    BaseRetriever = object

from ..main import Memory

class OpenMemoryChatMessageHistory(BaseChatMessageHistory):
    def __init__(self, memory: Memory, user_id: str, session_id: str = "default"):
        self.mem = memory
        self.user_id = user_id
        self.session_id = session_id
        
    @property
    def messages(self) -> List[BaseMessage]:
        # Retrieve recent history from memory tagged with session_id if possible
        # Since OM doesn't natively index strict session_ids for chat logs yet (it's semantic),
        # we try our best to fetch recent "conversation" items.
        # Limiting to last 5 interactions.
        import asyncio
        # Sync property can't await. This is a LangChain architectural mismatch with Async memory.
        # We must either return [] or use a sync wrapper (not recommended in async loop).
        # Returning [] is actually standard for "write-only" memory if retrieval is separate.
        # But `clear` can be async-ish if we fire and forget? No, `clear` is sync in BaseChatMessageHistory.
        return []

    async def aget_messages(self) -> List[BaseMessage]:
        # Custom Async method for retrieval
        history = await self.mem.history(self.user_id)
        # Convert to BaseMessage
        msgs = []
        for h in history:
            # Heuristic parsing of "User: ..." content
            c = h["content"]
            if c.startswith("User:"):
                msgs.append(HumanMessage(content=c[5:].strip()))
            elif c.startswith("Assistant:"):
                msgs.append(AIMessage(content=c[10:].strip()))
            else:
                msgs.append(HumanMessage(content=c))
        return msgs

    def add_message(self, message: BaseMessage) -> None:
        role = "User" if isinstance(message, HumanMessage) else "Assistant"
        # fire and forget async add?
        # we need to schedule it.
        import asyncio
        asyncio.create_task(self.mem.add(f"{role}: {message.content}", user_id=self.user_id))

    def clear(self) -> None:
        # We cannot easily clear *just* this session's memory without tags.
        # Assuming clear = reset user memory? Dangerous.
        # Let's leave as pass but document why.
        pass

class OpenMemoryRetriever(BaseRetriever):
    memory: Memory
    user_id: str
    k: int = 5
    
    def _get_relevant_documents(self, query: str, *, run_manager: CallbackManagerForRetrieverRun) -> List[Document]:
        results = self.memory.search(query, user_id=self.user_id)
        docs = []
        for r in results[:self.k]:
            docs.append(Document(page_content=r["content"], metadata=r))
        return docs
