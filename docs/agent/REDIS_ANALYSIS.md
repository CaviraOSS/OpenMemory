# Redis / In-Memory Database Analysis for OpenMemory

> **Date**: 2026-02-14
> **Author**: Claude Agent (catchup + analysis)
> **Status**: Analysis Complete — Recommendation: **Not Required Now**

---

## Executive Summary

OpenMemory already has a **Valkey/Redis vector store implementation** (`ValkeyVectorStore`) and uses **in-memory caching** for rate limiting, query results, salience scores, and segment data. After analysing the current architecture, caching patterns, and bottlenecks, adding a dedicated Redis/Valkey layer **provides marginal benefit** given the current scale and existing PostgreSQL + pgvector setup.

**Recommendation**: Continue with current architecture. Redis/Valkey should only be considered when:
1. Rate-limit store regularly exceeds 10,000 entries (multi-tenant at scale)
2. Query cache hit rate drops below 60% due to cache invalidation issues
3. Cross-instance session sharing is required (multi-node k8s deployment)

---

## 1. Current Architecture Analysis

### 1.1 Storage Backends

| Layer | Current Backend | Alternative |
|-------|-----------------|-------------|
| **Metadata** | PostgreSQL (CT 112, 10.0.6.112) | SQLite (local dev) |
| **Vectors** | pgvector (HNSW index) | Valkey (implemented) |
| **Rate Limiting** | In-memory `Map` | — |
| **Query Cache** | In-memory `Map` (60s TTL) | — |
| **Segment Cache** | In-memory `Map` | — |
| **Salience Cache** | In-memory `Map` (60s TTL) | — |

### 1.2 Relevant Code Locations

```
packages/openmemory-js/src/
├── core/
│   ├── db.ts              # PostgreSQL/SQLite + transaction handling
│   ├── cfg.ts             # Environment config including valkey_* vars
│   └── vector/
│       ├── postgres.ts    # pgvector implementation (current)
│       └── valkey.ts      # Valkey/Redis implementation (available)
├── memory/
│   └── hsg.ts             # Query cache, segment cache, salience cache
└── server/middleware/
    └── auth.ts            # Rate-limit in-memory store
```

---

## 2. In-Memory Caching Patterns (Current State)

### 2.1 Rate-Limit Store (`auth.ts`)

```typescript
const rate_limit_store = new Map<string, { count: number; reset_time: number }>();
const MAX_RATE_LIMIT_ENTRIES = 10000;
```

**Behaviour**:
- Keyed by client ID (hashed API key or IP address)
- 60-second window (configurable via `OM_RATE_LIMIT_WINDOW_MS`)
- O(n) eviction when cap reached (oldest entry removed)
- Cleanup interval: every 5 minutes

**Bottleneck Risk**: Low. Only becomes a problem with >10,000 concurrent unique clients, which exceeds typical single-tenant usage.

**Redis Benefit**: Would enable distributed rate limiting across k8s pods, atomic counter operations via `INCR`/`EXPIRE`, and O(1) eviction via sorted sets.

### 2.2 Query Result Cache (`hsg.ts`)

```typescript
const cache = new Map<string, { r: hsg_q_result[]; t: number }>();
const TTL = 60000; // 60 seconds
```

**Behaviour**:
- Cache key: `${query_text}:${k}:${JSON.stringify(filters)}`
- Returns cached results if within TTL
- No size limit (potential memory growth)
- No invalidation on memory add/update/delete

**Bottleneck Risk**: Medium. Cache can grow unbounded if diverse queries are made. Cache invalidation is missing — updates to memories don't invalidate cached query results.

**Redis Benefit**: `SETEX` with TTL, LRU eviction policy, pub/sub for cache invalidation, shared cache across pods.

### 2.3 Salience Cache (`hsg.ts`)

```typescript
const sal_cache = new Map<string, { s: number; t: number }>();
const TTL = 60000;
```

**Behaviour**:
- Caches `salience` value per memory ID
- Falls back to DB query on cache miss
- No size limit

**Redis Benefit**: Minimal — salience lookups are already O(1) with PostgreSQL primary key index.

### 2.4 Segment Cache (`hsg.ts`)

```typescript
const seg_cache = new Map<number, any[]>();
// Size limited by env.cache_segments (default 3 for hybrid tier)
```

**Behaviour**:
- Caches full segment contents (up to 10,000 memories per segment)
- LRU eviction based on `cache_segments` config
- Used for co-activation pattern detection

**Redis Benefit**: Could reduce memory footprint by offloading segment cache to external store, but adds latency.

---

## 3. Valkey/Redis Integration (Already Implemented)

### 3.1 ValkeyVectorStore

OpenMemory **already has** a Valkey/Redis vector store implementation at `core/vector/valkey.ts`:

```typescript
export class ValkeyVectorStore implements VectorStore {
    private client: Redis;

    constructor() {
        this.client = new Redis({
            host: env.valkey_host || "localhost",
            port: env.valkey_port || 6379,
            password: env.valkey_password,
        });
    }
    // ... storeVector, searchSimilar, etc.
}
```

**Activation**: Set `OM_VECTOR_BACKEND=valkey` in environment.

**Current Status**: Implemented but **not recommended** because:
1. pgvector's HNSW index provides native ANN search with better query planning
2. Valkey FT.SEARCH fallback uses `SCAN` which is O(n)
3. User ID filtering requires post-filtering in Valkey (inefficient)

### 3.2 Why pgvector is Superior for This Use Case

| Capability | pgvector | Valkey/Redis |
|------------|----------|--------------|
| **ANN Search** | HNSW index, O(log n) | FT.SEARCH or O(n) scan |
| **Filtering** | Native WHERE clauses | Post-filter after search |
| **Transactions** | Full ACID | Limited (MULTI/EXEC) |
| **Joins** | Memory + vector in one query | Separate calls required |
| **Persistence** | WAL, streaming replication | AOF/RDB (less durable) |
| **Cost** | Already deployed | Additional service |

---

## 4. Performance Analysis

### 4.1 Current Performance (from ARCHITECTURE.md)

| Operation | Latency | Notes |
|-----------|---------|-------|
| Add memory | 80-120 ms | Embedding API dominates |
| Query (simple) | 110-130 ms | Single-sector HNSW |
| Query (multi-sector) | 150-200 ms | 2-3 sector fusion |
| Waypoint expansion | +30-50 ms | Per hop |

**Bottleneck**: Embedding API calls (OpenAI/Gemini), not database operations.

### 4.2 Where Redis Would Help

| Use Case | Current | With Redis | Improvement |
|----------|---------|------------|-------------|
| Rate limiting (10k+ clients) | O(n) eviction | O(1) ZREMRANGEBYSCORE | Significant |
| Query cache (multi-pod) | Per-pod, no sharing | Shared, pub/sub invalidation | Moderate |
| Session state | None | SETEX with TTL | New capability |
| Distributed locking | None | SETNX/Redlock | New capability |

### 4.3 Where Redis Would NOT Help

- **Vector search**: pgvector HNSW is faster than Valkey FT.SEARCH
- **Memory metadata**: Already O(1) with PostgreSQL indexes
- **Waypoint lookups**: Already indexed, ~1ms queries
- **Transaction integrity**: PostgreSQL's ACID > Redis MULTI

---

## 5. Alternative Architectures Considered

### 5.1 Option A: Stay with Current Architecture (Recommended)

```
┌─────────────┐     ┌──────────────────┐
│ OpenMemory  │────▶│ PostgreSQL       │
│ API Server  │     │ + pgvector       │
└─────────────┘     │ CT 112           │
                    └──────────────────┘
```

**Pros**:
- Single database to manage
- Proven replication (CT 112 → CT 223)
- No additional infrastructure
- Already optimised (Phase 0/1 complete)

**Cons**:
- In-memory caches don't share across pods
- Rate limiting per-pod only

### 5.2 Option B: Add Redis for Caching Layer Only

```
┌─────────────┐     ┌───────────────┐     ┌──────────────────┐
│ OpenMemory  │────▶│ Redis/Valkey  │────▶│ PostgreSQL       │
│ API Server  │     │ (cache only)  │     │ + pgvector       │
└─────────────┘     └───────────────┘     └──────────────────┘
```

**Use Redis for**:
- Rate limiting (`INCR` + `EXPIRE`)
- Query result cache (`SETEX` + pub/sub invalidation)
- Session tokens (if added)

**Keep in PostgreSQL**:
- All memory metadata
- All vectors (pgvector)
- Waypoints
- Audit logs

**Pros**:
- Distributed caching
- Atomic rate limiting
- Minimal migration

**Cons**:
- Additional service to deploy/monitor
- Cache invalidation complexity
- Marginal latency benefit

### 5.3 Option C: Full Redis Stack (Not Recommended)

Move vectors to Redis Stack with RediSearch.

**Why Not**:
- pgvector HNSW already provides excellent ANN performance
- RediSearch indexing requires manual schema management
- Loss of PostgreSQL JOIN capabilities
- Replication complexity increases

---

## 6. Cost-Benefit Analysis

### 6.1 Implementation Effort

| Task | Effort | Benefit |
|------|--------|---------|
| Deploy Valkey to k3s | 2 hours | Infrastructure available |
| Migrate rate-limit to Redis | 4 hours | Distributed rate limiting |
| Migrate query cache to Redis | 8 hours | Shared cache, invalidation |
| Add cache invalidation pub/sub | 4 hours | Consistency |
| Testing and validation | 8 hours | Quality |
| **Total** | **~26 hours** | Moderate |

### 6.2 When to Implement

**Trigger Conditions** (implement Redis when ANY apply):

1. **Scale**: >5 OpenMemory pods running concurrently
2. **Rate Limiting**: >10,000 unique clients per rate-limit window
3. **Cache Miss Rate**: Query cache hit rate drops below 60%
4. **Session Management**: Need to share authentication state across pods
5. **Pub/Sub**: Real-time memory update notifications required

**Current State**: None of these conditions apply. Single pod, <1,000 memories, single-tenant.

---

## 7. Specific Redis Use Cases (If Implemented)

### 7.1 Rate Limiting with Sorted Sets

```typescript
// Replace in-memory Map with Redis
async function checkRateLimit(clientId: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const key = `rl:${clientId}`;

    // Remove old entries + count + add new entry atomically
    const pipe = redis.pipeline();
    pipe.zremrangebyscore(key, 0, windowStart);
    pipe.zcard(key);
    pipe.zadd(key, now, `${now}`);
    pipe.expire(key, Math.ceil(config.windowMs / 1000));

    const results = await pipe.exec();
    const count = results[1][1] as number;
    return count < config.maxRequests;
}
```

### 7.2 Query Cache with Pub/Sub Invalidation

```typescript
// On memory add/update/delete
await redis.publish("cache:invalidate", JSON.stringify({
    type: "memory",
    id: memoryId,
    sectors: affectedSectors
}));

// Cache subscriber
redis.subscribe("cache:invalidate", (message) => {
    const { type, sectors } = JSON.parse(message);
    // Invalidate matching cached queries
    for (const [key, entry] of localCache) {
        if (sectors.some(s => key.includes(s))) {
            localCache.delete(key);
        }
    }
});
```

### 7.3 Distributed Lock for Background Tasks

```typescript
// Prevent multiple pods running decay simultaneously
async function acquireDecayLock(): Promise<boolean> {
    const lockKey = "lock:decay";
    const lockValue = `${process.env.HOSTNAME}:${Date.now()}`;
    const result = await redis.set(lockKey, lockValue, "NX", "EX", 300);
    return result === "OK";
}
```

---

## 8. Recommendation

### 8.1 Short-Term (Now)

**Do nothing**. Current architecture is sufficient:
- PostgreSQL + pgvector handles all storage needs efficiently
- In-memory caches work for single-pod deployment
- Phase 0/1 optimisations already addressed performance bottlenecks
- Valkey integration exists if needed

### 8.2 Medium-Term (When scaling)

**Add Redis for caching only** when scaling to multi-pod:
- Deploy Valkey to k3s namespace
- Migrate rate-limit store to Redis sorted sets
- Implement query cache with pub/sub invalidation
- Keep vectors in pgvector (do NOT migrate)

### 8.3 Configuration Ready

The codebase is already prepared for Valkey:

```bash
# .env (when ready)
OM_VECTOR_BACKEND=postgres  # Keep this as postgres
OM_VALKEY_HOST=valkey.openmemory.svc.cluster.local
OM_VALKEY_PORT=6379
OM_VALKEY_PASSWORD=<secret>
```

---

## 9. Conclusion

Redis/Valkey integration is **not required at current scale**. The existing PostgreSQL + pgvector architecture with in-memory caching provides excellent performance. The Valkey vector store implementation exists as a fallback but is not recommended due to pgvector's superior HNSW index performance.

**Key Insight**: The primary performance bottleneck is embedding API latency (80-100ms per call), not database operations. Adding Redis would not address this bottleneck.

**Action Items**:
- [x] Analyse current caching patterns
- [x] Evaluate Valkey implementation
- [x] Document recommendation
- [ ] Revisit when scaling to multi-pod deployment

---

## Appendix: Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `OM_VECTOR_BACKEND` | `postgres` | `postgres` or `valkey` |
| `OM_VALKEY_HOST` | `localhost` | Valkey/Redis host |
| `OM_VALKEY_PORT` | `6379` | Valkey/Redis port |
| `OM_VALKEY_PASSWORD` | — | Optional authentication |
| `OM_RATE_LIMIT_ENABLED` | `false` | Enable rate limiting |
| `OM_RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window |
| `OM_RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |
| `OM_CACHE_SEGMENTS` | `3` | Segment cache size |
