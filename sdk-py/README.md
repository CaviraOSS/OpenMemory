# OpenMemory SDK (Python)

Official Python client for **OpenMemory** — an open-source, self-hosted long-term memory engine for LLMs and AI agents with advanced agent registration and namespace management.

---

## 🚀 Features

- Simple, async-friendly Python client for OpenMemory API
- **Agent registration and namespace isolation**
- **Multi-agent collaboration with shared namespaces**
- **Secure API key authentication**
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

### Basic Memory Operations

```python
from openmemory import OpenMemory

# Traditional client for basic operations
om = OpenMemory(
    base_url="http://localhost:8080",
    api_key="your_api_key_here"
)

# Add a memory
result = om.add(
    content="User loves espresso and works best at night.",
    tags=["preferences", "coffee", "schedule"]
)

# Query memory
result = om.query(
    query="What time does the user work?",
    k=5
)

for item in result["memories"]:
    print(f"{item['content']} → Score: {item['score']}")
```

### Agent-Based Operations (New!)

```python
from openmemory import OpenMemoryAgent

# Create an agent with automatic registration
agent = OpenMemoryAgent(
    agent_id="my-research-assistant",
    namespace="research-workspace",
    description="AI research assistant for paper analysis",
    permissions=["read", "write"],
    shared_namespaces=["team-knowledge", "public-papers"]
)

# Agent automatically gets an API key and isolated namespace
print(f"Agent registered with API key: {agent.api_key}")
print(f"Primary namespace: {agent.namespace}")

# Store memories in agent's namespace
result = agent.store_memory(
    content="Latest transformer architecture shows 20% improvement",
    sector="semantic",
    salience=0.9,
    metadata={"paper": "attention-2024", "improvement": 0.20}
)

# Query memories with agent context
memories = agent.query_memory(
    query="transformer improvements",
    k=5,
    min_salience=0.5
)

print(f"Found {memories['total_results']} relevant memories")
for memory in memories['results']:
    print(f"- {memory['content'][:60]}...")
```

---

## 🤖 Agent Registration & Namespaces

OpenMemory now supports advanced agent registration and namespace management for multi-agent scenarios.

### Key Concepts

- **Agent Registration**: Each agent gets a unique ID and API key
- **Namespace Isolation**: Agents operate in private memory spaces
- **Shared Namespaces**: Enable collaboration between agents
- **Permission Management**: Control read/write/admin access

### Agent Registration Methods

#### Method 1: Automatic Registration
```python
from openmemory import OpenMemoryAgent

# Agent registers automatically on creation
agent = OpenMemoryAgent(
    agent_id="research-assistant-v2",
    namespace="research-workspace",
    description="AI research assistant",
    permissions=["read", "write"],
    shared_namespaces=["public-papers", "team-knowledge"]
)

print(f"API Key: {agent.api_key}")
```

#### Method 2: Manual Registration
```python
from openmemory import register_agent, create_agent_client

# Register first
registration = register_agent(
    agent_id="data-analyst",
    namespace="analytics-workspace",
    description="Data analysis agent"
)

# Then create client
agent = create_agent_client(
    agent_id=registration.agent_id,
    api_key=registration.api_key
)
```

### Memory Operations with Agents

```python
# Store in agent's private namespace
result = agent.store_memory(
    content="User prefers dark mode interface",
    sector="semantic",
    salience=0.8
)

# Store in shared namespace
result = agent.store_memory(
    content="Best practices for Python development",
    namespace="team-knowledge",  # shared namespace
    sector="procedural",
    salience=0.7
)

# Query with namespace context
memories = agent.query_memory(
    query="user interface preferences",
    k=5,
    namespace="team-knowledge"  # query shared space
)

# Reinforce important memories
agent.reinforce_memory(memory_id="mem_123456")
```

### Namespace Management

```python
from openmemory import NamespaceManager

# Create namespace manager
ns_manager = NamespaceManager()

# List all namespaces
namespaces = ns_manager.list_namespaces()
for ns in namespaces:
    print(f"Namespace: {ns['namespace']} ({ns['group_type']})")

# Find agents with access to namespace
agents = ns_manager.get_namespace_agents("team-knowledge")
print(f"Agents with access: {agents}")

# Suggest namespace names
suggestion = ns_manager.suggest_namespace_name(
    agent_id="ml-researcher",
    purpose="machine learning experiments"
)
print(f"Suggested namespace: {suggestion}")
```

### Multi-Agent Collaboration

```python
# Create multiple agents with shared access
researcher = OpenMemoryAgent(
    agent_id="researcher-alice",
    namespace="alice-research",
    shared_namespaces=["team-project", "public-data"]
)

analyst = OpenMemoryAgent(
    agent_id="analyst-bob", 
    namespace="bob-analysis",
    shared_namespaces=["team-project", "research-reports"]
)

# Researcher shares findings
researcher.store_memory(
    content="New algorithm shows 25% improvement in accuracy",
    namespace="team-project",  # shared space
    sector="semantic"
)

# Analyst accesses shared knowledge
findings = analyst.query_memory(
    query="algorithm improvement accuracy",
    namespace="team-project",
    k=5
)
```

### Agent Management

```python
# List all registered agents
agents = agent.list_agents(show_api_keys=False)
for a in agents:
    print(f"Agent: {a.agent_id} (namespace: {a.namespace})")

# Check agent health and status
health = agent.health_check()
print(f"Agent registered: {health['agent_registered']}")
print(f"Proxy healthy: {health['proxy_healthy']}")

# Get registration templates and info
template = agent.get_registration_template('json')
proxy_info = agent.get_proxy_info()
```

---

## ⚙️ Configuration

### Constructor Parameters

```python
# Traditional client
OpenMemory(
    base_url: str,
    api_key: str | None = None,
    timeout: int = 15_000,
    headers: dict | None = None
)

# Agent client
OpenMemoryAgent(
    agent_id: str,
    base_url: str = 'http://localhost:8080',
    api_key: str | None = None,
    namespace: str | None = None,
    permissions: List[str] | None = None,
    shared_namespaces: List[str] | None = None,
    description: str | None = None,
    auto_register: bool = True
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

Apache 2.0

---

## 🌍 Links

- **Docs:** https://openmemory.cavira.app
- **GitHub:** https://github.com/caviraoss/openmemory
- **SDK (JS):** https://github.com/caviraoss/openmemory-sdk-js
