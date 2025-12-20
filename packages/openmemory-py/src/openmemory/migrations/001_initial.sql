-- 001_initial.sql
CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    content TEXT,
    primary_sector TEXT,
    sectors TEXT,
    tags TEXT,
    vector BLOB,
    norm_vector BLOB,
    compressed_vec BLOB,
    simhash TEXT,
    meta TEXT,
    user_id TEXT,
    segment INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER,
    last_seen_at INTEGER,
    salience REAL,
    decay_lambda REAL,
    version INTEGER,
    mean_dim INTEGER,
    mean_vec BLOB,
    feedback_score REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vectors (
    id TEXT,
    v BLOB,
    dim INTEGER,
    sector TEXT,
    user_id TEXT,
    PRIMARY KEY (id, sector),
    FOREIGN KEY(id) REFERENCES memories(id)
);

CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    summary TEXT,
    reflection_count INTEGER,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER,
    metrics TEXT
);

CREATE TABLE IF NOT EXISTS embed_logs (
    id TEXT,
    model TEXT,
    status TEXT,
    ts INTEGER,
    err TEXT
);

CREATE TABLE IF NOT EXISTS waypoints (
    src_id TEXT,
    dst_id TEXT,
    dst_sector TEXT,
    user_id TEXT,
    weight REAL,
    created_at INTEGER,
    updated_at INTEGER,
    PRIMARY KEY (src_id, dst_id)
);

CREATE TABLE IF NOT EXISTS temporal_facts (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    predicate TEXT NOT NULL,
    obj TEXT NOT NULL,
    valid_from INTEGER NOT NULL,
    valid_to INTEGER,
    confidence REAL,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS temporal_edges (
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relation TEXT NOT NULL,
    valid_from INTEGER NOT NULL,
    valid_to INTEGER,
    weight REAL NOT NULL,
    metadata TEXT,
    FOREIGN KEY(source_id) REFERENCES temporal_facts(id),
    FOREIGN KEY(target_id) REFERENCES temporal_facts(id)
);

CREATE INDEX IF NOT EXISTS idx_memories_sector ON memories(primary_sector);
CREATE INDEX IF NOT EXISTS idx_memories_segment ON memories(simhash);  -- segment was simhash in some contexts
CREATE INDEX IF NOT EXISTS idx_memories_ts ON memories(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_vectors_user ON vectors(user_id);
CREATE INDEX IF NOT EXISTS idx_waypoints_src ON waypoints(src_id);
CREATE INDEX IF NOT EXISTS idx_waypoints_dst ON waypoints(dst_id);
CREATE INDEX IF NOT EXISTS idx_stats_ts ON stats(ts);
CREATE INDEX IF NOT EXISTS idx_temporal_subject ON temporal_facts(subject);
