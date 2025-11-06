# Multi-User Tenant Migration (v1.2)

⚠️ **Required for users upgrading from v1.1 or earlier**

OpenMemory v1.2 introduces per-user memory isolation with `user_id` fields. Existing databases need schema updates.

---

## SQLite Migration

Run these commands in your SQLite database (`data/openmemory.sqlite`):

```sql
-- Add user_id columns and indexes
ALTER TABLE memories ADD COLUMN user_id TEXT;
CREATE INDEX idx_memories_user ON memories(user_id);

ALTER TABLE vectors ADD COLUMN user_id TEXT;
CREATE INDEX idx_vectors_user ON vectors(user_id);

-- Recreate waypoints table with new primary key (src_id, user_id)
CREATE TABLE waypoints_new (
  src_id TEXT, dst_id TEXT NOT NULL, user_id TEXT,
  weight REAL NOT NULL, created_at INTEGER, updated_at INTEGER,
  PRIMARY KEY(src_id, user_id)
);
INSERT INTO waypoints_new SELECT src_id, dst_id, NULL, weight, created_at, updated_at FROM waypoints;
DROP TABLE waypoints;
ALTER TABLE waypoints_new RENAME TO waypoints;
CREATE INDEX idx_waypoints_src ON waypoints(src_id);
CREATE INDEX idx_waypoints_dst ON waypoints(dst_id);
CREATE INDEX idx_waypoints_user ON waypoints(user_id);

-- Create users table
CREATE TABLE users (
  user_id TEXT PRIMARY KEY, summary TEXT,
  reflection_count INTEGER DEFAULT 0,
  created_at INTEGER, updated_at INTEGER
);
```

---

## PostgreSQL Migration

Replace `schema.table_name` with your configured values (`OM_PG_SCHEMA`, `OM_PG_TABLE`):

```sql
-- Add user_id columns and indexes
ALTER TABLE schema.table_name ADD COLUMN user_id TEXT;
CREATE INDEX idx_memories_user ON schema.table_name(user_id);

ALTER TABLE schema.vectors ADD COLUMN user_id TEXT;
CREATE INDEX idx_vectors_user ON schema.vectors(user_id);

-- Update waypoints primary key
ALTER TABLE schema.waypoints ADD COLUMN user_id TEXT;
ALTER TABLE schema.waypoints DROP CONSTRAINT waypoints_pkey;
ALTER TABLE schema.waypoints ADD PRIMARY KEY (src_id, user_id);
CREATE INDEX idx_waypoints_user ON schema.waypoints(user_id);

-- Create users table
CREATE TABLE schema.openmemory_users (
  user_id TEXT PRIMARY KEY, summary TEXT,
  reflection_count INTEGER DEFAULT 0,
  created_at BIGINT, updated_at BIGINT
);
```

---

## Post-Migration

- **Existing memories**: Will have `user_id = NULL` (treated as default/system user)
- **New API calls**: Include `user_id` in POST `/memory/add` and query filters
- **User isolation**: Query with `filters: { user_id: "user123" }` for per-user results
- **Auto summaries**: User summaries generate automatically when memories are added
