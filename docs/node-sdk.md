# JavaScript Package

The active package is `openmemory-js` in `packages/openmemory-js`.

## Install

```bash
npm install openmemory-js
```

## Local Development

```bash
cd packages/openmemory-js
npm install
npm run build
npm run start
```

## SDK Usage

```ts
import { Memory } from "openmemory-js";

const memory = new Memory("user_1");
await memory.add("User prefers concise responses");
const results = await memory.search("response preference");
```

The current SDK is kept while the durable JS server rewrite is staged.

