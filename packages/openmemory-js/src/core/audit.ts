/**
 * Audit Trail System (D5)
 *
 * Provides append-only audit logging for all mutating operations on memories.
 * Tracks: create, update, delete, version, reinforce actions.
 *
 * Usage:
 *   - Call audit_log() after successful mutations
 *   - Query via GET /audit/logs endpoint
 */

import { run_async, all_async, get_async } from "./db";
import { env } from "./cfg";
import { rid, now } from "../utils";

const is_pg = env.metadata_backend === "postgres";
const sc = process.env.OM_PG_SCHEMA || "public";

export type AuditAction =
    | "create"
    | "update"
    | "delete"
    | "version"
    | "reinforce"
    | "ingest"
    | "merge";

export interface AuditEntry {
    id: string;
    resource_type: "memory" | "waypoint" | "fact" | "user";
    resource_id: string;
    action: AuditAction;
    actor_id: string | null;
    actor_type: "user" | "system" | "api";
    timestamp: number;
    changes: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
}

export interface AuditQueryOptions {
    resource_id?: string;
    resource_type?: string;
    action?: AuditAction;
    actor_id?: string;
    from_ts?: number;
    to_ts?: number;
    limit?: number;
    offset?: number;
}

/**
 * Initialize the audit_logs table
 * Called during database init
 */
export async function init_audit_table(): Promise<void> {
    const table = is_pg
        ? `"${sc}"."openmemory_audit_logs"`
        : "audit_logs";

    const create_sql = is_pg
        ? `CREATE TABLE IF NOT EXISTS ${table} (
            id UUID PRIMARY KEY,
            resource_type TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            action TEXT NOT NULL,
            actor_id TEXT,
            actor_type TEXT NOT NULL DEFAULT 'api',
            timestamp BIGINT NOT NULL,
            changes TEXT,
            metadata TEXT,
            CONSTRAINT valid_action CHECK (action IN ('create', 'update', 'delete', 'version', 'reinforce', 'ingest', 'merge'))
        )`
        : `CREATE TABLE IF NOT EXISTS ${table} (
            id TEXT PRIMARY KEY,
            resource_type TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'version', 'reinforce', 'ingest', 'merge')),
            actor_id TEXT,
            actor_type TEXT NOT NULL DEFAULT 'api',
            timestamp INTEGER NOT NULL,
            changes TEXT,
            metadata TEXT
        )`;

    await run_async(create_sql);

    // Create indexes for efficient querying
    const idx_resource = is_pg
        ? `CREATE INDEX IF NOT EXISTS audit_logs_resource_idx ON ${table}(resource_type, resource_id)`
        : `CREATE INDEX IF NOT EXISTS audit_logs_resource_idx ON ${table}(resource_type, resource_id)`;

    const idx_action = is_pg
        ? `CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON ${table}(action)`
        : `CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON ${table}(action)`;

    const idx_actor = is_pg
        ? `CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON ${table}(actor_id)`
        : `CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON ${table}(actor_id)`;

    const idx_ts = is_pg
        ? `CREATE INDEX IF NOT EXISTS audit_logs_ts_idx ON ${table}(timestamp)`
        : `CREATE INDEX IF NOT EXISTS audit_logs_ts_idx ON ${table}(timestamp)`;

    await run_async(idx_resource);
    await run_async(idx_action);
    await run_async(idx_actor);
    await run_async(idx_ts);
}

/**
 * Log an audit entry
 */
export async function audit_log(
    resource_type: AuditEntry["resource_type"],
    resource_id: string,
    action: AuditAction,
    options?: {
        actor_id?: string | null;
        actor_type?: AuditEntry["actor_type"];
        changes?: Record<string, unknown> | null;
        metadata?: Record<string, unknown> | null;
    }
): Promise<string> {
    const table = is_pg
        ? `"${sc}"."openmemory_audit_logs"`
        : "audit_logs";

    const id = rid();
    const ts = now();
    const actor_id = options?.actor_id || null;
    const actor_type = options?.actor_type || "api";
    const changes = options?.changes ? JSON.stringify(options.changes) : null;
    const metadata = options?.metadata ? JSON.stringify(options.metadata) : null;

    const sql = is_pg
        ? `INSERT INTO ${table} (id, resource_type, resource_id, action, actor_id, actor_type, timestamp, changes, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`
        : `INSERT INTO ${table} (id, resource_type, resource_id, action, actor_id, actor_type, timestamp, changes, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await run_async(sql, [
        id,
        resource_type,
        resource_id,
        action,
        actor_id,
        actor_type,
        ts,
        changes,
        metadata,
    ]);

    return id;
}

/**
 * Query audit logs with filters
 */
export async function query_audit_logs(
    options: AuditQueryOptions = {}
): Promise<AuditEntry[]> {
    const table = is_pg
        ? `"${sc}"."openmemory_audit_logs"`
        : "audit_logs";

    const conditions: string[] = [];
    const params: any[] = [];
    let param_idx = 1;

    if (options.resource_id) {
        conditions.push(is_pg ? `resource_id = $${param_idx++}` : "resource_id = ?");
        params.push(options.resource_id);
    }

    if (options.resource_type) {
        conditions.push(is_pg ? `resource_type = $${param_idx++}` : "resource_type = ?");
        params.push(options.resource_type);
    }

    if (options.action) {
        conditions.push(is_pg ? `action = $${param_idx++}` : "action = ?");
        params.push(options.action);
    }

    if (options.actor_id) {
        conditions.push(is_pg ? `actor_id = $${param_idx++}` : "actor_id = ?");
        params.push(options.actor_id);
    }

    if (options.from_ts) {
        conditions.push(is_pg ? `timestamp >= $${param_idx++}` : "timestamp >= ?");
        params.push(options.from_ts);
    }

    if (options.to_ts) {
        conditions.push(is_pg ? `timestamp <= $${param_idx++}` : "timestamp <= ?");
        params.push(options.to_ts);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    const sql = is_pg
        ? `SELECT * FROM ${table} ${where} ORDER BY timestamp DESC LIMIT $${param_idx++} OFFSET $${param_idx++}`
        : `SELECT * FROM ${table} ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`;

    params.push(limit, offset);

    const rows = await all_async(sql, params);

    return rows.map((row: any) => ({
        id: row.id,
        resource_type: row.resource_type,
        resource_id: row.resource_id,
        action: row.action,
        actor_id: row.actor_id,
        actor_type: row.actor_type,
        timestamp: row.timestamp,
        changes: row.changes ? JSON.parse(row.changes) : null,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
    }));
}

/**
 * Get audit log count with filters
 */
export async function count_audit_logs(
    options: Omit<AuditQueryOptions, "limit" | "offset"> = {}
): Promise<number> {
    const table = is_pg
        ? `"${sc}"."openmemory_audit_logs"`
        : "audit_logs";

    const conditions: string[] = [];
    const params: any[] = [];
    let param_idx = 1;

    if (options.resource_id) {
        conditions.push(is_pg ? `resource_id = $${param_idx++}` : "resource_id = ?");
        params.push(options.resource_id);
    }

    if (options.resource_type) {
        conditions.push(is_pg ? `resource_type = $${param_idx++}` : "resource_type = ?");
        params.push(options.resource_type);
    }

    if (options.action) {
        conditions.push(is_pg ? `action = $${param_idx++}` : "action = ?");
        params.push(options.action);
    }

    if (options.actor_id) {
        conditions.push(is_pg ? `actor_id = $${param_idx++}` : "actor_id = ?");
        params.push(options.actor_id);
    }

    if (options.from_ts) {
        conditions.push(is_pg ? `timestamp >= $${param_idx++}` : "timestamp >= ?");
        params.push(options.from_ts);
    }

    if (options.to_ts) {
        conditions.push(is_pg ? `timestamp <= $${param_idx++}` : "timestamp <= ?");
        params.push(options.to_ts);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `SELECT COUNT(*) as count FROM ${table} ${where}`;

    const result = await get_async(sql, params);
    return Number(result?.count || 0);
}

/**
 * Get audit history for a specific resource
 */
export async function get_resource_history(
    resource_type: AuditEntry["resource_type"],
    resource_id: string,
    limit = 50
): Promise<AuditEntry[]> {
    return query_audit_logs({
        resource_type,
        resource_id,
        limit,
    });
}
