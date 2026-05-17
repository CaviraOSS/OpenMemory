# pgvector Index Strategy

Durable memory recall uses Postgres plus pgvector as the production path.

## Current Strategy

- `memories.embedding` stores the durable memory vector.
- `durable_memories_embedding_idx` is a partial HNSW cosine index on non-null embeddings.
- Vector recall orders by `m.embedding <=> $query::vector` and stays bounded with `limit`.
- Tenant, project, validity, supersession, contract expiry, provenance, and contradiction filters still apply before results are returned.

## Why Partial HNSW

- HNSW is the right default for larger recall sets where exact scans become too slow.
- Partial indexing avoids indexing rows that cannot participate in vector recall.
- Cosine distance matches the current embedding similarity behavior.

## Not Done Yet

- Real cardinality validation still needs a focused Postgres verification path if tests are reintroduced.
- Query planner validation should run against representative tenant/project distributions before adding more composite indexes.
- Recall scoring is still provisional; vector distance is used as an input, not the final measured scoring policy.
