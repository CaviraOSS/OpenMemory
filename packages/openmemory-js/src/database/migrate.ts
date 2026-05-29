/*
   ____                   __  __                                 
  / __ \                 |  \/  |                                
 | |  | |_ __   ___ _ __ | \  / | ___ _ __ ___   ___  _ __ _   _ 
 | |  | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 | |__| | |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
  \____/| .__/ \___|_| |_|_|  |_|\___|_| |_| |_|\___/|_|   \__, |
        | |                                                 __/ |
        |_|                                                |___/ 
  CaviraOSS @ 2026

 - filename: packages/openmemory-js/src/database/migrate.ts
 - what is the file used for: runs durable postgres schema migrations
*/

import { Pool } from "pg";
import { env } from "../configuration/index";
import {
  buildDurableSchemaSql,
  DURABLE_SCHEMA_VERSION,
} from "../durable/schema";
import { build_pg_pool_config } from "./pgconfig";

const log = (msg: string) => console.log(`[MIGRATE] ${msg}`);

async function set_db_version_pg(pool: Pool, version: string): Promise<void> {
  const schema = process.env.OM_PG_SCHEMA || "public";
  await pool.query(
    `CREATE TABLE IF NOT EXISTS "${schema}"."schema_version" (
      version TEXT PRIMARY KEY, applied_at BIGINT
    )`,
  );
  await pool.query(
    `INSERT INTO "${schema}"."schema_version" VALUES ($1, $2)
     ON CONFLICT (version) DO UPDATE SET applied_at = EXCLUDED.applied_at`,
    [version, Date.now()],
  );
}

async function run_durable_schema_migration(pool: Pool): Promise<void> {
  const schema = process.env.OM_PG_SCHEMA || "public";
  const vectorDim = process.env.OM_VEC_DIM
    ? +process.env.OM_VEC_DIM
    : env.vec_dim;
  const statements = buildDurableSchemaSql({ schema, vectorDim });

  log(`Running migration: ${DURABLE_SCHEMA_VERSION} - Durable core schema`);
  await pool.query("BEGIN");
  try {
    for (const sql of statements) {
      await pool.query(sql);
    }
    await pool.query("COMMIT");
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }

  await set_db_version_pg(pool, DURABLE_SCHEMA_VERSION);
  log(`Migration ${DURABLE_SCHEMA_VERSION} completed successfully`);
}

export async function run_migrations() {
  log("Checking for pending durable migrations...");
  const pool = new Pool(
    build_pg_pool_config(process.env.OM_PG_DB || "openmemory"),
  );

  try {
    await run_durable_schema_migration(pool);
  } finally {
    await pool.end();
  }

  log("All migrations completed");
}

if (require.main === module) {
  run_migrations().catch((err) => {
    console.error("[MIGRATE] Failed:", err);
    process.exit(1);
  });
}
