-- Migration 003: Convert BYTEA vectors to pgvector type
-- Description: Converts the 'v' column from BYTEA to vector(N) type
-- This enables native vector operations and similarity search
-- WARNING: This migration can take several minutes for large datasets

-- Note: Vector dimension should match your embedding model:
-- - text-embedding-3-small: 1536
-- - text-embedding-3-large: 3072
-- - SMART tier: 384
-- - DEEP tier: 1536
-- Default: 1536 (configurable via OM_VEC_DIM environment variable)

-- Step 1: Add new vector column
-- We use a temporary column to avoid data loss
ALTER TABLE "${schema}"."${vectors_table}"
ADD COLUMN IF NOT EXISTS embedding vector(${vector_dim});

-- Step 2: Convert BYTEA data to vector type
-- This unpacks the Float32Array buffer into a pgvector array
-- Note: This assumes the BYTEA format is Float32Array (4 bytes per float)
DO $$
DECLARE
    batch_size INT := 10000;
    total_rows BIGINT;
    processed BIGINT := 0;
    batch_start TIMESTAMP;
BEGIN
    -- Get total count for progress logging
    SELECT COUNT(*) INTO total_rows FROM "${schema}"."${vectors_table}" WHERE embedding IS NULL;

    RAISE NOTICE 'Converting % rows from BYTEA to vector type...', total_rows;

    -- Process in batches to avoid long locks
    LOOP
        batch_start := clock_timestamp();

        -- Convert batch of BYTEA to vector
        -- We decode the binary data and cast to vector
        WITH batch AS (
            SELECT id, sector, tenant_id
            FROM "${schema}"."${vectors_table}"
            WHERE embedding IS NULL
            LIMIT batch_size
            FOR UPDATE SKIP LOCKED
        )
        UPDATE "${schema}"."${vectors_table}" t
        SET embedding = (
            -- Convert BYTEA (Float32Array buffer) to float array, then to vector
            SELECT array_agg(
                -- Decode 4-byte chunks as IEEE 754 floats
                ('x' || encode(substring(v FROM i FOR 4), 'hex'))::bit(32)::int::float4
            )::vector(${vector_dim})
            FROM generate_series(1, dim * 4, 4) AS i
        )
        FROM batch
        WHERE t.id = batch.id
          AND t.sector = batch.sector
          AND t.tenant_id = batch.tenant_id;

        GET DIAGNOSTICS processed = ROW_COUNT;

        EXIT WHEN processed = 0;

        RAISE NOTICE 'Processed batch: % rows in % ms',
            processed,
            EXTRACT(MILLISECONDS FROM clock_timestamp() - batch_start);

        -- Small delay to avoid overwhelming the system
        PERFORM pg_sleep(0.1);
    END LOOP;

    RAISE NOTICE 'Conversion complete!';
END $$;

-- Step 3: Drop old BYTEA column and rename new column
-- WARNING: This is a breaking change! Ensure all applications are updated first.
-- Uncomment when ready to finalize migration:
-- ALTER TABLE "${schema}"."${vectors_table}" DROP COLUMN IF EXISTS v;
-- ALTER TABLE "${schema}"."${vectors_table}" RENAME COLUMN embedding TO v;

-- For now, keep both columns for backward compatibility
-- Applications can use 'embedding' for new pgvector operations
-- and 'v' for old BYTEA operations during transition period
