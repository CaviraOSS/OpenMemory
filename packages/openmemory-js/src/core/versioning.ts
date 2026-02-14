/**
 * Document Versioning System (D1)
 *
 * Provides version tracking for memories with:
 * - Version history storage
 * - Diff generation between versions
 * - Version retrieval and comparison
 */

import { run_async, all_async, get_async, q, transaction } from "./db";
import { env } from "./cfg";
import { rid, now, j } from "../utils";

const is_pg = env.metadata_backend === "postgres";
const sc = process.env.OM_PG_SCHEMA || "public";

/**
 * Maximum number of versions to keep per memory (configurable via env)
 * Default: 50 versions per memory
 */
const MAX_VERSIONS_PER_MEMORY = parseInt(process.env.OM_MAX_VERSIONS_PER_MEMORY || "50", 10);

export interface VersionEntry {
    id: string;
    memory_id: string;
    version_number: number;
    content: string;
    tags: string | null;
    metadata: string | null;
    primary_sector: string;
    change_summary: string | null;
    created_at: number;
    created_by: string | null;
}

export interface VersionDiff {
    added: string[];
    removed: string[];
    unchanged: string[];
    change_type: "minor" | "moderate" | "major";
    similarity: number;
}

/**
 * Initialize version_history table
 */
export async function init_versioning_table(): Promise<void> {
    const table = is_pg
        ? `"${sc}"."openmemory_version_history"`
        : "version_history";

    const create_sql = is_pg
        ? `CREATE TABLE IF NOT EXISTS ${table} (
            id UUID PRIMARY KEY,
            memory_id UUID NOT NULL,
            version_number INTEGER NOT NULL,
            content TEXT NOT NULL,
            tags TEXT,
            metadata TEXT,
            primary_sector TEXT NOT NULL,
            change_summary TEXT,
            created_at BIGINT NOT NULL,
            created_by TEXT,
            UNIQUE(memory_id, version_number)
        )`
        : `CREATE TABLE IF NOT EXISTS ${table} (
            id TEXT PRIMARY KEY,
            memory_id TEXT NOT NULL,
            version_number INTEGER NOT NULL,
            content TEXT NOT NULL,
            tags TEXT,
            metadata TEXT,
            primary_sector TEXT NOT NULL,
            change_summary TEXT,
            created_at INTEGER NOT NULL,
            created_by TEXT,
            UNIQUE(memory_id, version_number)
        )`;

    await run_async(create_sql);

    // Create indexes
    const idx_memory = is_pg
        ? `CREATE INDEX IF NOT EXISTS version_history_memory_idx ON ${table}(memory_id)`
        : `CREATE INDEX IF NOT EXISTS version_history_memory_idx ON ${table}(memory_id)`;

    const idx_version = is_pg
        ? `CREATE INDEX IF NOT EXISTS version_history_version_idx ON ${table}(memory_id, version_number)`
        : `CREATE INDEX IF NOT EXISTS version_history_version_idx ON ${table}(memory_id, version_number)`;

    await run_async(idx_memory);
    await run_async(idx_version);
}

/**
 * Save a version snapshot before updating
 */
export async function save_version(
    memory_id: string,
    content: string,
    tags: string | null,
    metadata: string | null,
    primary_sector: string,
    version_number: number,
    change_summary?: string,
    created_by?: string
): Promise<string> {
    const table = is_pg
        ? `"${sc}"."openmemory_version_history"`
        : "version_history";

    const id = rid();
    const ts = now();

    const sql = is_pg
        ? `INSERT INTO ${table} (id, memory_id, version_number, content, tags, metadata, primary_sector, change_summary, created_at, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`
        : `INSERT INTO ${table} (id, memory_id, version_number, content, tags, metadata, primary_sector, change_summary, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await run_async(sql, [
        id,
        memory_id,
        version_number,
        content,
        tags,
        metadata,
        primary_sector,
        change_summary || null,
        ts,
        created_by || null,
    ]);

    // Auto-prune old versions to prevent unbounded growth
    // Run async without blocking the return
    prune_versions(memory_id).catch(e =>
        console.error(`[versioning] Failed to prune versions for ${memory_id}:`, e)
    );

    return id;
}

/**
 * Get all versions of a memory
 */
export async function get_versions(
    memory_id: string,
    limit = 50
): Promise<VersionEntry[]> {
    const table = is_pg
        ? `"${sc}"."openmemory_version_history"`
        : "version_history";

    const sql = is_pg
        ? `SELECT * FROM ${table} WHERE memory_id = $1 ORDER BY version_number DESC LIMIT $2`
        : `SELECT * FROM ${table} WHERE memory_id = ? ORDER BY version_number DESC LIMIT ?`;

    const rows = await all_async(sql, [memory_id, limit]);

    return rows.map((row: any) => ({
        id: row.id,
        memory_id: row.memory_id,
        version_number: row.version_number,
        content: row.content,
        tags: row.tags,
        metadata: row.metadata,
        primary_sector: row.primary_sector,
        change_summary: row.change_summary,
        created_at: row.created_at,
        created_by: row.created_by,
    }));
}

/**
 * Get a specific version
 */
export async function get_version(
    memory_id: string,
    version_number: number
): Promise<VersionEntry | null> {
    const table = is_pg
        ? `"${sc}"."openmemory_version_history"`
        : "version_history";

    const sql = is_pg
        ? `SELECT * FROM ${table} WHERE memory_id = $1 AND version_number = $2`
        : `SELECT * FROM ${table} WHERE memory_id = ? AND version_number = ?`;

    const row = await get_async(sql, [memory_id, version_number]);

    if (!row) return null;

    return {
        id: row.id,
        memory_id: row.memory_id,
        version_number: row.version_number,
        content: row.content,
        tags: row.tags,
        metadata: row.metadata,
        primary_sector: row.primary_sector,
        change_summary: row.change_summary,
        created_at: row.created_at,
        created_by: row.created_by,
    };
}

/**
 * Compute line-based diff between two content strings
 */
export function compute_diff(old_content: string, new_content: string): VersionDiff {
    const old_lines = old_content.split("\n");
    const new_lines = new_content.split("\n");

    const old_set = new Set(old_lines);
    const new_set = new Set(new_lines);

    const added: string[] = [];
    const removed: string[] = [];
    const unchanged: string[] = [];

    for (const line of new_lines) {
        if (old_set.has(line)) {
            unchanged.push(line);
        } else {
            added.push(line);
        }
    }

    for (const line of old_lines) {
        if (!new_set.has(line)) {
            removed.push(line);
        }
    }

    // Calculate similarity using Jaccard index
    const total_unique = new Set([...old_lines, ...new_lines]).size;
    const similarity = total_unique > 0 ? unchanged.length / total_unique : 1;

    // Classify change type
    let change_type: "minor" | "moderate" | "major";
    if (similarity >= 0.9) {
        change_type = "minor";
    } else if (similarity >= 0.5) {
        change_type = "moderate";
    } else {
        change_type = "major";
    }

    return {
        added,
        removed,
        unchanged,
        change_type,
        similarity: Math.round(similarity * 100) / 100,
    };
}

/**
 * Compute diff between two versions
 */
export async function diff_versions(
    memory_id: string,
    version_a: number,
    version_b: number
): Promise<VersionDiff & { version_a: VersionEntry; version_b: VersionEntry } | null> {
    const [va, vb] = await Promise.all([
        get_version(memory_id, version_a),
        get_version(memory_id, version_b),
    ]);

    if (!va || !vb) return null;

    const diff = compute_diff(va.content, vb.content);

    return {
        ...diff,
        version_a: va,
        version_b: vb,
    };
}

/**
 * Generate a change summary from diff
 */
export function generate_change_summary(diff: VersionDiff): string {
    const parts: string[] = [];

    if (diff.added.length > 0) {
        parts.push(`+${diff.added.length} lines`);
    }
    if (diff.removed.length > 0) {
        parts.push(`-${diff.removed.length} lines`);
    }

    const summary = parts.length > 0
        ? `${diff.change_type} change: ${parts.join(", ")}`
        : "no changes";

    return summary;
}

/**
 * Restore a memory to a previous version
 */
export async function restore_version(
    memory_id: string,
    version_number: number,
    user_id?: string
): Promise<{ success: boolean; new_version: number }> {
    const version = await get_version(memory_id, version_number);
    if (!version) {
        throw new Error(`Version ${version_number} not found for memory ${memory_id}`);
    }

    // Get current memory state
    const current = await q.get_mem.get(memory_id);
    if (!current) {
        throw new Error(`Memory ${memory_id} not found`);
    }

    // Save current state as a new version before restoring
    await save_version(
        memory_id,
        current.content,
        current.tags,
        current.meta,
        current.primary_sector,
        current.version,
        `Pre-restore snapshot (before reverting to v${version_number})`,
        user_id
    );

    // Update the memory with restored content
    const new_version = current.version + 1;
    await transaction.begin();
    try {
        await q.upd_mem_with_sector.run(
            version.content,
            version.primary_sector,
            version.tags || "[]",
            version.metadata || "{}",
            now(),
            memory_id
        );
        await transaction.commit();

        // Save the restored state as well
        await save_version(
            memory_id,
            version.content,
            version.tags,
            version.metadata,
            version.primary_sector,
            new_version,
            `Restored from v${version_number}`,
            user_id
        );

        return { success: true, new_version };
    } catch (e) {
        await transaction.rollback();
        throw e;
    }
}

/**
 * Get version count for a memory
 */
export async function count_versions(memory_id: string): Promise<number> {
    const table = is_pg
        ? `"${sc}"."openmemory_version_history"`
        : "version_history";

    const sql = `SELECT COUNT(*) as count FROM ${table} WHERE memory_id = ${is_pg ? "$1" : "?"}`;
    const result = await get_async(sql, [memory_id]);

    return Number(result?.count || 0);
}

/**
 * Prune old versions for a memory, keeping only the most recent N versions.
 * This prevents unbounded version history growth.
 *
 * @param memory_id The memory to prune versions for
 * @param max_versions Maximum versions to keep (defaults to OM_MAX_VERSIONS_PER_MEMORY)
 * @returns Number of versions deleted
 */
export async function prune_versions(
    memory_id: string,
    max_versions: number = MAX_VERSIONS_PER_MEMORY
): Promise<number> {
    const table = is_pg
        ? `"${sc}"."openmemory_version_history"`
        : "version_history";

    // Get count of existing versions
    const count = await count_versions(memory_id);
    if (count <= max_versions) {
        return 0;
    }

    // Get IDs of versions to delete (oldest ones beyond the limit)
    const versions_to_delete = count - max_versions;

    if (is_pg) {
        // PostgreSQL: Delete oldest versions keeping max_versions most recent
        const delete_sql = `
            DELETE FROM ${table}
            WHERE id IN (
                SELECT id FROM ${table}
                WHERE memory_id = $1
                ORDER BY version_number ASC
                LIMIT $2
            )
        `;
        await run_async(delete_sql, [memory_id, versions_to_delete]);
    } else {
        // SQLite: Need to get IDs first, then delete
        const select_sql = `
            SELECT id FROM ${table}
            WHERE memory_id = ?
            ORDER BY version_number ASC
            LIMIT ?
        `;
        const rows = await all_async(select_sql, [memory_id, versions_to_delete]);

        if (rows.length > 0) {
            const ids = rows.map((r: any) => r.id);
            const placeholders = ids.map(() => "?").join(",");
            const delete_sql = `DELETE FROM ${table} WHERE id IN (${placeholders})`;
            await run_async(delete_sql, ids);
        }
    }

    return versions_to_delete;
}

/**
 * Prune versions for all memories that exceed the limit.
 * Useful for periodic maintenance.
 *
 * @param max_versions Maximum versions to keep per memory
 * @returns Total number of versions deleted across all memories
 */
export async function prune_all_versions(
    max_versions: number = MAX_VERSIONS_PER_MEMORY
): Promise<{ memories_pruned: number; versions_deleted: number }> {
    const table = is_pg
        ? `"${sc}"."openmemory_version_history"`
        : "version_history";

    // Find memories with more than max_versions
    const sql = is_pg
        ? `SELECT memory_id, COUNT(*) as count FROM ${table} GROUP BY memory_id HAVING COUNT(*) > $1`
        : `SELECT memory_id, COUNT(*) as count FROM ${table} GROUP BY memory_id HAVING COUNT(*) > ?`;

    const rows = await all_async(sql, [max_versions]);

    let total_deleted = 0;
    for (const row of rows) {
        const deleted = await prune_versions(row.memory_id, max_versions);
        total_deleted += deleted;
    }

    return {
        memories_pruned: rows.length,
        versions_deleted: total_deleted,
    };
}

/**
 * Get current max versions setting
 */
export function get_max_versions(): number {
    return MAX_VERSIONS_PER_MEMORY;
}
