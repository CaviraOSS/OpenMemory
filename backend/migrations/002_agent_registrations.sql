-- Agent Registration Tables for OpenMemory MCP Proxy
-- Add these tables to support multi-agent namespace management

-- Agent registrations table
CREATE TABLE IF NOT EXISTS agent_registrations (
    agent_id TEXT PRIMARY KEY,
    namespace TEXT NOT NULL,
    permissions TEXT NOT NULL, -- JSON array: ["read", "write", "admin"]
    shared_namespaces TEXT DEFAULT '[]', -- JSON array of accessible shared namespaces
    api_key TEXT NOT NULL UNIQUE,
    description TEXT,
    registration_date INTEGER NOT NULL DEFAULT (unixepoch()),
    last_access INTEGER NOT NULL DEFAULT (unixepoch()),
    active INTEGER NOT NULL DEFAULT 1 -- 1 for active, 0 for disabled
);

-- Namespace groups table for managing shared spaces
CREATE TABLE IF NOT EXISTS namespace_groups (
    namespace TEXT PRIMARY KEY,
    group_type TEXT NOT NULL DEFAULT 'private', -- 'private', 'shared', 'public'
    description TEXT,
    created_by TEXT, -- agent_id that created this namespace
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (created_by) REFERENCES agent_registrations(agent_id)
);

-- Agent access log for auditing
CREATE TABLE IF NOT EXISTS agent_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    operation TEXT NOT NULL, -- 'query', 'store', 'reinforce', etc.
    namespace TEXT NOT NULL,
    timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
    success INTEGER NOT NULL DEFAULT 1, -- 1 for success, 0 for failure
    error_message TEXT,
    FOREIGN KEY (agent_id) REFERENCES agent_registrations(agent_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_registrations_namespace ON agent_registrations(namespace);
CREATE INDEX IF NOT EXISTS idx_agent_registrations_active ON agent_registrations(active);
CREATE INDEX IF NOT EXISTS idx_namespace_groups_type ON namespace_groups(group_type);
CREATE INDEX IF NOT EXISTS idx_agent_access_log_agent_id ON agent_access_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_access_log_timestamp ON agent_access_log(timestamp);

-- Insert default shared namespaces
INSERT OR IGNORE INTO namespace_groups (namespace, group_type, description, created_by) VALUES 
('public-knowledge', 'public', 'Publicly accessible knowledge base', NULL),
('team-shared', 'shared', 'Shared team collaboration space', NULL),
('company-policies', 'shared', 'Company policies and documentation', NULL);