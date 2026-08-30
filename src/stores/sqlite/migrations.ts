/*
*      __                      __  ___                               
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ / 
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /  
                     /____/                                 /____/   
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/stores/sqlite/migrations.ts
 *  usage : implements the LongMemory migrations component
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';

export type Migration = {
    version: number;
    name: string;
    sql: string;
};

export function load_schema_sql(): string {
    return readFileSync(fileURLToPath(new URL('./schema.sql', import.meta.url)), 'utf8');
}

export function migrations(): Migration[] {
    return [
        { version: 1, name: 'initial_hydrograph_schema', sql: load_schema_sql() },
        {
            version: 2,
            name: 'incremental_sketch_journal',
            sql: `ALTER TABLE sketch_states ADD COLUMN applied_operation_id INTEGER NOT NULL DEFAULT 0;
                CREATE TABLE sketch_operations (
                    operation_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tenant_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    sketch_key TEXT NOT NULL,
                    operation_json TEXT NOT NULL,
                    recorded_at INTEGER NOT NULL
                );
                CREATE INDEX idx_sketch_operations_scope
                    ON sketch_operations (tenant_id, user_id, sketch_key, operation_id);`,
        },
        {
            version: 3,
            name: 'normalized_world_memberships',
            sql: `CREATE TABLE IF NOT EXISTS world_node_refs (
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
                INSERT OR IGNORE INTO world_node_refs (tenant_id, user_id, world_id, node_id)
                    SELECT worlds.tenant_id, worlds.user_id, worlds.world_id, value
                    FROM worlds, json_each(worlds.world_json, '$.node_refs');
                INSERT OR IGNORE INTO world_edge_refs (tenant_id, user_id, world_id, edge_id)
                    SELECT worlds.tenant_id, worlds.user_id, worlds.world_id, value
                    FROM worlds, json_each(worlds.world_json, '$.edge_refs');
                UPDATE worlds SET world_json = json_set(
                    world_json,
                    '$.node_refs', json('[]'),
                    '$.edge_refs', json('[]')
                );
                CREATE INDEX IF NOT EXISTS idx_world_node_refs_node
                    ON world_node_refs (tenant_id, user_id, node_id);
                CREATE INDEX IF NOT EXISTS idx_world_edge_refs_edge
                    ON world_edge_refs (tenant_id, user_id, edge_id);`,
        },
    ];
}

export function apply_migrations(db: Database.Database, now = Date.now()): number[] {
    db.exec(`CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
    )`);
    const applied = new Set(
        (db.prepare('SELECT version FROM migrations').all() as Array<{ version: number }>).map((row) => row.version),
    );
    const completed: number[] = [];
    for (const migration of migrations()) {
        if (applied.has(migration.version)) continue;
        db.transaction(() => {
            db.exec(migration.sql);
            db.prepare('INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)')
                .run(migration.version, migration.name, now);
        })();
        completed.push(migration.version);
    }
    return completed;
}