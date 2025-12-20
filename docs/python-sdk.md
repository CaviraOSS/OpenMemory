# Python SDK Reference

The `openmemory` package provides a pythonic interface to the OpenMemory system.

## Core Classes

### `Memory`

The main entry point.

```python
from openmemory.client import Memory

mem = Memory()
```

#### Methods

*   `add(content: str, user_id: str = "default", metadata: dict = None) -> dict`
    *   Stores a new memory.
    *   **Returns**: The created memory object (including ID).

*   `search(query: str, user_id: str, limit: int = 5) -> list[dict]`
    *   Retrieves relevant memories based on semantic similarity + recency.
    *   **Returns**: List of memory objects, sorted by score.

*   `delete(memory_id: str) -> bool`
    *   Removes a memory by ID.

*   `history(user_id: str) -> list[dict]`
    *   Returns the temporal chain of interactions for a user.

### `OpenAIWrapper`

A helper to automatically inject long-term memory into OpenAI API calls.

```python
from openmemory.openai_handler import OpenAIWrapper
from openai import OpenAI

client = OpenAIWrapper(OpenAI(), memory_instance)

# Use as normal - context is auto-injected system prompt
resp = client.chat.completions.create(...)
```

## Integrations

### LangChain

```python
from openmemory.integrations.langchain import OpenMemoryChatMessageHistory

history = OpenMemoryChatMessageHistory(user_id="u1")
history.add_user_message("Hi!")
```
