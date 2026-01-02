import { VectorStore } from "../vector_store";
import Redis from "ioredis";
import { env } from "../cfg";
import { vectorToBuffer, bufferToVector } from "../../memory/embed";

/**
 * ValkeyVectorStore with multi-tenant support
 *
 * Key structure: vec:{tenant_id}:{sector}:{id}
 * Index structure: idx:{tenant_id}:{sector}
 *
 * Features:
 * - Tenant isolation via key prefixing
 * - FT.SEARCH with KNN for fast vector similarity
 * - Fallback to scan+cosine for missing indexes
 */
export class ValkeyVectorStore implements VectorStore {
    private client: Redis;

    constructor() {
        this.client = new Redis({
            host: env.valkey_host || "localhost",
            port: env.valkey_port || 6379,
            password: env.valkey_password,
        });
    }

    private getKey(id: string, sector: string, tenant_id: string): string {
        return `vec:${tenant_id}:${sector}:${id}`;
    }

    async storeVector(id: string, sector: string, vector: number[], dim: number, tenant_id: string, user_id?: string): Promise<void> {
        const key = this.getKey(id, sector, tenant_id);
        const buf = vectorToBuffer(vector);
        // Store as Hash: v (blob), dim (int), user_id (string), tenant_id (string)
        await this.client.hset(key, {
            v: buf,
            dim: dim,
            user_id: user_id || "anonymous",
            tenant_id: tenant_id,
            id: id,
            sector: sector
        });
    }

    async deleteVector(id: string, sector: string, tenant_id: string): Promise<void> {
        const key = this.getKey(id, sector, tenant_id);
        await this.client.del(key);
    }

    async deleteVectors(id: string, tenant_id: string): Promise<void> {
        // Scan for all vectors belonging to this ID within the tenant
        // Pattern: vec:{tenant_id}:*:{id}
        let cursor = "0";
        do {
            const res = await this.client.scan(cursor, "MATCH", `vec:${tenant_id}:*:${id}`, "COUNT", 100);
            cursor = res[0];
            const keys = res[1];
            if (keys.length) await this.client.del(...keys);
        } while (cursor !== "0");
    }

    async searchSimilar(sector: string, queryVec: number[], topK: number, tenant_id: string): Promise<Array<{ id: string; score: number }>> {
        // Try to use FT.SEARCH if index exists.
        // Index name: idx:{tenant_id}:{sector}
        // Query: `*=>[KNN {k} @v $blob AS score]`
        const indexName = `idx:${tenant_id}:${sector}`;
        const blob = vectorToBuffer(queryVec);

        try {
            // FT.SEARCH idx:tenant:sector "*=>[KNN 10 @v $blob AS score]" PARAMS 2 blob "\x..." DIALECT 2
            const res = await this.client.call(
                "FT.SEARCH",
                indexName,
                `*=>[KNN ${topK} @v $blob AS score]`,
                "PARAMS",
                "2",
                "blob",
                blob,
                "DIALECT",
                "2"
            ) as any[];

            // Parse result
            // [total_results, key1, [field1, val1, ...], key2, ...]
            const results: Array<{ id: string; score: number }> = [];
            for (let i = 1; i < res.length; i += 2) {
                const key = res[i] as string; // e.g. vec:tenant123:semantic:mem456
                const fields = res[i + 1] as any[];
                let id = "";
                let dist = 0;

                // Parse fields array [k, v, k, v...]
                for (let j = 0; j < fields.length; j += 2) {
                    if (fields[j] === "id") id = fields[j + 1];
                    if (fields[j] === "score") dist = parseFloat(fields[j + 1]);
                }

                // Extract ID from key if not in fields
                if (!id) id = key.split(":").pop()!;

                // Convert distance to similarity
                // Cosine distance: 0 = identical, 2 = opposite
                // Similarity: 1 - (distance / 2)
                results.push({ id, score: 1 - (dist / 2) });
            }

            console.error(`[Valkey] FT.SEARCH - Tenant: ${tenant_id}, Sector: ${sector}, Found ${results.length} results`);
            return results;

        } catch (e) {
            console.warn(`[Valkey] FT.SEARCH failed for tenant ${tenant_id}, sector ${sector}, falling back to scan (slow):`, e);

            // Fallback: Scan all vectors in tenant+sector and compute cosine sim
            // Pattern: vec:{tenant_id}:{sector}:*
            let cursor = "0";
            const allVecs: Array<{ id: string; vector: number[] }> = [];

            do {
                const res = await this.client.scan(cursor, "MATCH", `vec:${tenant_id}:${sector}:*`, "COUNT", 100);
                cursor = res[0];
                const keys = res[1];

                if (keys.length) {
                    // Pipeline get all vectors
                    const pipe = this.client.pipeline();
                    keys.forEach(k => pipe.hget(k, "v"));
                    const buffers = await pipe.exec();

                    buffers?.forEach((b, idx) => {
                        if (b && b[1]) {
                            const buf = b[1] as Buffer;
                            const id = keys[idx].split(":").pop()!;
                            allVecs.push({ id, vector: bufferToVector(buf) });
                        }
                    });
                }
            } while (cursor !== "0");

            const sims = allVecs.map(v => ({
                id: v.id,
                score: this.cosineSimilarity(queryVec, v.vector)
            }));
            sims.sort((a, b) => b.score - a.score);
            return sims.slice(0, topK);
        }
    }

    private cosineSimilarity(a: number[], b: number[]) {
        if (a.length !== b.length) return 0;
        let dot = 0, na = 0, nb = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }
        return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
    }

    async getVector(id: string, sector: string, tenant_id: string): Promise<{ vector: number[]; dim: number } | null> {
        const key = this.getKey(id, sector, tenant_id);
        const res = await this.client.hmget(key, "v", "dim");
        if (!res[0]) return null;
        return {
            vector: bufferToVector(res[0] as unknown as Buffer),
            dim: parseInt(res[1] as string)
        };
    }

    async getVectorsById(id: string, tenant_id: string): Promise<Array<{ sector: string; vector: number[]; dim: number }>> {
        // Scan for vec:{tenant_id}:*:{id}
        const results: Array<{ sector: string; vector: number[]; dim: number }> = [];
        let cursor = "0";

        do {
            const res = await this.client.scan(cursor, "MATCH", `vec:${tenant_id}:*:${id}`, "COUNT", 100);
            cursor = res[0];
            const keys = res[1];

            if (keys.length) {
                const pipe = this.client.pipeline();
                keys.forEach(k => pipe.hmget(k, "v", "dim"));
                const res = await pipe.exec();

                res?.forEach((r, idx) => {
                    if (r && r[1]) {
                        const [v, dim] = r[1] as [Buffer, string];
                        const key = keys[idx];
                        const parts = key.split(":");
                        const sector = parts[2]; // vec:{tenant}:{sector}:{id}
                        results.push({
                            sector,
                            vector: bufferToVector(v),
                            dim: parseInt(dim)
                        });
                    }
                });
            }
        } while (cursor !== "0");
        return results;
    }

    async getVectorsBySector(sector: string, tenant_id: string): Promise<Array<{ id: string; vector: number[]; dim: number }>> {
        const results: Array<{ id: string; vector: number[]; dim: number }> = [];
        let cursor = "0";

        do {
            const res = await this.client.scan(cursor, "MATCH", `vec:${tenant_id}:${sector}:*`, "COUNT", 100);
            cursor = res[0];
            const keys = res[1];

            if (keys.length) {
                const pipe = this.client.pipeline();
                keys.forEach(k => pipe.hmget(k, "v", "dim"));
                const res = await pipe.exec();

                res?.forEach((r, idx) => {
                    if (r && r[1]) {
                        const [v, dim] = r[1] as [Buffer, string];
                        const key = keys[idx];
                        const id = key.split(":").pop()!;
                        results.push({
                            id,
                            vector: bufferToVector(v),
                            dim: parseInt(dim)
                        });
                    }
                });
            }
        } while (cursor !== "0");
        return results;
    }
}
