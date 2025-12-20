import { VectorStore } from "../vector_store";
import Redis from "ioredis";
import { env } from "../cfg";
import { vectorToBuffer, bufferToVector } from "../../memory/embed";

export class ValkeyVectorStore implements VectorStore {
    private client: Redis;

    constructor() {
        this.client = new Redis({
            host: env.valkey_host || "localhost",
            port: env.valkey_port || 6379,
            password: env.valkey_password,
        });
    }

    private getKey(id: string, sector: string): string {
        return `vec:${sector}:${id}`;
    }

    async storeVector(id: string, sector: string, vector: number[], dim: number, user_id?: string): Promise<void> {
        const key = this.getKey(id, sector);
        const buf = vectorToBuffer(vector);
        // Store as Hash: v (blob), dim (int), user_id (string)
        await this.client.hset(key, {
            v: buf,
            dim: dim,
            user_id: user_id || "anonymous",
            id: id,
            sector: sector
        });
    }

    async deleteVector(id: string, sector: string): Promise<void> {
        const key = this.getKey(id, sector);
        await this.client.del(key);
    }

    async deleteVectors(id: string): Promise<void> {
        // This is inefficient in Redis without an index on ID across sectors.
        // We might need to track which sectors an ID has.
        // For now, we can scan or just assume we know the sectors?
        // The interface implies we delete ALL vectors for this ID.
        // In Postgres we did `delete from vectors where id=$1`.
        // In Redis, we might need to know the sectors.
        // Or we can use `keys vec:*:${id}` which is slow.
        // Better approach: maintain a set of sectors for each ID?
        // Or just iterate over known sectors (from hsg.ts sectors list).
        // I'll import `sectors` from `../../memory/hsg`? No, circular dependency risk.
        // I'll use a scan for now as it's safer, or just accept it might be slow.
        // Actually, `keys` is blocking. `scan` is better.
        // But `id` is at the end of the key `vec:{sector}:{id}`.
        // Pattern: `vec:*:${id}`.

        let cursor = "0";
        do {
            const res = await this.client.scan(cursor, "MATCH", `vec:*:${id}`, "COUNT", 100);
            cursor = res[0];
            const keys = res[1];
            if (keys.length) await this.client.del(...keys);
        } while (cursor !== "0");
    }

    async searchSimilar(sector: string, queryVec: number[], topK: number): Promise<Array<{ id: string; score: number }>> {
        // Try to use FT.SEARCH if index exists.
        // Index name assumption: `idx:{sector}`
        // Query: `*=>[KNN {k} @v $blob AS score]`
        const indexName = `idx:${sector}`;
        const blob = vectorToBuffer(queryVec);

        try {
            // Check if index exists (optional, or just try search)
            // We'll try the search.
            // FT.SEARCH idx:sector "*=>[KNN 10 @v $blob AS score]" PARAMS 2 blob "\x..." DIALECT 2
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
            // We need to parse the array.
            const count = res[0];
            const results: Array<{ id: string; score: number }> = [];
            for (let i = 1; i < res.length; i += 2) {
                const key = res[i] as string; // e.g. vec:semantic:123
                const fields = res[i + 1] as any[];
                let id = "";
                let score = 0;
                // fields is array [k, v, k, v...]
                for (let j = 0; j < fields.length; j += 2) {
                    const f = fields[j];
                    const v = fields[j + 1];
                    if (f === "id") id = v;
                    if (f === "score") score = 1 - (parseFloat(v) / 2); // Cosine distance to similarity?
                    // Valkey HNSW usually returns distance.
                    // If metric is COSINE, distance is 1 - cosine_sim.
                    // So sim = 1 - dist.
                    // Wait, standard RediSearch KNN distance depends on metric.
                    // Assuming COSINE metric.
                }
                // If id not in fields, extract from key
                if (!id) {
                    const parts = key.split(":");
                    id = parts[parts.length - 1];
                }
                // If score not found (should be there as 'score'), default 0
                // Actually, 'score' is the alias we gave.
                // Wait, in FT.SEARCH response, the score is returned if we ask for it?
                // Yes, "AS score" puts it in the fields.

                // Correction: RediSearch returns distance by default for KNN?
                // Yes, but we aliased it "AS score".
                // So it should be in the fields as "score".

                // Distance conversion:
                // If distance is d, and we want cosine similarity.
                // Cosine distance = 1 - cosine similarity.
                // So similarity = 1 - distance.
                results.push({ id, score: 1 - parseFloat(fields.find((f: any, idx: number) => f === "score" && idx % 2 === 0 ? false : fields[idx - 1] === "score") || "0") });
                // The find logic above is tricky.
                // Let's just loop.
            }

            // Fix score parsing loop
            results.length = 0; // clear
            for (let i = 1; i < res.length; i += 2) {
                const key = res[i] as string;
                const fields = res[i + 1] as any[];
                let id = "";
                let dist = 0;
                for (let j = 0; j < fields.length; j += 2) {
                    if (fields[j] === "id") id = fields[j + 1];
                    if (fields[j] === "score") dist = parseFloat(fields[j + 1]);
                }
                if (!id) id = key.split(":").pop()!;
                results.push({ id, score: 1 - dist });
            }

            return results;

        } catch (e) {
            console.warn(`[Valkey] FT.SEARCH failed for ${sector}, falling back to scan (slow):`, e);
            // Fallback: Scan all vectors in sector and compute cosine sim
            // This is very slow but ensures correctness if index is missing.
            let cursor = "0";
            const allVecs: Array<{ id: string; vector: number[] }> = [];
            do {
                const res = await this.client.scan(cursor, "MATCH", `vec:${sector}:*`, "COUNT", 100);
                cursor = res[0];
                const keys = res[1];
                if (keys.length) {
                    // Pipeline get all
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

    async getVector(id: string, sector: string): Promise<{ vector: number[]; dim: number } | null> {
        const key = this.getKey(id, sector);
        const res = await this.client.hmget(key, "v", "dim");
        if (!res[0]) return null;
        return {
            vector: bufferToVector(res[0] as unknown as Buffer),
            dim: parseInt(res[1] as string)
        };
    }

    async getVectorsById(id: string): Promise<Array<{ sector: string; vector: number[]; dim: number }>> {
        // Scan for vec:*:{id}
        const results: Array<{ sector: string; vector: number[]; dim: number }> = [];
        let cursor = "0";
        do {
            const res = await this.client.scan(cursor, "MATCH", `vec:*:${id}`, "COUNT", 100);
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
                        const sector = parts[1];
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

    async getVectorsBySector(sector: string): Promise<Array<{ id: string; vector: number[]; dim: number }>> {
        const results: Array<{ id: string; vector: number[]; dim: number }> = [];
        let cursor = "0";
        do {
            const res = await this.client.scan(cursor, "MATCH", `vec:${sector}:*`, "COUNT", 100);
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
