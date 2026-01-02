-- Migration 004: Update primary keys and constraints for multi-tenancy
-- Description: Fixes primary keys to include tenant_id for proper isolation
-- This ensures unique constraints are scoped per tenant

-- 1. Fix vectors table primary key
-- Old PK: (id, sector)
-- New PK: (tenant_id, id, sector)
DO $$
BEGIN
    -- Drop existing primary key
    ALTER TABLE "${schema}"."${vectors_table}" DROP CONSTRAINT IF EXISTS openmemory_vectors_pkey;
    ALTER TABLE "${schema}"."${vectors_table}" DROP CONSTRAINT IF EXISTS vectors_pkey;

    -- Add new composite primary key
    ALTER TABLE "${schema}"."${vectors_table}"
    ADD CONSTRAINT vectors_pkey PRIMARY KEY (tenant_id, id, sector);

    RAISE NOTICE 'Updated vectors table primary key';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error updating vectors PK: %', SQLERRM;
END $$;

-- 2. Fix waypoints table primary key
-- Old PK: (src_id, user_id) -- INCORRECT!
-- New PK: (tenant_id, src_id, dst_id)
DO $$
BEGIN
    -- Drop existing primary key
    ALTER TABLE "${schema}".openmemory_waypoints DROP CONSTRAINT IF EXISTS openmemory_waypoints_pkey;
    ALTER TABLE "${schema}".openmemory_waypoints DROP CONSTRAINT IF EXISTS waypoints_pkey;

    -- Add new composite primary key
    ALTER TABLE "${schema}".openmemory_waypoints
    ADD CONSTRAINT waypoints_pkey PRIMARY KEY (tenant_id, src_id, dst_id);

    RAISE NOTICE 'Updated waypoints table primary key';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error updating waypoints PK: %', SQLERRM;
END $$;

-- 3. Fix memories table primary key
-- Old PK: (id)
-- New PK: (tenant_id, id) -- More efficient for tenant filtering
DO $$
BEGIN
    -- Drop existing primary key
    ALTER TABLE "${schema}"."${memories_table}" DROP CONSTRAINT IF EXISTS openmemory_memories_pkey;
    ALTER TABLE "${schema}"."${memories_table}" DROP CONSTRAINT IF EXISTS memories_pkey;

    -- Add new composite primary key
    ALTER TABLE "${schema}"."${memories_table}"
    ADD CONSTRAINT memories_pkey PRIMARY KEY (tenant_id, id);

    RAISE NOTICE 'Updated memories table primary key';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error updating memories PK: %', SQLERRM;
END $$;

-- 4. Fix users table primary key
-- Old PK: (user_id)
-- New PK: (tenant_id, user_id)
DO $$
BEGIN
    ALTER TABLE "${schema}".openmemory_users DROP CONSTRAINT IF EXISTS openmemory_users_pkey;
    ALTER TABLE "${schema}".openmemory_users DROP CONSTRAINT IF EXISTS users_pkey;

    ALTER TABLE "${schema}".openmemory_users
    ADD CONSTRAINT users_pkey PRIMARY KEY (tenant_id, user_id);

    RAISE NOTICE 'Updated users table primary key';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error updating users PK: %', SQLERRM;
END $$;

-- 5. Add foreign key constraints (with tenant_id)
DO $$
BEGIN
    -- Vectors -> Memories foreign key
    ALTER TABLE "${schema}"."${vectors_table}"
    DROP CONSTRAINT IF EXISTS vectors_memory_fkey;

    ALTER TABLE "${schema}"."${vectors_table}"
    ADD CONSTRAINT vectors_memory_fkey
    FOREIGN KEY (tenant_id, id)
    REFERENCES "${schema}"."${memories_table}"(tenant_id, id)
    ON DELETE CASCADE;

    RAISE NOTICE 'Added vectors foreign key constraint';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error adding vectors FK: %', SQLERRM;
END $$;
