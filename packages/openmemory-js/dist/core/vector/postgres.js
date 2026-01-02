"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresVectorStore = void 0;
const embed_1 = require("../../memory/embed");
/**
 * PostgresVectorStore with native pgvector support
 *
 * Features:
 * - Multi-tenant isolation via tenant_id
 * - Native pgvector similarity search using <-> operator (cosine distance)
 * - HNSW index support for O(log n) search performance
 * - Dual storage: 'embedding' (vector type) and 'v' (BYTEA) for backward compatibility
 *
 * Performance:
 * - In-memory (old): O(n) search, unusable at 50M+ memories
 * - pgvector HNSW (new): O(log n) search, < 50ms at 50M+ memories
 */
class PostgresVectorStore {
    db;
    table;
    usePgvector;
    constructor(db, tableName = "vectors", usePgvector = true) {
        this.db = db;
        this.table = tableName;
        this.usePgvector = usePgvector;
    }
    async storeVector(id, sector, vector, dim, tenant_id, user_id) {
        console.error(`[Vector] Storing ID: ${id}, Tenant: ${tenant_id}, Sector: ${sector}, Dim: ${dim}`);
        if (this.usePgvector) {
            // Store as both pgvector type (for fast search) and BYTEA (for backward compatibility)
            const vectorStr = `[${vector.join(',')}]`;
            const v = (0, embed_1.vectorToBuffer)(vector);
            const sql = `
                INSERT INTO ${this.table} (id, sector, tenant_id, user_id, embedding, v, dim)
                VALUES ($1, $2, $3, $4, $5::vector, $6, $7)
                ON CONFLICT (tenant_id, id, sector)
                DO UPDATE SET
                    user_id = EXCLUDED.user_id,
                    embedding = EXCLUDED.embedding,
                    v = EXCLUDED.v,
                    dim = EXCLUDED.dim
            `;
            await this.db.run_async(sql, [id, sector, tenant_id, user_id || "anonymous", vectorStr, v, dim]);
        }
        else {
            // Legacy BYTEA-only storage (for SQLite or non-pgvector PostgreSQL)
            const v = (0, embed_1.vectorToBuffer)(vector);
            const sql = `
                INSERT INTO ${this.table} (id, sector, tenant_id, user_id, v, dim)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (tenant_id, id, sector)
                DO UPDATE SET
                    user_id = EXCLUDED.user_id,
                    v = EXCLUDED.v,
                    dim = EXCLUDED.dim
            `;
            await this.db.run_async(sql, [id, sector, tenant_id, user_id || "anonymous", v, dim]);
        }
    }
    async deleteVector(id, sector, tenant_id) {
        await this.db.run_async(`DELETE FROM ${this.table} WHERE tenant_id = $1 AND id = $2 AND sector = $3`, [tenant_id, id, sector]);
    }
    async deleteVectors(id, tenant_id) {
        await this.db.run_async(`DELETE FROM ${this.table} WHERE tenant_id = $1 AND id = $2`, [tenant_id, id]);
    }
    async searchSimilar(sector, queryVec, topK, tenant_id) {
        if (this.usePgvector) {
            // Native pgvector search using HNSW index
            // <-> is cosine distance operator (0 = identical, 2 = opposite)
            // We convert distance to similarity score: score = 1 - (distance / 2)
            const vectorStr = `[${queryVec.join(',')}]`;
            const sql = `
                SELECT
                    id,
                    1 - (embedding <-> $1::vector) / 2 AS score
                FROM ${this.table}
                WHERE tenant_id = $2 AND sector = $3 AND embedding IS NOT NULL
                ORDER BY embedding <-> $1::vector
                LIMIT $4
            `;
            const rows = await this.db.all_async(sql, [vectorStr, tenant_id, sector, topK]);
            console.error(`[Vector] pgvector Search - Tenant: ${tenant_id}, Sector: ${sector}, Found ${rows.length} results`);
            return rows.map(row => ({
                id: row.id,
                score: row.score
            }));
        }
        else {
            // Fallback: In-memory cosine similarity (for backward compatibility or SQLite)
            // WARNING: This does NOT scale beyond ~100K vectors!
            const rows = await this.db.all_async(`SELECT id, v, dim FROM ${this.table} WHERE tenant_id = $1 AND sector = $2`, [tenant_id, sector]);
            console.error(`[Vector] In-Memory Search - Tenant: ${tenant_id}, Sector: ${sector}, Found ${rows.length} rows (WARNING: Not scalable!)`);
            const sims = [];
            for (const row of rows) {
                const vec = (0, embed_1.bufferToVector)(row.v);
                const sim = (0, embed_1.cosineSimilarity)(queryVec, vec);
                sims.push({ id: row.id, score: sim });
            }
            sims.sort((a, b) => b.score - a.score);
            return sims.slice(0, topK);
        }
    }
    async getVector(id, sector, tenant_id) {
        const sql = `SELECT v, dim FROM ${this.table} WHERE tenant_id = $1 AND id = $2 AND sector = $3`;
        const row = await this.db.get_async(sql, [tenant_id, id, sector]);
        if (!row)
            return null;
        return { vector: (0, embed_1.bufferToVector)(row.v), dim: row.dim };
    }
    async getVectorsById(id, tenant_id) {
        const rows = await this.db.all_async(`SELECT sector, v, dim FROM ${this.table} WHERE tenant_id = $1 AND id = $2`, [tenant_id, id]);
        return rows.map(row => ({
            sector: row.sector,
            vector: (0, embed_1.bufferToVector)(row.v),
            dim: row.dim
        }));
    }
    async getVectorsBySector(sector, tenant_id) {
        const rows = await this.db.all_async(`SELECT id, v, dim FROM ${this.table} WHERE tenant_id = $1 AND sector = $2`, [tenant_id, sector]);
        return rows.map(row => ({
            id: row.id,
            vector: (0, embed_1.bufferToVector)(row.v),
            dim: row.dim
        }));
    }
}
exports.PostgresVectorStore = PostgresVectorStore;
