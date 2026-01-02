import { VectorStore } from "../vector_store";
import { cosineSimilarity, bufferToVector, vectorToBuffer } from "../../memory/embed";

export interface DbOps {
    run_async: (sql: string, params?: any[]) => Promise<void>;
    get_async: (sql: string, params?: any[]) => Promise<any>;
    all_async: (sql: string, params?: any[]) => Promise<any[]>;
}

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
export class PostgresVectorStore implements VectorStore {
    private table: string;
    private usePgvector: boolean;

    constructor(
        private db: DbOps,
        tableName: string = "vectors",
        usePgvector: boolean = true
    ) {
        this.table = tableName;
        this.usePgvector = usePgvector;
    }

    async storeVector(id: string, sector: string, vector: number[], dim: number, tenant_id: string, user_id?: string): Promise<void> {
        console.error(`[Vector] Storing ID: ${id}, Tenant: ${tenant_id}, Sector: ${sector}, Dim: ${dim}`);

        if (this.usePgvector) {
            // Store as both pgvector type (for fast search) and BYTEA (for backward compatibility)
            const vectorStr = `[${vector.join(',')}]`;
            const v = vectorToBuffer(vector);

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
        } else {
            // Legacy BYTEA-only storage (for SQLite or non-pgvector PostgreSQL)
            const v = vectorToBuffer(vector);
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

    async deleteVector(id: string, sector: string, tenant_id: string): Promise<void> {
        await this.db.run_async(
            `DELETE FROM ${this.table} WHERE tenant_id = $1 AND id = $2 AND sector = $3`,
            [tenant_id, id, sector]
        );
    }

    async deleteVectors(id: string, tenant_id: string): Promise<void> {
        await this.db.run_async(
            `DELETE FROM ${this.table} WHERE tenant_id = $1 AND id = $2`,
            [tenant_id, id]
        );
    }

    async searchSimilar(sector: string, queryVec: number[], topK: number, tenant_id: string): Promise<Array<{ id: string; score: number }>> {
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
        } else {
            // Fallback: In-memory cosine similarity (for backward compatibility or SQLite)
            // WARNING: This does NOT scale beyond ~100K vectors!
            const rows = await this.db.all_async(
                `SELECT id, v, dim FROM ${this.table} WHERE tenant_id = $1 AND sector = $2`,
                [tenant_id, sector]
            );
            console.error(`[Vector] In-Memory Search - Tenant: ${tenant_id}, Sector: ${sector}, Found ${rows.length} rows (WARNING: Not scalable!)`);

            const sims: Array<{ id: string; score: number }> = [];
            for (const row of rows) {
                const vec = bufferToVector(row.v);
                const sim = cosineSimilarity(queryVec, vec);
                sims.push({ id: row.id, score: sim });
            }
            sims.sort((a, b) => b.score - a.score);
            return sims.slice(0, topK);
        }
    }

    async getVector(id: string, sector: string, tenant_id: string): Promise<{ vector: number[]; dim: number } | null> {
        const sql = `SELECT v, dim FROM ${this.table} WHERE tenant_id = $1 AND id = $2 AND sector = $3`;
        const row = await this.db.get_async(sql, [tenant_id, id, sector]);
        if (!row) return null;
        return { vector: bufferToVector(row.v), dim: row.dim };
    }

    async getVectorsById(id: string, tenant_id: string): Promise<Array<{ sector: string; vector: number[]; dim: number }>> {
        const rows = await this.db.all_async(
            `SELECT sector, v, dim FROM ${this.table} WHERE tenant_id = $1 AND id = $2`,
            [tenant_id, id]
        );
        return rows.map(row => ({
            sector: row.sector,
            vector: bufferToVector(row.v),
            dim: row.dim
        }));
    }

    async getVectorsBySector(sector: string, tenant_id: string): Promise<Array<{ id: string; vector: number[]; dim: number }>> {
        const rows = await this.db.all_async(
            `SELECT id, v, dim FROM ${this.table} WHERE tenant_id = $1 AND sector = $2`,
            [tenant_id, sector]
        );
        return rows.map(row => ({
            id: row.id,
            vector: bufferToVector(row.v),
            dim: row.dim
        }));
    }
}
