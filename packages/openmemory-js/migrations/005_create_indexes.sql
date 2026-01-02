-- Migration 005: Create optimized indexes for multi-tenant pgvector
-- Description: Creates HNSW indexes for fast vector similarity search
-- and composite indexes for efficient tenant filtering
--
-- Index Strategy for 50M+ memories:
-- - HNSW for vector similarity (< 50ms queries)
-- - Composite indexes for tenant + other filters
-- - Use CONCURRENTLY to avoid locking

-- IMPORTANT: Adjust these parameters based on your data:
-- - m: Number of connections per layer (default: 16, higher = better recall but more memory)
-- - ef_construction: Size of dynamic candidate list (default: 64, higher = better index quality but slower build)

-- Drop old indexes that don't include tenant_id
DROP INDEX IF EXISTS "${schema}".openmemory_memories_sector_idx;
DROP INDEX IF EXISTS "${schema}".openmemory_memories_segment_idx;
DROP INDEX IF EXISTS "${schema}".openmemory_memories_simhash_idx;
DROP INDEX IF EXISTS "${schema}".openmemory_memories_user_idx;
DROP INDEX IF EXISTS "${schema}".openmemory_vectors_user_idx;
DROP INDEX IF EXISTS "${schema}".openmemory_waypoints_user_idx;
DROP INDEX IF EXISTS "${schema}".openmemory_stats_ts_idx;
DROP INDEX IF EXISTS "${schema}".openmemory_stats_type_idx;

-- 1. HNSW Vector Indexes (for similarity search)
-- Separate index per sector for optimal performance
-- Note: Building HNSW indexes on large tables takes time (estimate: 1-2 hours for 50M rows)
-- Use CONCURRENTLY to avoid blocking reads/writes

-- Episodic sector
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vectors_episodic_hnsw
ON "${schema}"."${vectors_table}"
USING hnsw (embedding vector_cosine_ops)
WHERE sector = 'episodic'
WITH (m = 16, ef_construction = 64);

-- Semantic sector
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vectors_semantic_hnsw
ON "${schema}"."${vectors_table}"
USING hnsw (embedding vector_cosine_ops)
WHERE sector = 'semantic'
WITH (m = 16, ef_construction = 64);

-- Procedural sector
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vectors_procedural_hnsw
ON "${schema}"."${vectors_table}"
USING hnsw (embedding vector_cosine_ops)
WHERE sector = 'procedural'
WITH (m = 16, ef_construction = 64);

-- Emotional sector
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vectors_emotional_hnsw
ON "${schema}"."${vectors_table}"
USING hnsw (embedding vector_cosine_ops)
WHERE sector = 'emotional'
WITH (m = 16, ef_construction = 64);

-- Reflective sector
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vectors_reflective_hnsw
ON "${schema}"."${vectors_table}"
USING hnsw (embedding vector_cosine_ops)
WHERE sector = 'reflective'
WITH (m = 16, ef_construction = 64);

-- 2. Composite indexes for tenant isolation + filtering
-- These enable fast queries like: WHERE tenant_id = X AND sector = Y

-- Vectors: tenant + sector (most common filter combination)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vectors_tenant_sector
ON "${schema}"."${vectors_table}" (tenant_id, sector);

-- Memories: tenant + user_id + last_seen_at (for user queries sorted by recency)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_tenant_user_recency
ON "${schema}"."${memories_table}" (tenant_id, user_id, last_seen_at DESC);

-- Memories: tenant + primary_sector (for sector-specific queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_tenant_sector
ON "${schema}"."${memories_table}" (tenant_id, primary_sector);

-- Memories: tenant + simhash (for duplicate detection)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_tenant_simhash
ON "${schema}"."${memories_table}" (tenant_id, simhash)
WHERE simhash IS NOT NULL;

-- Memories: tenant + segment (for segmented operations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_tenant_segment
ON "${schema}"."${memories_table}" (tenant_id, segment);

-- Waypoints: tenant + src_id + weight (for graph traversal sorted by strength)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_waypoints_tenant_src_weight
ON "${schema}".openmemory_waypoints (tenant_id, src_id, weight DESC);

-- Waypoints: tenant + dst_id (for reverse lookup)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_waypoints_tenant_dst
ON "${schema}".openmemory_waypoints (tenant_id, dst_id);

-- Users: tenant_id already in PK, no additional index needed

-- Stats: tenant + type + ts (for analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stats_tenant_type_ts
ON "${schema}".stats (tenant_id, type, ts DESC);

-- 3. Partial indexes for common queries
-- These speed up specific WHERE conditions

-- Active memories (high salience) per tenant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_tenant_active
ON "${schema}"."${memories_table}" (tenant_id, salience DESC)
WHERE salience > 0.5;

-- Recent memories per tenant (last 30 days)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_tenant_recent
ON "${schema}"."${memories_table}" (tenant_id, created_at DESC)
WHERE created_at > EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days') * 1000;

-- 4. Temporal facts indexes (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = '${schema}'
        AND table_name = 'temporal_facts'
    ) THEN
        -- Tenant + subject + predicate (most common temporal query)
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_temporal_tenant_subject_pred
        ON "${schema}".temporal_facts (tenant_id, subject, predicate, valid_from DESC, valid_to DESC);

        -- Tenant + validity range (for time-based queries)
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_temporal_tenant_validity
        ON "${schema}".temporal_facts (tenant_id, valid_from, valid_to)
        WHERE valid_to IS NOT NULL;

        RAISE NOTICE 'Created temporal_facts indexes';
    END IF;
END $$;

-- 5. Performance tuning for vector operations
-- These settings optimize pgvector queries at runtime

-- Example query optimization:
-- SET hnsw.ef_search = 40;  -- Higher = better recall but slower (default: 40)
-- SET max_parallel_workers_per_gather = 2;  -- Enable parallel index scans

-- For monitoring index usage:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE schemaname = '${schema}'
-- ORDER BY idx_scan DESC;
