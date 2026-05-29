# OpenMemory

OpenMemory is being cleaned up into a JavaScript/Node-first durable memory server.

The active product path is currently:

- `packages/openmemory-js`
- Node/TypeScript server runtime
- Postgres as the durable source of truth, with pgvector by default and optional external vector search stores
- npm-based development and release workflow

Deferred surfaces such as editor extensions, dashboard UI, secondary SDKs, old examples, and hosted deploy templates have been removed from the active tree for now.

## Current Setup

From GitHub:

```bash
git clone https://github.com/cavira/OpenMemory.git
cd OpenMemory
npm install
npm run build
npm run start
```

Release smoke:

```bash
npm run release-smoke
OM_RELEASE_SMOKE_FULL=true npm run release-smoke
```

The default smoke verifies package build and `/health`. Full smoke also creates a
durable memory, recalls it in strict mode, and explains it against a configured
Postgres database.

The default server port is `8080`.

From the package directory:

```bash
cd packages/openmemory-js
npm install
npm run build
npm run start
```

## Development

```bash
cd packages/openmemory-js
npm run dev
npm run build
npm run test
```

The default server registers only `/health` and durable unprefixed routes. Legacy
retention, user-summary, MCP, dashboard, IDE, hosted deploy, and connector webhook
surfaces are deferred from the default runtime.

Vector search defaults to Postgres/pgvector. Set `OM_VECTOR_STORE` to `qdrant`,
`valkey`, `redis`, `pinecone`, `weaviate`, `chroma`, or `milvus` to delegate
nearest-neighbor search while keeping memory lifecycle data in Postgres.

Database storage defaults to `OM_STORAGE=postgres`. Local runs can use
`OM_STORAGE=memory`, `OM_STORAGE=sqlite`, or `OM_STORAGE=valkey`/`redis`; those
local backends support the active memory lifecycle routes but are not the full
durable Postgres graph store.

## Documentation

- Rewrite plan: `docs/architecture-rewrite-plan.md`
- Persistent AI context: `docs/ai-context.md`, `docs/ai-rules.md`, `docs/decisions.md`
- Versioning: `docs/versioning.md`
- Migrations: `docs/migrations.md`
- pgvector index strategy: `docs/pgvector-index-strategy.md`
- Vector stores: `docs/vector-stores.md`

Legacy data can be inspected without mutation:

```bash
npm run migration-report -- legacy-data.json report.json
```

## Status

This repository is in an architectural cleanup phase. Keep new work focused on the JS package and server path until the durable core rewrite is complete.

# Why OpenMemory

OpenMemory exists to give AI applications durable memory that is more structured than a plain vector lookup.

The current rewrite focuses on:

- Durable records with provenance.
- Temporal correctness.
- Explainable recall.
- Contract-aware memory usage.
- A small JavaScript server package that can be installed and run through npm.
