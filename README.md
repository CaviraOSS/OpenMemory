<img width="1577" height="781" alt="OpenMemory Banner" src="https://github.com/user-attachments/assets/3baada32-1111-4c2c-bf13-558f2034e511" />

# openmemory

[vs code extension](https://marketplace.visualstudio.com/items?itemName=Nullure.openmemory-vscode) • [report bug](https://github.com/caviraOSS/openmemory/issues) • [request feature](https://github.com/caviraOSS/openmemory/issues) • [discord](https://discord.gg/P7HaRayqTh)

local-first long-term memory engine for ai apps and agents. **self-hosted. explainable. scalable.**

![demo](https://github.com/CaviraOSS/OpenMemory/blob/main/.github/openmemory.gif?raw=true)

---

## quick start

choose your language:

### python

```bash
pip install openmemory-py
```

```python
from openmemory.client import Memory

mem = Memory()

mem.add("i'm building a django app")
results = mem.query("what am i building?")
```

[📖 python sdk docs](./packages/openmemory-py)

### javascript/typescript

```bash
npm install openmemory-js
```

```typescript
import { Memory } from 'openmemory-js';

const mem = new Memory();

await mem.add("i'm building a next.js app");
const results = await mem.search("what am i building?");
```

[📖 javascript sdk docs](./packages/openmemory-js)

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

## embedding providers

openmemory supports multiple embedding providers:

- **synthetic** - instant, no api calls (for testing/dev)
- **openai** - text-embedding-3-small/large
- **gemini** - google's embedding models
- **ollama** - fully local with llama, mistral, etc.
- **aws bedrock** - amazon titan embeddings

---

## performance tiers

- `fast` - optimized for speed, lower precision (synthetic embeddings)
- `smart` - balanced performance and accuracy (hybrid)
- `deep` - maximum accuracy, slower (pure semantic)
- `hybrid` - adaptive based on query complexity

---

## architecture

openmemory uses a hierarchical sector graph (hsg) architecture:

1. **sector classification** - automatically categorizes memories into cognitive sectors
2. **multi-vector embedding** - stores memories across multiple sectors for cross-domain recall
3. **waypoint graph** - builds associative links between related memories
4. **temporal decay** - sector-specific forgetting curves with reinforcement learning
5. **hybrid scoring** - combines semantic similarity, token overlap, temporal relevance, and feedback

---

## performance

- **115ms** average recall @ 100k memories
- **338 qps** throughput with 8 workers
- **95%** recall accuracy @ k=5
- **7.9ms/item** scoring at 10k+ scale

---

## use cases

- **ai agents** - give agents persistent memory across conversations
- **chatbots** - remember user preferences, context, and history
- **knowledge bases** - build explainable, queryable knowledge graphs
- **personal assistants** - local-first memory for privacy-conscious apps
- **research tools** - temporal knowledge tracking with automatic decay

---

## examples

- [python examples](./examples/py-sdk/) - crud, advanced features, benchmarks
- [javascript examples](./examples/js-sdk/) - typescript integration patterns
- [benchmarks](./temp/benchmarks/) - longmemeval suite for memory backends

---

## integrations

- [vs code extension](https://marketplace.visualstudio.com/items?itemName=Nullure.openmemory-vscode) - ide integration
- [mcp server](./packages/openmemory-js#mcp-server) - claude desktop integration
- [langchain](./integrations/langchain-openmemory/) - python langchain memory

---

## documentation

- [python sdk](./packages/openmemory-py/README.md)
- [javascript sdk](./packages/openmemory-js/README.md)
- [architecture overview](./docs/architecture.md)
- [api reference](./docs/api.md)

---

## license

apache 2.0

---

## community

- [github discussions](https://github.com/caviraOSS/openmemory/discussions)
- [discord](https://discord.gg/P7HaRayqTh)
- [twitter](https://twitter.com/nullure)
