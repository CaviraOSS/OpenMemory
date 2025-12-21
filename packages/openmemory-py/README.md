# openmemory python sdk

> **real long-term memory for ai agents. not rag. not a vector db. self-hosted.**

[![pypi version](https://img.shields.io/pypi/v/openmemory-py.svg)](https://pypi.org/project/openmemory-py/)
[![license](https://img.shields.io/github/license/CaviraOSS/OpenMemory)](https://github.com/CaviraOSS/OpenMemory/blob/main/LICENSE)
[![discord](https://img.shields.io/discord/1300368230320697404?label=Discord)](https://discord.gg/P7HaRayqTh)

openmemory is a **cognitive memory engine** for llms and agents.

- 🧠 real long-term memory (not just embeddings in a table)
- 💾 self-hosted, local-first (sqlite / postgres)
- 🧩 integrations: langchain, crewai, autogen, streamlit, mcp
- 📥 sources: github, notion, google drive, onedrive, web crawler
- 🔍 explainable traces (see *why* something was recalled)

your model stays stateless. **your app stops being amnesiac.**

---

## quick start

```bash
pip install openmemory-py
```

```python
from openmemory.client import Memory

mem = Memory()
mem.add("user prefers dark mode", user_id="u1")
results = mem.search("preferences", user_id="u1")
```

> note: `add`, `search`, `get`, `delete` are async. use `await` in async contexts.

**that's it.** you're now running a fully local cognitive memory engine 🎉

---

## integrations

### 🔗 openai

```python
mem = Memory()
client = mem.openai.register(OpenAI(), user_id="u1")
resp = client.chat.completions.create(...)
```

### 🧱 langchain

```python
from openmemory.integrations.langchain import OpenMemoryChatMessageHistory

history = OpenMemoryChatMessageHistory(memory=mem, user_id="u1")
```

### 🤝 crewai / autogen / streamlit

openmemory is designed to sit behind **agent frameworks and uis**:

- crew-style agents: use `Memory` as a shared long-term store
- autogen-style orchestrations: store dialog + tool calls as episodic memory
- streamlit apps: give each user a persistent memory by `user_id`

---

## 📥 sources (connectors)

ingest data from external sources directly into memory:

```python
github = mem.source("github")
await github.connect(token="ghp_...")
await github.ingest_all(repo="owner/repo")
```

available sources: `github`, `notion`, `google_drive`, `google_sheets`, `google_slides`, `onedrive`, `web_crawler`

---

## features

✅ **local-first** - runs entirely on your machine, zero external dependencies  
✅ **multi-sector memory** - episodic, semantic, procedural, emotional, reflective  
✅ **temporal knowledge graph** - time-aware facts with validity periods  
✅ **memory decay** - adaptive forgetting with sector-specific rates  
✅ **waypoint graph** - associative recall paths for better retrieval  
✅ **explainable traces** - see exactly why memories were recalled  
✅ **zero config** - works out of the box with sensible defaults  

---

## cognitive sectors

openmemory automatically classifies content into 5 cognitive sectors:

| sector | description | examples | decay rate |
|--------|-------------|----------|------------|
| **episodic** | time-bound events & experiences | "yesterday i attended a conference" | medium |
| **semantic** | timeless facts & knowledge | "paris is the capital of france" | very low |
| **procedural** | skills, procedures, how-tos | "to deploy: build, test, push" | low |
| **emotional** | feelings, sentiment, mood | "i'm excited about this project!" | high |
| **reflective** | meta-cognition, insights | "i learn best through practice" | very low |

---

## configuration

### zero-config (default)

works out of the box with sensible defaults:

```python
from openmemory.client import Memory

mem = Memory()  # uses sqlite in-memory, fast tier, synthetic embeddings
```

### optional configuration

customize via environment variables or constructor:

```python
# via environment variables
import os
os.environ['OM_DB_PATH'] = './data/memory.sqlite'
os.environ['OM_TIER'] = 'deep'
os.environ['OM_EMBEDDINGS'] = 'ollama'

mem = Memory()

# or via constructor
mem = Memory(
    path='./data/memory.sqlite',
    tier='deep',
    embeddings='ollama'
)
```

### embedding providers

#### synthetic (testing/development)
```python
embeddings={'provider': 'synthetic'}
```

#### openai (recommended for production)
```python
embeddings={
    'provider': 'openai',
    'apiKey': os.getenv('OPENAI_API_KEY'),
    'model': 'text-embedding-3-small'
}
```

#### gemini
```python
embeddings={
    'provider': 'gemini',
    'apiKey': os.getenv('GEMINI_API_KEY')
}
```

#### ollama (fully local)
```python
embeddings={
    'provider': 'ollama',
    'model': 'llama3',
    'ollama': {'url': 'http://localhost:11434'}
}
```

#### aws bedrock
```python
embeddings={
    'provider': 'aws',
    'aws': {
        'accessKeyId': os.getenv('AWS_ACCESS_KEY_ID'),
        'secretAccessKey': os.getenv('AWS_SECRET_ACCESS_KEY'),
        'region': 'us-east-1'
    }
}
```

### performance tiers

- `fast` - optimized for speed, lower precision
- `smart` - balanced performance and accuracy
- `deep` - maximum accuracy, slower
- `hybrid` - adaptive based on query complexity

---

## api reference

### `add(content, **options)`

store a new memory.

```python
result = mem.add(
    "user prefers dark mode",
    tags=["preference", "ui"],
    metadata={"category": "settings"},
    decayLambda=0.01
)
```

### `search(query, **options)` / `query(query, **options)`

search for relevant memories.

```python
results = mem.search("user preferences", limit=10, minScore=0.7)
```

### `getAll(**options)`

retrieve all memories.

```python
all_memories = mem.getAll(limit=100, offset=0)
```

### `getBySector(sector, **options)`

get memories from a specific cognitive sector.

```python
episodic = mem.getBySector('episodic', limit=20)
semantic = mem.getBySector('semantic')
```

### `delete(id)`

remove a memory by id.

```python
mem.delete(memory_id)
```

### `close()`

close the database connection.

```python
mem.close()
```

---

## performance

- **115ms** average recall @ 100k memories
- **338 qps** throughput with 8 workers
- **95%** recall accuracy @ k=5
- **7.9ms/item** scoring at 10k+ scale

---

## examples

check out the `examples/py-sdk/` directory for comprehensive examples:

- **basic_usage.py** - crud operations
- **advanced_features.py** - decay, compression, reflection
- **brain_sectors.py** - multi-sector demonstration
- **performance_benchmark.py** - performance testing

---

## remote mode

for production deployments with a centralized openmemory server:

```python
from openmemory.client import Memory

mem = Memory(
    mode='remote',
    url='https://your-backend.com',
    api_key='your-api-key'
)
```

---

## license

apache 2.0

---

## links

- [main repository](https://github.com/CaviraOSS/OpenMemory)
- [javascript sdk](https://www.npmjs.com/package/openmemory-js)
- [vs code extension](https://marketplace.visualstudio.com/items?itemName=Nullure.openmemory-vscode)
- [documentation](https://openmemory.cavira.app/docs/sdks/python)
- [discord](https://discord.gg/P7HaRayqTh)
