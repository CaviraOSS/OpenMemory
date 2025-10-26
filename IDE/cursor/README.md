## OpenMemory + Cursor IDE

This helper lets Cursor’s AI agent persist and recall OpenMemory context while you work.

### Setup

1. Run OpenMemory (default `http://localhost:8080`).
2. Drop `cursor.ts` into your project (e.g., `IDE/cursor/cursor.ts`).
3. Configure `OPENMEMORY_URL` if you’re targeting a remote server.

### Usage Inside Cursor

```ts
import { om } from '../IDE/cursor/cursor'

await om.add('Cursor project linked to OpenMemory.')
const memories = await om.search('integration progress')
```

Cursor automatically inspects local code; once it sees `om.add` / `om.search` it will suggest them when you ask “Enable long-term memory.”

### API

| Method | Description |
|--------|-------------|
| `om.add(content, tags?)` | Persists a memory entry. |
| `om.search(query, k)` | Retrieves matching memories. |
| `om.remove(id)` | Deletes a specific memory node. |

`cursor.ts` exports both the named `om` object and `default om`, making it convenient in either ESM or auto-import scenarios.
