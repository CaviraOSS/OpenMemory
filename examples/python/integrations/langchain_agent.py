import asyncio
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_openai import ChatOpenAI
from openmemory import Memory
from openmemory.integrations.langchain import OpenMemoryChatMessageHistory

# ==================================================================================
# LANGCHAIN INTEGRATION
# ==================================================================================
# Demonstrates using OpenMemory as the persistent storage for a LangChain conversational agent.
# Uses `OpenMemoryChatMessageHistory` to automatically load/save history.
# ==================================================================================

# 1. Create Memory Instance
mem = Memory()

# 2. Setup Model
model = ChatOpenAI(model="gpt-4o", temperature=0)

# 3. Setup Prompt
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant with long-term memory."),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}"),
])

# 4. Create Chain
chain = prompt | model

# 5. Wrap with History
# This wrapper will:
# - Call `history.messages` to get context.
# - Call `history.add_message` after generation.
chain_with_history = RunnableWithMessageHistory(
    chain,
    lambda session_id: OpenMemoryChatMessageHistory(
        memory=mem,
        user_id=session_id,
        session_id=session_id
    ),
    input_messages_key="input",
    history_messages_key="history",
)

async def main():
    session_id = "user_langchain_01"
    print(f"Starting chat session: {session_id}")

    # First turn
    print("\nUser: Hi, I'm Bob and I like Python.")
    response1 = await chain_with_history.ainvoke(
        {"input": "Hi, I'm Bob and I like Python."},
        config={"configurable": {"session_id": session_id}},
    )
    print(f"AI: {response1.content}")

    # Small delay to ensure async persistence completes
    await asyncio.sleep(0.5)

    # Second turn (New session instance, but same ID -> Recall)
    print("\nUser: What is my name?")
    response2 = await chain_with_history.ainvoke(
        {"input": "What is my name?"},
        config={"configurable": {"session_id": session_id}},
    )
    print(f"AI: {response2.content}")

if __name__ == "__main__":
    asyncio.run(main())
