from typing import List, Any, Optional
try:
    from langchain_core.chat_history import BaseChatMessageHistory
    from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
    from langchain_core.retrievers import BaseRetriever
    from langchain_core.documents import Document
    from langchain_core.callbacks import CallbackManagerForRetrieverRun
except ImportError:
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
        import asyncio
        return []

    async def aget_messages(self) -> List[BaseMessage]:
        history = await self.mem.history(self.user_id)
        msgs = []
        for h in history:
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
        import asyncio
        asyncio.create_task(self.mem.add(f"{role}: {message.content}", user_id=self.user_id))

    def clear(self) -> None:
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
