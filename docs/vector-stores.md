# Vector Stores

OpenMemory keeps durable memory, provenance, graph, contracts, audit, and lifecycle state in Postgres. Vector search defaults to the durable `memories.embedding` pgvector column.

Set `OM_VECTOR_STORE` to delegate nearest-neighbor search to an external store:

| Store | `OM_VECTOR_STORE` | Main env |
| --- | --- | --- |
| Postgres/pgvector | `postgres` | `OM_PG_*` |
| Qdrant | `qdrant` | `OM_QDRANT_URL`, `OM_QDRANT_API_KEY` |
| Valkey/Redis Search | `valkey` or `redis` | `VALKEY_URL` or `REDIS_URL` |
| Pinecone | `pinecone` | `PINECONE_INDEX_HOST`, `PINECONE_API_KEY` |
| Weaviate | `weaviate` | `WEAVIATE_URL`, `WEAVIATE_API_KEY` |
| Chroma | `chroma` | `CHROMA_URL` |
| Milvus | `milvus` | `MILVUS_URL`, `MILVUS_API_KEY` |

Common settings:

- `OM_VECTOR_COLLECTION=openmemory_memories`
- `OM_VECTOR_TIMEOUT_MS=10000`
- `OM_VECTOR_URL` and `OM_VECTOR_API_KEY` can override store-specific URL/key envs.

Behavior:

- `/memories` still writes the memory row and pgvector embedding to Postgres.
- If an external vector store is configured, `/memories` also upserts the vector record there.
- `/recall` queries the external vector store first, then loads matching durable memory rows from Postgres with tenant/project filters.
- Project-scoped recall includes both exact project matches and global records with null project.
- `/health` reports the configured vector store and embedding provider/model routing.

Valkey/Redis requires Redis Stack or Valkey with RediSearch vector support. The package uses the `redis` client and creates a HASH index for `id`, `user_id`, `project_id`, `content`, and `embedding`.
