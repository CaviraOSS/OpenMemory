# OpenMemory SDK (JavaScript/TypeScript)

Official JavaScript/TypeScript client for OpenMemory — an open-source, self-hosted memory engine for LLMs and AI agents.

## Features

- Simple client for the OpenMemory REST API
- Supports both **Simple (1-call)** and **Advanced (5-calls)** embedding modes
- Auto-retry with exponential backoff and optional batching
- First-class TypeScript types
- ESM and CommonJS builds
- Node.js and edge/runtime friendly (native `fetch`)

## Installation

```bash
npm install openmemory-js
# or
yarn add openmemory-js
# or
pnpm add openmemory-js
```

## Quick Start

```ts
import { OpenMemory } from 'openmemory-js';

const om = new OpenMemory({
  baseUrl: process.env.OM_BASE_URL ?? 'http://localhost:8080',
  apiKey: process.env.OM_API_KEY ?? '',
});

// Add a memory
const added = await om.memory.add({
  content: 'User prefers dark mode and drinks black coffee.',
  tags: ['preferences', 'coffee', 'theme'],
});

// Query memory
const result = await om.memory.query({
  query: 'What theme does the user like?',
  topK: 5,
});

console.log(
  result.items.map((i) => ({ id: i.id, score: i.score, sector: i.sector })),
);
```

## Configuration

You can configure the SDK via constructor options or environment variables.

```ts
const om = new OpenMemory({
  baseUrl: 'http://localhost:8080',
  apiKey: 'YOUR_KEY',
  timeoutMs: 15000,
  headers: { 'x-tenant': 'demo' },
});
```

Environment variables (optional):

```
OM_BASE_URL=http://localhost:8080
OM_API_KEY=your_key
```

## Embedding Modes

OpenMemory supports two embedding modes. The SDK is agnostic; the mode is configured on the server side.

- **Simple mode**: one unified embedding call for all sectors (fast, single API call)
- **Advanced mode**: five sector-specific embedding calls (precise, five API calls)

Set on the server (backend `.env`):

```
OM_EMBED_MODE=simple   # or "advanced"
```

## API

### `new OpenMemory(options)`

Options:

- `baseUrl` (string) – server URL (required)
- `apiKey` (string) – bearer token (optional, recommended)
- `timeoutMs` (number) – request timeout in ms (default 15000)
- `headers` (Record<string,string>) – extra headers for all requests

### `om.memory.add(input)`

Create a memory item.

```ts
type AddMemoryInput = {
  content: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  sector?: 'episodic' | 'semantic' | 'procedural' | 'emotional' | 'reflective'; // optional hint
};

type AddMemoryResponse = {
  id: string;
  sectors: Array<{
    name: string;
    vectorDim: number;
    score?: number;
  }>;
  createdAt: string;
};
```

Example:

```ts
await om.memory.add({
  content: 'Met Alice yesterday at 5PM, she prefers tea.',
  tags: ['contact', 'preference'],
});
```

### `om.memory.query(input)`

Semantic retrieval with sector-aware scoring.

```ts
type QueryMemoryInput = {
  query: string;
  topK?: number; // default 5
  minScore?: number; // default set by server
  sectors?: string[]; // optional filter
  includeVectors?: boolean; // false by default
};

type QueryMemoryResponse = {
  items: Array<{
    id: string;
    content: string;
    sector: string;
    score: number;
    waypointId?: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
    vectorDim?: number;
    vector?: number[]; // when includeVectors=true
  }>;
};
```

### `om.memory.all(params)`

List all stored memories (paginated).

```ts
const page = await om.memory.all({ cursor: undefined, limit: 100 });
```

### `om.memory.get(id)`

Get a single memory by id.

### `om.memory.delete(id)`

Delete a memory.

### `om.health.get()`

Health check endpoint.

## Waypoints

Waypoints link sector fragments back to a root memory for explainable retrieval.

- The server creates **one waypoint per memory** and connects derived nodes
- Returned on query as `waypointId` when applicable

## Batching & Retries

The SDK provides safe defaults:

- Retries on `429/5xx` with exponential backoff
- Optional client-side batching helper for ingestion spikes

Example batch ingestion helper:

```ts
import { batch } from 'openmemory-js/utils';

const inputs = [{ content: 'A' }, { content: 'B' }, { content: 'C' }];

for await (const res of batch(inputs, async (x) => om.memory.add(x), {
  size: 5,
  delayMs: 200,
})) {
  console.log(res.id);
}
```

## TypeScript Types

All methods are typed. You can import the public types:

```ts
import type { AddMemoryInput, QueryMemoryInput } from 'openmemory-js';
```

## Node.js Compatibility

- Node 18+ (native `fetch`)
- ESM by default; CJS build available

CJS usage:

```js
const { OpenMemory } = require('openmemory-js/cjs');
```

## Error Handling

Errors throw an `OpenMemoryError` containing:

```ts
type OpenMemoryError = Error & {
  status?: number;
  body?: unknown;
  requestId?: string;
};
```

Example:

```ts
try {
  await om.memory.add({ content: '' });
} catch (e) {
  if (e.status === 400) console.error('Invalid input');
}
```

## Example: Agent Hook

```ts
async function recall(query: string) {
  const res = await om.memory.query({ query, topK: 7 });
  return res.items.map((i) => `• [${i.sector}] ${i.content}`).join('\n');
}
```

## Development

```bash
# build
pnpm build

# test
pnpm test
```

## License

MIT
