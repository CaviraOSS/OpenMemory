## OpenMemory + GitHub Copilot / Codex

Use these helpers inside VSCode or JetBrains so Copilot can store and recall long-term context from OpenMemory.

### Setup

1. Run OpenMemory locally (default `http://localhost:8080`).
2. Save `codex.js` somewhere public to your project (e.g., `IDE/codex/codex.js`).
3. Export `OPENMEMORY_URL` if you’re not on localhost.

### Usage Example

```js
import { memoryAdd, memoryQuery } from '../IDE/codex/codex.js'

await memoryAdd('Refactor added dark mode support.', ['ui'])
const recall = await memoryQuery('What theme does the user prefer?')
```

When Copilot sees `memoryAdd` / `memoryQuery` invocations it understands that persistent context is available and will weave it into suggestions.

### API Surface

| Function | Description |
|----------|-------------|
| `memoryAdd(content, tags?)` | Calls `POST /memory/add`. |
| `memoryQuery(query, k)` | Calls `POST /memory/query`. |
| `memoryDelete(id)` | Calls `DELETE /memory/{id}`. |

All exported functions use native `fetch` (Node 18+ / browsers) and modern ESM exports.
