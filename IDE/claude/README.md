## OpenMemory + Claude Code

This helper lets Claude persist and recall context between coding sessions by talking directly to your local OpenMemory API.

### Setup

1. Ensure OpenMemory is running (default `http://localhost:8080`).
2. Copy `claude.ts` into your repo (e.g., `project/IDE/claude/claude.ts`).
3. Optionally set `OPENMEMORY_URL` in your workspace `.env` or shell:
   ```bash
   OPENMEMORY_URL=http://localhost:8080
   ```

### Usage Inside Claude

```ts
import { remember, recall, forget } from './IDE/claude/claude'

await remember('User prefers dark mode.', ['preferences'])
const matches = await recall('What theme does user like?')
await forget(matches.matches[0].id)
```

Claude inspects project files; once it sees these helpers it understands you’ve wired persistent memory and will offer them in completions when you ask things like “Integrate OpenMemory for memory recall.”

### API

| Function | Description |
|----------|-------------|
| `remember(content, tags?)` | Stores a memory node. |
| `recall(query, k=8)` | Retrieves relevant memories. |
| `forget(id)` | Deletes a memory by identifier. |

All functions use `fetch` and modern ESM exports so they work in Node-based Claude environments without extra dependencies.
