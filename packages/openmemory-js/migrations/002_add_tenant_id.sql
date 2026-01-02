-- Migration 002: Add tenant_id columns for multi-tenancy
-- Description: Adds tenant_id to all tables and updates primary keys/indexes
-- This enables multi-tenant data isolation at the database level

-- Get schema name from environment (default: public)
-- Note: Replace ${schema} with actual schema name when running
-- For Supabase: typically 'public'

-- 1. Add tenant_id to memories table
ALTER TABLE IF EXISTS "${schema}"."${memories_table}"
ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';

-- 2. Add tenant_id to vectors table
ALTER TABLE IF EXISTS "${schema}"."${vectors_table}"
ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';

-- 3. Add tenant_id to waypoints table
ALTER TABLE IF EXISTS "${schema}".openmemory_waypoints
ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';

-- 4. Add tenant_id to users table
ALTER TABLE IF EXISTS "${schema}".openmemory_users
ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';

-- 5. Add tenant_id to embed_logs table
ALTER TABLE IF EXISTS "${schema}".openmemory_embed_logs
ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';

-- 6. Add tenant_id to stats table
ALTER TABLE IF EXISTS "${schema}".stats
ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';

-- 7. Add tenant_id to temporal_facts table (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = '${schema}'
        AND table_name = 'temporal_facts'
    ) THEN
        ALTER TABLE "${schema}".temporal_facts
        ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    END IF;
END $$;

-- 8. Add tenant_id to temporal_edges table (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = '${schema}'
        AND table_name = 'temporal_edges'
    ) THEN
        ALTER TABLE "${schema}".temporal_edges
        ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
    END IF;
END $$;

-- Remove DEFAULT 'default' after adding columns (force explicit tenant_id in new inserts)
ALTER TABLE "${schema}"."${memories_table}" ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE "${schema}"."${vectors_table}" ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE "${schema}".openmemory_waypoints ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE "${schema}".openmemory_users ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE "${schema}".openmemory_embed_logs ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE "${schema}".stats ALTER COLUMN tenant_id DROP DEFAULT;
