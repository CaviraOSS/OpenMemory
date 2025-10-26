## OpenMemory + Windsurf

Register OpenMemory as a Windsurf plugin so every agent can persist and recall context seamlessly.

### Setup

1. Run OpenMemory locally (`http://localhost:8080` by default) or expose it remotely and set `OPENMEMORY_URL`.
2. Place `windsurf.ts` somewhere accessible, e.g., `IDE/windsurf/windsurf.ts`.
3. Reference the plugin inside `windsurf.config.json`:

```json
{
  "plugins": ["./IDE/windsurf/windsurf.ts"]
}
```

Windsurf loads the module and executes the default export during startup.

### Usage

```ts
import { integrateWithWindsurf } from './IDE/windsurf/windsurf'

const om = await integrateWithWindsurf()
await om.remember('Documented Windsurf integration.', ['docs'])
const context = await om.recall('integration status')
await om.forget(context.matches[0].id)
```

### API

| Method | Description |
|--------|-------------|
| `remember(content, tags?)` | Adds a memory via `POST /memory/add`. |
| `recall(query, k?)` | Searches memories via `POST /memory/query`. |
| `forget(id)` | Deletes a memory via `DELETE /memory/{id}`. |

All network calls use native `fetch` with ESM exports so Windsurf’s runtime can load them without additional tooling.
