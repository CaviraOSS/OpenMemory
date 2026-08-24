import { v5 as uuidv5 } from "uuid";
import { QdrantClient } from "@qdrant/js-client-rest";
import { VectorStore } from "../vector_store";
import { env } from "../cfg";

// uuid.NAMESPACE_DNS on the Python side.
const NAMESPACE_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

const KNOWN_SECTORS = [
    "episodic",
    "semantic",
    "procedural",
    "emotional",
    "reflective",
    "_mean",
];

const pointIdToMemId = (pointId: string): string =>
    pointId.includes(":") ? pointId.split(":").pop()! : pointId;

export interface QdrantVectorStoreOptions {
    url?: string;
    apiKey?: string;
    collectionPrefix?: string;
}

export class QdrantVectorStore implements VectorStore {
    private client: QdrantClient;
    private collectionPrefix: string;
    private collectionInitialized: Set<string> = new Set();

    constructor(opts: QdrantVectorStoreOptions = {}) {
        this.client = new QdrantClient({
            url: opts.url || env.qdrant_url,
            apiKey: opts.apiKey || env.qdrant_api_key || undefined,
        });
        this.collectionPrefix =
            opts.collectionPrefix ?? env.qdrantCollectionPrefix;
    }

    private colName(sector: string): string {
        return `${this.collectionPrefix}${sector}`;
    }

    private pointId(id: string, sector: string): string {
        return uuidv5(`openmemory/${sector}:${id}`, NAMESPACE_DNS);
    }

    private async ensureCollection(sector: string): Promise<void> {
        const name = this.colName(sector);
        if (this.collectionInitialized.has(name)) return;
        if (!(await this.collectionExists(name))) {
            try {
                await this.client.createCollection(name, {
                    vectors: {
                        size: env.vec_dim,
                        distance: "Cosine",
                    },
                });
                for (const field of ["user_id", "project_id", "sector"]) {
                    await this.client
                        .createPayloadIndex(name, {
                            field_name: field,
                            field_schema: "keyword",
                        })
                        .catch((e) =>
                            console.error(
                                `[Qdrant] Payload index ${field} on ${name} failed: ${e}`,
                            ),
                        );
                }
                console.error(`[Qdrant] Created collection ${name}`);
            } catch (e) {
                if (!(await this.collectionExists(name))) throw e;
            }
        }
        this.collectionInitialized.add(name);
    }

    async storeVector(
        id: string,
        sector: string,
        vector: number[],
        dim: number,
        user_id?: string,
        project_id?: string,
    ): Promise<void> {
        await this.ensureCollection(sector);
        await this.client.upsert(this.colName(sector), {
            wait: true,
            points: [
                {
                    id: this.pointId(id, sector),
                    vector,
                    payload: {
                        user_id: user_id || "anonymous",
                        ...(project_id ? { project_id } : {}),
                        dim,
                        sector,
                        memory_id: id,
                    },
                },
            ],
        });
    }

    async deleteVector(id: string, sector: string): Promise<void> {
        const name = this.colName(sector);
        if (!(await this.collectionExists(name))) return;
        await this.client.delete(name, {
            wait: true,
            points: [this.pointId(id, sector)],
        });
    }

    async deleteVectors(id: string): Promise<void> {
        for (const sector of KNOWN_SECTORS) {
            if (await this.collectionExists(this.colName(sector))) {
                await this.client.delete(this.colName(sector), {
                    wait: true,
                    points: [this.pointId(id, sector)],
                });
            }
        }
    }

    async searchSimilar(
        sector: string,
        queryVec: number[],
        topK: number,
        user_id?: string,
        project_id?: string,
    ): Promise<Array<{ id: string; score: number }>> {
        const name = this.colName(sector);
        if (!this.collectionInitialized.has(name)) {
            if (!(await this.collectionExists(name))) return [];
            this.collectionInitialized.add(name);
        }
        let filter: any;
        if (user_id || project_id) {
            filter = {};
            if (user_id) {
                filter.must = [{ key: "user_id", match: { value: user_id } }];
            }
            if (project_id) {
                filter.min_should = {
                    conditions: [
                        { key: "project_id", match: { value: project_id } },
                        {
                            key: "project_id",
                            match: { value: "system_global" },
                        },
                        { key: "project_id", is_empty: true },
                    ],
                    min_count: 1,
                };
            }
        }
        const res = await this.client.query(name, {
            query: queryVec,
            limit: topK,
            with_payload: true,
            filter,
        });
        const out: Array<{ id: string; score: number }> = [];
        for (const p of res.points) {
            const memId =
                p.payload && typeof (p.payload as any).memory_id === "string"
                    ? (p.payload as any).memory_id
                    : pointIdToMemId(String(p.id));
            out.push({ id: memId, score: p.score });
        }
        return out;
    }

    async getVector(
        id: string,
        sector: string,
    ): Promise<{ vector: number[]; dim: number } | null> {
        const name = this.colName(sector);
        if (!(await this.collectionExists(name))) return null;
        const res = await this.client.retrieve(name, {
            ids: [this.pointId(id, sector)],
            with_payload: true,
            with_vector: true,
        });
        const p = res[0];
        if (!p) return null;
        const vec = Array.isArray(p.vector)
            ? p.vector
            : Array.isArray((p.vector as any)?.[0])
              ? ((p.vector as any)[0] as number[])
              : [];
        const dim =
            p.payload && typeof (p.payload as any).dim === "number"
                ? (p.payload as any).dim
                : vec.length;
        return { vector: vec as number[], dim };
    }

    async getVectorsById(
        id: string,
    ): Promise<Array<{ sector: string; vector: number[]; dim: number }>> {
        const out: Array<{
            sector: string;
            vector: number[];
            dim: number;
        }> = [];
        for (const sector of KNOWN_SECTORS) {
            const v = await this.getVector(id, sector);
            if (v) out.push({ sector, ...v });
        }
        return out;
    }

    async getVectorsBySector(
        sector: string,
    ): Promise<Array<{ id: string; vector: number[]; dim: number }>> {
        const name = this.colName(sector);
        if (!this.collectionInitialized.has(name)) {
            if (!(await this.collectionExists(name))) return [];
            this.collectionInitialized.add(name);
        }
        const out: Array<{ id: string; vector: number[]; dim: number }> = [];
        let offset: any;
        do {
            const page = await this.client.scroll(name, {
                limit: 1000,
                offset: offset as any,
                with_payload: true,
                with_vector: true,
            });
            for (const p of page.points) {
                const payload = p.payload as any;
                if (typeof payload?.memory_id !== "string") {
                    continue;
                }
                const vec = Array.isArray(p.vector)
                    ? p.vector
                    : Array.isArray((p.vector as any)?.[0])
                      ? ((p.vector as any)[0] as number[])
                      : [];
                out.push({
                    id: payload.memory_id,
                    vector: vec as number[],
                    dim:
                        typeof payload.dim === "number"
                            ? payload.dim
                            : vec.length,
                });
            }
            offset = page.next_page_offset;
        } while (offset);
        return out;
    }

    private async collectionExists(name: string): Promise<boolean> {
        const res = await this.client.collectionExists(name);
        return res.exists;
    }
}
