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















        let cursor = "0";
        do {
            const res = await this.client.scan(cursor, "MATCH", `vec:*:${id}`, "COUNT", 100);
            cursor = res[0];
            const keys = res[1];
            if (keys.length) await this.client.del(...keys);
        } while (cursor !== "0");
    }

    async searchSimilar(sector: string, queryVec: number[], topK: number): Promise<Array<{ id: string; score: number }>> {



        const indexName = `idx:${sector}`;
        const blob = vectorToBuffer(queryVec);

        try {



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




            const count = res[0];
            const results: Array<{ id: string; score: number }> = [];
            for (let i = 1; i < res.length; i += 2) {
                const key = res[i] as string;
                const fields = res[i + 1] as any[];
                let id = "";
                let score = 0;

                for (let j = 0; j < fields.length; j += 2) {
                    const f = fields[j];
                    const v = fields[j + 1];
                    if (f === "id") id = v;
                    if (f === "score") score = 1 - (parseFloat(v) / 2);





                }

                if (!id) {
                    const parts = key.split(":");
                    id = parts[parts.length - 1];
                }













                results.push({ id, score: 1 - parseFloat(fields.find((f: any, idx: number) => f === "score" && idx % 2 === 0 ? false : fields[idx - 1] === "score") || "0") });


            }


            results.length = 0;
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


            let cursor = "0";
            const allVecs: Array<{ id: string; vector: number[] }> = [];
            do {
                const res = await this.client.scan(cursor, "MATCH", `vec:${sector}:*`, "COUNT", 100);
                cursor = res[0];
                const keys = res[1];
                if (keys.length) {

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
