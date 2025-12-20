# openmemory python sdk

[![pypi version](https://badge.fury.io/py/openmemory-py.svg)](https://pypi.org/project/openmemory-py/)

local-first long-term memory engine for ai apps and agents. **self-hosted. explainable. scalable.**

## quick start

```bash
pip install openmemory-py
```

```python
from openmemory.client import Memory

mem = Memory()

mem.add("i'm building a django app with openmemory")
results = mem.query("what am i building?")
print(results)
```

**that's it.** you're now running a fully local cognitive memory engine 🎉

## features

✅ **local-first** - runs entirely on your machine, zero external dependencies  
✅ **multi-sector memory** - episodic, semantic, procedural, emotional, reflective  
✅ **temporal knowledge graph** - time-aware facts with validity periods  
✅ **memory decay** - adaptive forgetting with sector-specific rates  
✅ **waypoint graph** - associative recall paths for better retrieval  
✅ **explainable traces** - see exactly why memories were recalled  
✅ **zero config** - works out of the box with sensible defaults  

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
import os

embeddings={
    'provider': 'openai',
    'apiKey': os.getenv('OPENAI_API_KEY'),
    'model': 'text-embedding-3-small'  # optional
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
    'ollama': {
        'url': 'http://localhost:11434'  # optional
    }
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

### advanced configuration

```python
from openmemory.client import Memory
import os

mem = Memory(
    path='./data/memory.sqlite',
    tier='smart',
    embeddings='openai',  # or dict for detailed config
    decay={
        'intervalMinutes': 60,
        'reinforceOnQuery': True,
        'coldThreshold': 0.1
    },
    compression={
        'enabled': True,
        'algorithm': 'semantic',
        'minLength': 100
    },
    reflection={
        'enabled': True,
        'intervalMinutes': 10,
        'minMemories': 5
    }
)

# api keys via environment variables
os.environ['OPENAI_API_KEY'] = 'sk-...'
os.environ['GEMINI_API_KEY'] = 'AIza...'
```

## api reference

### `add(content, **options)`

store a new memory.

```python
result = mem.add(
    "user prefers dark mode",
    tags=["preference", "ui"],
    metadata={"category": "settings"},
    decayLambda=0.01  # custom decay rate
)
```

### `query(query, **options)`

search for relevant memories.

```python
results = mem.query("user preferences", limit=10, minScore=0.7)
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

available sectors: `episodic`, `semantic`, `procedural`, `emotional`, `reflective`

### `delete(id)`

remove a memory by id.

```python
mem.delete(memory_id)
```

### `close()`

close the database connection (important for cleanup).

```python
mem.close()
```

## cognitive sectors

openmemory automatically classifies content into 5 cognitive sectors:

| sector | description | examples | decay rate |
|--------|-------------|----------|------------|
| **episodic** | time-bound events & experiences | "yesterday i attended a conference" | medium |
| **semantic** | timeless facts & knowledge | "paris is the capital of france" | very low |
| **procedural** | skills, procedures, how-tos | "to deploy: build, test, push" | low |
| **emotional** | feelings, sentiment, mood | "i'm excited about this project!" | high |
| **reflective** | meta-cognition, insights | "i learn best through practice" | very low |

## examples

check out the `examples/py-sdk/` directory for comprehensive examples:

- **basic_usage.py** - crud operations
- **advanced_features.py** - decay, compression, reflection
- **brain_sectors.py** - multi-sector demonstration
- **performance_benchmark.py** - performance testing

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

## performance

- **115ms** average recall @ 100k memories
- **338 qps** throughput with 8 workers
- **95%** recall accuracy @ k=5
- **7.9ms/item** scoring at 10k+ scale

## type hints

full type hint support included:

```python
from typing import List, Dict, Any
from openmemory.client import Memory

mem: Memory = Memory()

results: List[Dict[str, Any]] = mem.query("test")
```

## license

apache 2.0

## links

- [main repository](https://github.com/caviraOSS/openmemory)
- [javascript sdk](../openmemory-js)
- [vs code extension](https://marketplace.visualstudio.com/items?itemName=Nullure.openmemory-vscode)
