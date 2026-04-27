import { env } from "./cfg";
import sqlite3 from "sqlite3";
import { Pool } from "pg";
import {
    assertSafeIdentifier,
    DEFAULT_VECTOR_TABLE,
    LEGACY_ORPHAN_TENANT,
} from "./identifiers";
import { resolvePgSsl } from "./pg_ssl";

const is_pg = env.metadata_backend === "postgres";

const log = (msg: string) => console.log(`[MIGRATE] ${msg}`);

// SQLite vector table: prefer explicit env var (validated), then the
// canonical default, with a fallback to the legacy `vectors` name when
// only the legacy table exists on disk. The fallback is resolved at
// runtime (see `resolveSqliteVectorTable`).
const LEGACY_SQLITE_VECTOR_TABLE = "vectors";

interface Migration {
    version: string;
    desc: string;
    sqlite: (vectorTable: string) => string[];
    postgres: string[];
}

const migrations: Migration[] = [
    {
        version: "1.2.0",
        desc: "Multi-user tenant support",
        sqlite: (vectorTable: string) => [
            `ALTER TABLE memories ADD COLUMN user_id TEXT`,
            `CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id)`,
            `ALTER TABLE ${vectorTable} ADD COLUMN user_id TEXT`,
            `CREATE INDEX IF NOT EXISTS idx_vectors_user ON ${vectorTable}(user_id)`,
            `CREATE TABLE IF NOT EXISTS waypoints_new (
        src_id TEXT, dst_id TEXT NOT NULL, user_id TEXT,
        weight REAL NOT NULL, created_at INTEGER, updated_at INTEGER,
        PRIMARY KEY(src_id, user_id)
      )`,
            `INSERT INTO waypoints_new SELECT src_id, dst_id, NULL, weight, created_at, updated_at FROM waypoints`,
            `DROP TABLE waypoints`,
            `ALTER TABLE waypoints_new RENAME TO waypoints`,
            `CREATE INDEX IF NOT EXISTS idx_waypoints_src ON waypoints(src_id)`,
            `CREATE INDEX IF NOT EXISTS idx_waypoints_dst ON waypoints(dst_id)`,
            `CREATE INDEX IF NOT EXISTS idx_waypoints_user ON waypoints(user_id)`,
            `CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY, summary TEXT,
        reflection_count INTEGER DEFAULT 0,
        created_at INTEGER, updated_at INTEGER
      )`,
            `CREATE TABLE IF NOT EXISTS stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL, count INTEGER DEFAULT 1, ts INTEGER NOT NULL
      )`,
            `CREATE INDEX IF NOT EXISTS idx_stats_ts ON stats(ts)`,
            `CREATE INDEX IF NOT EXISTS idx_stats_type ON stats(type)`,
        ],
        postgres: [
            `ALTER TABLE {m} ADD COLUMN IF NOT EXISTS user_id TEXT`,
            `CREATE INDEX IF NOT EXISTS openmemory_memories_user_idx ON {m}(user_id)`,
            `ALTER TABLE {v} ADD COLUMN IF NOT EXISTS user_id TEXT`,
            `CREATE INDEX IF NOT EXISTS openmemory_vectors_user_idx ON {v}(user_id)`,
            `ALTER TABLE {w} ADD COLUMN IF NOT EXISTS user_id TEXT`,
            `ALTER TABLE {w} DROP CONSTRAINT IF EXISTS waypoints_pkey`,
            `ALTER TABLE {w} ADD PRIMARY KEY (src_id, user_id)`,
            `CREATE INDEX IF NOT EXISTS openmemory_waypoints_user_idx ON {w}(user_id)`,
            `CREATE TABLE IF NOT EXISTS {u} (
        user_id TEXT PRIMARY KEY, summary TEXT,
        reflection_count INTEGER DEFAULT 0,
        created_at BIGINT, updated_at BIGINT
      )`,
        ],
    },
    {
        version: "1.3.0",
        desc: "Project-level isolation support",
        sqlite: (vectorTable: string) => [
            `ALTER TABLE memories ADD COLUMN project_id TEXT`,
            `CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id)`,
            `ALTER TABLE ${vectorTable} ADD COLUMN project_id TEXT`,
            `CREATE INDEX IF NOT EXISTS idx_vectors_project ON ${vectorTable}(project_id)`,
            `ALTER TABLE waypoints ADD COLUMN project_id TEXT`,
            `CREATE INDEX IF NOT EXISTS idx_waypoints_project ON waypoints(project_id)`,
            `ALTER TABLE temporal_facts ADD COLUMN project_id TEXT`,
            `CREATE INDEX IF NOT EXISTS idx_temporal_project ON temporal_facts(project_id)`,
        ],
        postgres: [
            `ALTER TABLE {m} ADD COLUMN IF NOT EXISTS project_id TEXT`,
            `CREATE INDEX IF NOT EXISTS openmemory_memories_project_idx ON {m}(project_id)`,
            `ALTER TABLE {v} ADD COLUMN IF NOT EXISTS project_id TEXT`,
            `CREATE INDEX IF NOT EXISTS openmemory_vectors_project_idx ON {v}(project_id)`,
            `ALTER TABLE {w} ADD COLUMN IF NOT EXISTS project_id TEXT`,
            `CREATE INDEX IF NOT EXISTS openmemory_waypoints_project_idx ON {w}(project_id)`,
            `ALTER TABLE temporal_facts ADD COLUMN IF NOT EXISTS project_id TEXT`,
            `CREATE INDEX IF NOT EXISTS temporal_facts_project_idx ON temporal_facts(project_id)`,
        ],
    },
];

async function get_db_version_sqlite(
    db: sqlite3.Database,
): Promise<string | null> {
    return new Promise((ok, no) => {
        db.get(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'`,
            (err, row: any) => {
                if (err) return no(err);
                if (!row) return ok(null);
                db.get(
                    `SELECT version FROM schema_version ORDER BY applied_at DESC LIMIT 1`,
                    (e, v: any) => {
                        if (e) return no(e);
                        ok(v?.version || null);
                    },
                );
            },
        );
    });
}

async function set_db_version_sqlite(
    db: sqlite3.Database,
    version: string,
): Promise<void> {
    return new Promise((ok, no) => {
        db.run(
            `CREATE TABLE IF NOT EXISTS schema_version (
        version TEXT PRIMARY KEY, applied_at INTEGER
      )`,
            (err) => {
                if (err) return no(err);
                db.run(
                    `INSERT OR REPLACE INTO schema_version VALUES (?, ?)`,
                    [version, Date.now()],
                    (e) => {
                        if (e) return no(e);
                        ok();
                    },
                );
            },
        );
    });
}

async function check_column_exists_sqlite(
    db: sqlite3.Database,
    table: string,
    column: string,
): Promise<boolean> {
    return new Promise((ok, no) => {
        db.all(`PRAGMA table_info(${table})`, (err, rows: any[]) => {
            if (err) return no(err);
            ok(rows.some((r) => r.name === column));
        });
    });
}

/**
 * Resolve which vector table this SQLite database actually uses.
 * Priority:
 *   1. OM_VECTOR_TABLE if set (validated as a safe identifier).
 *   2. The legacy `vectors` table if present on disk (back-compat).
 *   3. The canonical `openmemory_vectors` default.
 */
async function resolveSqliteVectorTable(db: sqlite3.Database): Promise<string> {
    const explicit = process.env.OM_VECTOR_TABLE;
    if (explicit) return assertSafeIdentifier(explicit, "OM_VECTOR_TABLE");

    const tableExists = (name: string) =>
        new Promise<boolean>((ok, no) => {
            db.get(
                `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
                [name],
                (err, row: any) => (err ? no(err) : ok(!!row)),
            );
        });

    if (await tableExists(LEGACY_SQLITE_VECTOR_TABLE)) {
        log(
            `Detected legacy "${LEGACY_SQLITE_VECTOR_TABLE}" table; migration will target it. ` +
                `Consider renaming to "${DEFAULT_VECTOR_TABLE}" once safe.`,
        );
        return LEGACY_SQLITE_VECTOR_TABLE;
    }
    return DEFAULT_VECTOR_TABLE;
}

async function run_sqlite_migration(
    db: sqlite3.Database,
    m: Migration,
): Promise<void> {
    log(`Running migration: ${m.version} - ${m.desc}`);

    const has_user_id = await check_column_exists_sqlite(
        db,
        "memories",
        "user_id",
    );
    if (has_user_id) {
        log(
            `Migration ${m.version} already applied (user_id exists), skipping`,
        );
        await set_db_version_sqlite(db, m.version);
        return;
    }

    const vectorTable = await resolveSqliteVectorTable(db);
    const stmts = m.sqlite(vectorTable);

    for (const sql of stmts) {
        await new Promise<void>((ok, no) => {
            db.run(sql, (err) => {
                if (err && !err.message.includes("duplicate column")) {
                    log(`ERROR: ${err.message}`);
                    return no(err);
                }
                ok();
            });
        });
    }

    await set_db_version_sqlite(db, m.version);
    log(`Migration ${m.version} completed successfully`);
}

function pgSchema(): string {
    return assertSafeIdentifier(
        process.env.OM_PG_SCHEMA || "public",
        "OM_PG_SCHEMA",
    );
}

async function get_db_version_pg(pool: Pool): Promise<string | null> {
    try {
        const sc = pgSchema();
        const check = await pool.query(
            `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = 'schema_version'
      )`,
            [sc],
        );
        if (!check.rows[0].exists) return null;

        const ver = await pool.query(
            `SELECT version FROM "${sc}"."schema_version" ORDER BY applied_at DESC LIMIT 1`,
        );
        return ver.rows[0]?.version || null;
    } catch (e) {
        return null;
    }
}

async function set_db_version_pg(pool: Pool, version: string): Promise<void> {
    const sc = pgSchema();
    await pool.query(
        `CREATE TABLE IF NOT EXISTS "${sc}"."schema_version" (
      version TEXT PRIMARY KEY, applied_at BIGINT
    )`,
    );
    await pool.query(
        `INSERT INTO "${sc}"."schema_version" VALUES ($1, $2)
     ON CONFLICT (version) DO UPDATE SET applied_at = EXCLUDED.applied_at`,
        [version, Date.now()],
    );
}

async function check_column_exists_pg(
    pool: Pool,
    table: string,
    column: string,
): Promise<boolean> {
    const sc = pgSchema();
    const tbl = table.replace(/"/g, "").split(".").pop() || table;
    const res = await pool.query(
        `SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
    )`,
        [sc, tbl, column],
    );
    return res.rows[0].exists;
}

async function run_pg_migration(pool: Pool, m: Migration): Promise<void> {
    log(`Running migration: ${m.version} - ${m.desc}`);

    const sc = pgSchema();
    const mt = assertSafeIdentifier(
        process.env.OM_PG_TABLE || "openmemory_memories",
        "OM_PG_TABLE",
    );
    const vt = assertSafeIdentifier(
        process.env.OM_VECTOR_TABLE || DEFAULT_VECTOR_TABLE,
        "OM_VECTOR_TABLE",
    );
    const has_user_id = await check_column_exists_pg(pool, mt, "user_id");

    if (has_user_id) {
        log(
            `Migration ${m.version} already applied (user_id exists), skipping`,
        );
        await set_db_version_pg(pool, m.version);
        return;
    }

    const replacements: Record<string, string> = {
        "{m}": `"${sc}"."${mt}"`,
        "{v}": `"${sc}"."${vt}"`,
        "{w}": `"${sc}"."openmemory_waypoints"`,
        "{u}": `"${sc}"."openmemory_users"`,
    };

    for (let sql of m.postgres) {
        for (const [k, v] of Object.entries(replacements)) {
            sql = sql.replace(new RegExp(k, "g"), v);
        }

        try {
            await pool.query(sql);
        } catch (e: any) {
            if (
                !e.message.includes("already exists") &&
                !e.message.includes("duplicate")
            ) {
                log(`ERROR: ${e.message}`);
                throw e;
            }
        }
    }

    await set_db_version_pg(pool, m.version);
    log(`Migration ${m.version} completed successfully`);
}

/**
 * One-shot data hygiene step: quarantine any pre-existing temporal_facts
 * rows whose user_id was NULL (i.e. were inserted before per-tenant
 * filtering became mandatory) under the synthetic LEGACY_ORPHAN_TENANT
 * id. This is idempotent: once stamped, the WHERE clause matches no rows
 * on subsequent runs. We do this outside the schema-version-tracked
 * migrations because temporal_facts is created lazily by db.ts on first
 * use rather than via a versioned migration step.
 */
async function quarantine_orphan_temporal_facts_sqlite(
    db: sqlite3.Database,
): Promise<void> {
    const tableExists = await new Promise<boolean>((ok, no) => {
        db.get(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='temporal_facts'`,
            (err, row: any) => (err ? no(err) : ok(!!row)),
        );
    });
    if (!tableExists) return;
    await new Promise<void>((ok, no) => {
        db.run(
            `UPDATE temporal_facts SET user_id = ? WHERE user_id IS NULL`,
            [LEGACY_ORPHAN_TENANT],
            function (err) {
                if (err) return no(err);
                if (this.changes > 0) {
                    log(
                        `Quarantined ${this.changes} orphan temporal_facts rows under ${LEGACY_ORPHAN_TENANT}`,
                    );
                }
                ok();
            },
        );
    });
}

async function quarantine_orphan_temporal_facts_pg(pool: Pool): Promise<void> {
    const sc = pgSchema();
    const check = await pool.query(
        `SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = $1 AND table_name = 'temporal_facts'
        )`,
        [sc],
    );
    if (!check.rows[0].exists) return;
    const res = await pool.query(
        `UPDATE "${sc}"."temporal_facts" SET user_id = $1 WHERE user_id IS NULL`,
        [LEGACY_ORPHAN_TENANT],
    );
    if (res.rowCount && res.rowCount > 0) {
        log(
            `Quarantined ${res.rowCount} orphan temporal_facts rows under ${LEGACY_ORPHAN_TENANT}`,
        );
    }
}

export async function run_migrations() {
    log("Checking for pending migrations...");

    if (is_pg) {
        const ssl = resolvePgSsl(process.env);
        const db_name = assertSafeIdentifier(
            process.env.OM_PG_DB || "openmemory",
            "OM_PG_DB",
        );

        const pool = new Pool({
            host: process.env.OM_PG_HOST,
            port: process.env.OM_PG_PORT ? +process.env.OM_PG_PORT : undefined,
            database: db_name,
            user: process.env.OM_PG_USER,
            password: process.env.OM_PG_PASSWORD,
            ssl,
        });

        const current = await get_db_version_pg(pool);
        log(`Current database version: ${current || "none"}`);

        for (const m of migrations) {
            if (!current || m.version > current) {
                await run_pg_migration(pool, m);
            }
        }

        await quarantine_orphan_temporal_facts_pg(pool);

        await pool.end();
    } else {
        const db_path = process.env.OM_DB_PATH || "./data/openmemory.sqlite";
        const db = new sqlite3.Database(db_path);

        const current = await get_db_version_sqlite(db);
        log(`Current database version: ${current || "none"}`);

        for (const m of migrations) {
            if (!current || m.version > current) {
                await run_sqlite_migration(db, m);
            }
        }

        await quarantine_orphan_temporal_facts_sqlite(db);

        await new Promise<void>((ok) => db.close(() => ok()));
    }

    log("All migrations completed");
}
