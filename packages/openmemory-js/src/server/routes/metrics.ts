/**
 * Prometheus Metrics Endpoint
 *
 * Exposes /metrics for Prometheus scraping. This endpoint:
 * - Skips authentication (Prometheus needs unauthenticated access)
 * - Queries DB for memory counts and salience statistics
 * - Returns metrics in Prometheus text format
 */

import {
    registry,
    memories_total,
    salience_stats,
    database_size_bytes,
    vectors_total,
    vector_dimensions,
    vector_index_size_bytes,
    embed_logs_total,
} from "../../core/metrics";
import { all_async, get_async } from "../../core/db";
import { env } from "../../core/cfg";
import fs from "node:fs";
import path from "node:path";

const SECTORS = ["episodic", "semantic", "procedural", "emotional", "reflective"];

/**
 * Collect dynamic metrics from the database
 */
async function collect_db_metrics(): Promise<void> {
    const is_pg = env.metadata_backend === "postgres";

    try {
        // Get memory counts by sector
        const sector_counts = await all_async(
            is_pg
                ? `SELECT primary_sector, COUNT(*) as count FROM "${process.env.OM_PG_SCHEMA || "public"}"."${process.env.OM_PG_TABLE || "openmemory_memories"}" GROUP BY primary_sector`
                : "SELECT primary_sector, COUNT(*) as count FROM memories GROUP BY primary_sector"
        );

        // Reset and set memory counts
        memories_total.reset();
        for (const sector of SECTORS) {
            const row = sector_counts.find((r: any) => r.primary_sector === sector);
            memories_total.set({ sector }, row ? Number(row.count) : 0);
        }

        // Get salience statistics by sector
        const salience_query = is_pg
            ? `SELECT primary_sector,
                      AVG(salience) as avg_salience,
                      MIN(salience) as min_salience,
                      MAX(salience) as max_salience
               FROM "${process.env.OM_PG_SCHEMA || "public"}"."${process.env.OM_PG_TABLE || "openmemory_memories"}"
               WHERE salience IS NOT NULL
               GROUP BY primary_sector`
            : `SELECT primary_sector,
                      AVG(salience) as avg_salience,
                      MIN(salience) as min_salience,
                      MAX(salience) as max_salience
               FROM memories
               WHERE salience IS NOT NULL
               GROUP BY primary_sector`;

        const salience_rows = await all_async(salience_query);

        // Reset and set salience stats
        salience_stats.reset();
        for (const sector of SECTORS) {
            const row = salience_rows.find((r: any) => r.primary_sector === sector);
            if (row) {
                salience_stats.set({ stat: "avg", sector }, Number(row.avg_salience) || 0);
                salience_stats.set({ stat: "min", sector }, Number(row.min_salience) || 0);
                salience_stats.set({ stat: "max", sector }, Number(row.max_salience) || 0);
            } else {
                salience_stats.set({ stat: "avg", sector }, 0);
                salience_stats.set({ stat: "min", sector }, 0);
                salience_stats.set({ stat: "max", sector }, 0);
            }
        }

        // Get database size
        if (is_pg) {
            const db_name = process.env.OM_PG_DB || "openmemory";
            const size_row = await get_async(
                `SELECT pg_database_size($1) as size`,
                [db_name]
            );
            if (size_row) {
                database_size_bytes.set(Number(size_row.size) || 0);
            }
        } else {
            // SQLite: get file size
            const db_path = env.db_path || path.resolve(__dirname, "../../../data/openmemory.sqlite");
            try {
                const stats = fs.statSync(db_path);
                database_size_bytes.set(stats.size);
            } catch {
                database_size_bytes.set(0);
            }
        }

        // Set vector dimensions (from config)
        vector_dimensions.set(env.vec_dim);

        // Get vector counts by sector (PostgreSQL with pgvector)
        if (is_pg) {
            const schema = process.env.OM_PG_SCHEMA || "public";
            const vec_table = process.env.OM_VECTOR_TABLE || "openmemory_vectors";

            try {
                const vector_counts = await all_async(
                    `SELECT sector, COUNT(*) as count
                     FROM "${schema}"."${vec_table}"
                     GROUP BY sector`
                );
                vectors_total.reset();
                for (const sector of SECTORS) {
                    const row = vector_counts.find((r: any) => r.sector === sector);
                    vectors_total.set({ sector }, row ? Number(row.count) : 0);
                }
            } catch (e) {
                // Vector table may not exist or have different schema
                console.error("[METRICS] Failed to query vectors:", e);
            }

            // Get vector index size (pgvector HNSW index)
            try {
                const index_size = await get_async(
                    `SELECT pg_relation_size(indexrelid) as size
                     FROM pg_index
                     JOIN pg_class ON pg_class.oid = pg_index.indexrelid
                     WHERE pg_class.relname LIKE '%vector%' OR pg_class.relname LIKE '%hnsw%'
                     LIMIT 1`
                );
                vector_index_size_bytes.set(index_size ? Number(index_size.size) || 0 : 0);
            } catch {
                vector_index_size_bytes.set(0);
            }

            // Get embed_logs counts by status
            try {
                const log_table = `"${schema}"."openmemory_embed_logs"`;
                const log_counts = await all_async(
                    `SELECT status, COUNT(*) as count FROM ${log_table} GROUP BY status`
                );
                embed_logs_total.reset();
                for (const row of log_counts) {
                    embed_logs_total.set({ status: row.status || "unknown" }, Number(row.count) || 0);
                }
            } catch {
                // embed_logs table may not exist
            }
        }
    } catch (error) {
        console.error("[METRICS] Failed to collect DB metrics:", error);
    }
}

export function metrics(app: any): void {
    // Register metrics endpoint BEFORE auth middleware
    // This is handled by route registration order in routes/index.ts
    app.get("/metrics", async (_req: any, res: any) => {
        try {
            // Collect fresh DB metrics before responding
            await collect_db_metrics();

            // Return Prometheus metrics
            res.setHeader("Content-Type", registry.contentType);
            res.send(await registry.metrics());
        } catch (error) {
            console.error("[METRICS] Error generating metrics:", error);
            res.status(500).send("Error generating metrics");
        }
    });
}
