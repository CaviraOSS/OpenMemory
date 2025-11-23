<img width="1577" height="781" alt="OpenMemory Banner" src="https://github.com/user-attachments/assets/3baada32-1111-4c2c-bf13-558f2034e511" />

# OpenMemory JavaScript SDK

[VS Code Extension](https://marketplace.visualstudio.com/items?itemName=Nullure.openmemory-vscode) • [Report Bug](https://github.com/caviraOSS/openmemory/issues) • [Request Feature](https://github.com/caviraOSS/openmemor/issues) • [Discord](https://discord.gg/P7HaRayqTh)

Local-first long-term memory engine for AI apps and agents. **Self-hosted. Explainable. Scalable.**

![Demo](https://github.com/CaviraOSS/OpenMemory/blob/main/.github/openmemory.gif?raw=true)

---

## Quick Start

```bash
npm install openmemory-js
```

```javascript
import { OpenMemory } from 'openmemory-js';

const mem = new OpenMemory({
  path: './data/memory.sqlite',
  tier: 'fast',
  embeddings: {
    provider: 'synthetic'  // or 'openai', 'gemini', 'ollama'
  }
});

await mem.add("I'm building a Next.js app with OpenMemory");
const results = await mem.query("What am I building?");
console.log(results);
```

**That's it.** You're now running a fully local cognitive memory engine 🎉

---

## Features

✅ **Local-first** - Runs entirely on your machine, zero external dependencies  
✅ **Multi-sector memory** - Episodic, Semantic, Procedural, Emotional, Reflective  
✅ **Temporal knowledge graph** - Time-aware facts with validity periods  
✅ **Memory decay** - Adaptive forgetting with sector-specific rates  
✅ **Waypoint graph** - Associative recall paths for better retrieval  
✅ **Explainable traces** - See exactly why memories were recalled  
✅ **Zero config** - Works out of the box with sensible defaults  

---

## Configuration

### Required Configuration

All three parameters are **required** for local mode:

```javascript
const mem = new OpenMemory({
  path: './data/memory.sqlite',      // Where to store the database
  tier: 'fast',                       // Performance tier
  embeddings: {
    provider: 'synthetic'             // Embedding provider
  }
});
```

### Embedding Providers

#### Synthetic (Testing/Development)
```javascript
embeddings: {
  provider: 'synthetic'
}
```

#### OpenAI (Recommended for Production)
```javascript
embeddings: {
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small'  // optional
}
```

#### Gemini
```javascript
embeddings: {
  provider: 'gemini',
  apiKey: process.env.GEMINI_API_KEY
}
```

#### Ollama (Fully Local)
```javascript
embeddings: {
  provider: 'ollama',
  model: 'llama3',
  ollama: {
    url: 'http://localhost:11434'  // optional
  }
}
```

#### AWS Bedrock
```javascript
embeddings: {
  provider: 'aws',
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: 'us-east-1'
  }
}
```

### Performance Tiers

- `fast` - Optimized for speed, lower precision
- `smart` - Balanced performance and accuracy
- `deep` - Maximum accuracy, slower
- `hybrid` - Adaptive based on query complexity

### Advanced Configuration

```javascript
const mem = new OpenMemory({
  path: './data/memory.sqlite',
  tier: 'smart',
  embeddings: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY
  },
  decay: {
    intervalMinutes: 60,
    reinforceOnQuery: true,
    coldThreshold: 0.1
  },
  compression: {
    enabled: true,
    algorithm: 'semantic',
    minLength: 100
  },
  reflection: {
    enabled: true,
    intervalMinutes: 10,
    minMemories: 5
  }
});
```

---

## API Reference

### `add(content, options?)`

Store a new memory.

```javascript
const result = await mem.add("User prefers dark mode", {
  tags: ["preference", "ui"],
  metadata: { category: "settings" },
  decayLambda: 0.01  // Custom decay rate
});
```

### `query(query, options?)`

Search for relevant memories.

```javascript
const results = await mem.query("user preferences", {
  limit: 10,
  minScore: 0.7
});
```

### `getAll(options?)`

Retrieve all memories.

```javascript
const all = await mem.getAll({
  limit: 100,
  offset: 0
});
```

### `getBySector(sector, options?)`

Get memories from a specific cognitive sector.

```javascript
const episodic = await mem.getBySector('episodic', { limit: 20 });
const semantic = await mem.getBySector('semantic');
```

Available sectors: `episodic`, `semantic`, `procedural`, `emotional`, `reflective`

### `delete(id)`

Remove a memory by ID.

```javascript
await mem.delete(memoryId);
```

---

## Cognitive Sectors

OpenMemory automatically classifies content into 5 cognitive sectors:

| Sector | Description | Examples | Decay Rate |
|--------|-------------|----------|------------|
| **Episodic** | Time-bound events & experiences | "Yesterday I attended a conference" | Medium |
| **Semantic** | Timeless facts & knowledge | "Paris is the capital of France" | Very Low |
| **Procedural** | Skills, procedures, how-tos | "To deploy: build, test, push" | Low |
| **Emotional** | Feelings, sentiment, mood | "I'm excited about this project!" | High |
| **Reflective** | Meta-cognition, insights | "I learn best through practice" | Very Low |

---

## Examples

Check out the `examples/js-sdk/` directory for comprehensive examples:

- **basic-usage.js** - CRUD operations
- **advanced-features.js** - Decay, compression, reflection
- **brain-sectors.js** - Multi-sector demonstration

---

## Remote Mode

For production deployments with a centralized OpenMemory server:

```javascript
const mem = new OpenMemory({
  mode: 'remote',
  url: 'https://your-backend.com',
  apiKey: 'your-api-key'
});
```

---

## Performance

- **115ms** average recall @ 100k memories
- **338 QPS** throughput with 8 workers
- **95%** recall accuracy @ k=5
- **7.9ms/item** scoring at 10k+ scale

---

## TypeScript Support

Full TypeScript declarations included:

```typescript
import { OpenMemory, OpenMemoryOptions } from 'openmemory-js';

const mem: OpenMemory = new OpenMemory({
  path: './data/memory.sqlite',
  tier: 'fast',
  embeddings: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY
  }
});
```

---

## License

Apache 2.0

---

## Links

- [Main Repository](https://github.com/caviraOSS/openmemory)
- [Documentation](https://github.com/caviraOSS/openmemory/blob/main/README.md)
- [Examples](../examples/js-sdk)
- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=Nullure.openmemory-vscode)
