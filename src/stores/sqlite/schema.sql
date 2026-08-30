--      __                      __  ___                               
--     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
--    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
--   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ / 
--  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /  
--                      /____/                                 /____/   
--
--  cavira oss (c) 2026  -  nullure (c) 2026
--  ----------------------------------------------------------
--  file  : src/stores/sqlite/schema.sql
--  usage : implements the LongMemory schema component

-- LongMemory Hydrograph SQLite schema, migration version 1.

CREATE TABLE IF NOT EXISTS migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS hydro_nodes (
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    content_json TEXT NOT NULL,
    facets_json TEXT NOT NULL,
    node_json TEXT NOT NULL,
    world_id TEXT NOT NULL,
    parent_world_id TEXT,
    zone TEXT NOT NULL CHECK (zone IN ('endocortex', 'exocortex')),
    status TEXT NOT NULL,
    confidence REAL NOT NULL,
    salience REAL NOT NULL,
    valid_from INTEGER NOT NULL,
    valid_to INTEGER,
    observed_at INTEGER NOT NULL,
    recorded_at INTEGER NOT NULL,
    superseded_at INTEGER,
    grounding_ref TEXT,
    grounding_score REAL NOT NULL,
    requires_grounding INTEGER NOT NULL,
    use_for_reasoning INTEGER NOT NULL,
    source_required INTEGER NOT NULL,
    PRIMARY KEY (tenant_id, user_id, node_id)
);

CREATE TRIGGER IF NOT EXISTS hydro_nodes_immutable_identity
BEFORE UPDATE ON hydro_nodes
WHEN OLD.content_hash <> NEW.content_hash
  OR OLD.content_json <> NEW.content_json
  OR OLD.facets_json <> NEW.facets_json
  OR OLD.world_id <> NEW.world_id
  OR OLD.zone <> NEW.zone
  OR OLD.valid_from <> NEW.valid_from
  OR OLD.observed_at <> NEW.observed_at
BEGIN
    SELECT RAISE(ABORT, 'immutable HydroNode identity cannot be changed');
END;

CREATE TABLE IF NOT EXISTS hydro_edges (
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    edge_id TEXT NOT NULL,
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    edge_type TEXT NOT NULL,
    confidence REAL NOT NULL,
    weight REAL NOT NULL,
    valid_from INTEGER NOT NULL,
    valid_to INTEGER,
    observed_at INTEGER NOT NULL,
    recorded_at INTEGER NOT NULL,
    handler TEXT,
    edge_json TEXT NOT NULL,
    PRIMARY KEY (tenant_id, user_id, edge_id)
);

CREATE TRIGGER IF NOT EXISTS hydro_edges_immutable
BEFORE UPDATE ON hydro_edges
BEGIN
    SELECT RAISE(ABORT, 'HydroEdge rows are immutable');
END;

CREATE TABLE IF NOT EXISTS worlds (
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    world_id TEXT NOT NULL,
    parent_world_id TEXT,
    name TEXT NOT NULL,
    zone TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    world_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (tenant_id, user_id, world_id)
);

CREATE TABLE IF NOT EXISTS world_node_refs (
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    world_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    PRIMARY KEY (tenant_id, user_id, world_id, node_id)
);

CREATE TABLE IF NOT EXISTS world_edge_refs (
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    world_id TEXT NOT NULL,
    edge_id TEXT NOT NULL,
    PRIMARY KEY (tenant_id, user_id, world_id, edge_id)
);

CREATE TABLE IF NOT EXISTS entities (
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    canonical_name TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    confidence REAL NOT NULL,
    entity_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (tenant_id, user_id, entity_id)
);

CREATE TABLE IF NOT EXISTS entity_aliases (
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    normalized_alias TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    alias TEXT NOT NULL,
    PRIMARY KEY (tenant_id, user_id, normalized_alias),
    FOREIGN KEY (tenant_id, user_id, entity_id)
        REFERENCES entities (tenant_id, user_id, entity_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contradictions (
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    contradiction_id TEXT NOT NULL,
    node_a TEXT NOT NULL,
    node_b TEXT NOT NULL,
    severity REAL NOT NULL,
    pressure REAL NOT NULL,
    resolved INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    contradiction_json TEXT NOT NULL,
    PRIMARY KEY (tenant_id, user_id, contradiction_id)
);

CREATE TABLE IF NOT EXISTS grounded_facts (
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    fact_ref TEXT NOT NULL,
    statement TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    source_reliability REAL NOT NULL,
    observed_at INTEGER NOT NULL,
    valid_from INTEGER NOT NULL,
    valid_to INTEGER,
    fact_json TEXT NOT NULL,
    PRIMARY KEY (tenant_id, user_id, fact_ref)
);

CREATE TABLE IF NOT EXISTS memory_contracts (
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    contract_json TEXT NOT NULL,
    PRIMARY KEY (tenant_id, user_id, node_id),
    FOREIGN KEY (tenant_id, user_id, node_id)
        REFERENCES hydro_nodes (tenant_id, user_id, node_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_log (
    audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    edge_id TEXT,
    edge_type TEXT,
    at INTEGER NOT NULL,
    affected_node_ids_json TEXT NOT NULL,
    summary TEXT NOT NULL,
    audit_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sketch_states (
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    sketch_key TEXT NOT NULL,
    sketch_kind TEXT NOT NULL,
    state_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (tenant_id, user_id, sketch_key)
);

CREATE TABLE IF NOT EXISTS cold_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    event_id TEXT,
    recorded_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nodes_tenant_user ON hydro_nodes (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_nodes_world ON hydro_nodes (tenant_id, user_id, world_id);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON hydro_nodes (tenant_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_nodes_valid_time ON hydro_nodes (tenant_id, user_id, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_nodes_recorded_time ON hydro_nodes (tenant_id, user_id, recorded_at, superseded_at);
CREATE INDEX IF NOT EXISTS idx_nodes_grounding ON hydro_nodes (tenant_id, user_id, grounding_ref);
CREATE INDEX IF NOT EXISTS idx_nodes_strict_active
    ON hydro_nodes (tenant_id, user_id, world_id, confidence, recorded_at)
    WHERE status = 'active' AND superseded_at IS NULL AND use_for_reasoning = 1;
CREATE INDEX IF NOT EXISTS idx_edges_from ON hydro_edges (tenant_id, user_id, from_id);
CREATE INDEX IF NOT EXISTS idx_edges_to ON hydro_edges (tenant_id, user_id, to_id);
CREATE INDEX IF NOT EXISTS idx_edges_type ON hydro_edges (tenant_id, user_id, edge_type);
CREATE INDEX IF NOT EXISTS idx_edges_from_to_type ON hydro_edges (tenant_id, user_id, from_id, to_id, edge_type);
CREATE INDEX IF NOT EXISTS idx_worlds_parent ON worlds (tenant_id, user_id, parent_world_id);
CREATE INDEX IF NOT EXISTS idx_world_node_refs_node ON world_node_refs (tenant_id, user_id, node_id);
CREATE INDEX IF NOT EXISTS idx_world_edge_refs_edge ON world_edge_refs (tenant_id, user_id, edge_id);
CREATE INDEX IF NOT EXISTS idx_entities_canonical ON entities (tenant_id, user_id, canonical_name);
CREATE INDEX IF NOT EXISTS idx_alias_canonical ON entity_aliases (tenant_id, user_id, normalized_alias);
CREATE INDEX IF NOT EXISTS idx_contradictions_nodes ON contradictions (tenant_id, user_id, node_a, node_b, resolved);
CREATE INDEX IF NOT EXISTS idx_facts_valid_time ON grounded_facts (tenant_id, user_id, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_audit_scope_time ON audit_log (tenant_id, user_id, at);
CREATE INDEX IF NOT EXISTS idx_cold_scope_time ON cold_logs (tenant_id, user_id, recorded_at);