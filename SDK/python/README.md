# OpenMemory SDK (Python)

Official Python client for **OpenMemory** — an open-source, self-hosted long-term memory engine for LLMs and AI agents.

---

## 🚀 Features

- Simple, async-friendly Python client for OpenMemory API
- Supports both **Simple (1-call)** and **Advanced (5-calls)** embedding modes
- Auto retry with exponential backoff
- Optional batching and streaming
- Typed models via Pydantic
- Works in **FastAPI**, **LangChain**, and **any async agent runtime**

---

## 📦 Installation

```bash
pip install openmemory-py
```

---

## 🧠 Quick Start

```python
from openmemory-py import OpenMemory

om = OpenMemory(
    base_url="http://localhost:8080",
    api_key="your_api_key_here"
)

# Add a memory
added = om.memory.add({
    "content": "User loves espresso and works best at night.",
    "tags": ["preferences", "coffee", "schedule"]
})

# Query memory
result = om.memory.query({
    "query": "What time does the user work?",
    "top_k": 5
})

for item in result["items"]:
    print(item["content"], "→", item["score"])
```

---

## ⚙️ Configuration

### Constructor Parameters

```python
OpenMemory(
    base_url: str,
    api_key: str | None = None,
    timeout: int = 15_000,
    headers: dict | None = None
)
```

### Environment Variables

```
OM_BASE_URL=http://localhost:8080
OM_API_KEY=your_key
```

---

## 🧩 Embedding Modes

OpenMemory supports two backend embedding configurations:

| Mode         | Description                                                                           | API Calls | Speed     | Precision    |
| ------------ | ------------------------------------------------------------------------------------- | --------- | --------- | ------------ |
| **simple**   | Unified embedding for all sectors                                                     | 1         | ⚡ Fast   | ⭐ Good      |
| **advanced** | Independent sector embeddings (episodic, semantic, procedural, emotional, reflective) | 5         | 🐢 Slower | 🌟 Excellent |

Set this in the backend `.env`:

```
OM_EMBED_MODE=simple    # or "advanced"
```

Your SDK automatically adapts to the backend configuration.

---

## 🧰 API Overview

### `om.memory.add(input: dict)`

Adds a new memory.

```python
response = om.memory.add({
    "content": "Met Alex, a software developer who codes in Rust.",
    "tags": ["meeting", "developer", "Rust"]
})
```

### `om.memory.query(params: dict)`

Queries memory semantically.

```python
result = om.memory.query({
    "query": "Who codes in Rust?",
    "top_k": 3
})
```

### `om.memory.get(id: str)`

Get memory by ID.

```python
item = om.memory.get("mem_123")
```

### `om.memory.delete(id: str)`

Delete a memory.

```python
om.memory.delete("mem_123")
```

### `om.memory.all(cursor: str | None = None, limit: int = 100)`

Paginate all memories.

---

## 🔁 Batching Example

```python
from openmemory.utils import batch

items = [
    {"content": "First memory"},
    {"content": "Second memory"},
    {"content": "Third memory"},
]

async for res in batch(items, om.memory.add, size=5, delay_ms=200):
    print(res["id"])
```

---

## 🧠 Example: LangChain Integration

```python
from openmemory import OpenMemory
from langchain.embeddings import OpenAIEmbeddings

om = OpenMemory(base_url="http://localhost:8080")

def memory_search(query: str):
    res = om.memory.query({"query": query, "top_k": 5})
    return [i["content"] for i in res["items"]]

print(memory_search("user habits"))
```

---

## 🧾 Error Handling

All errors raise `OpenMemoryError` with status and details.

```python
from openmemory.errors import OpenMemoryError

try:
    om.memory.add({"content": ""})
except OpenMemoryError as e:
    print("Status:", e.status)
    print("Body:", e.body)
```

---

## ⚙️ Development

```bash
# Build
poetry build

# Test
pytest
```

---

## 🪶 License

MIT

---

## 🌍 Links

- **Docs:** https://openmemory.cavira.app
- **GitHub:** https://github.com/caviraoss/openmemory
- **SDK (JS):** https://github.com/caviraoss/openmemory-SDK/javascript
