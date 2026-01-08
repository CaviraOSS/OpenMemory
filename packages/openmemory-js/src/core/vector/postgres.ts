import { VectorStore } from "../vector_store";
import { cosineSimilarity, bufferToVector, vectorToBuffer } from "../../memory/embed";

export interface DbOps {
    run_async: (sql: string, params?: any[]) => Promise<void>;
    get_async: (sql: string, params?: any[]) => Promise<any>;
    all_async: (sql: string, params?: any[]) => Promise<any[]>;
}

export class PostgresVectorStore implements VectorStore {
    private table: string;

    constructor(private db: DbOps, tableName: string = "vectors") {
        this.table = tableName;
    }

    async storeVector(id: string, sector: string, vector: number[], dim: number, user_id?: string): Promise<void> {
        console.error(`[Vector] Storing ID: ${id}, Sector: ${sector}, Dim: ${dim}`);
        const v = vectorToBuffer(vector);
        const sql = `insert into ${this.table}(id,sector,user_id,v,dim) values($1,$2,$3,$4,$5) on conflict(id,sector) do update set user_id=excluded.user_id,v=excluded.v,dim=excluded.dim`;
        await this.db.run_async(sql, [id, sector, user_id || "anonymous", v, dim]);
    }

    async deleteVector(id: string, sector: string): Promise<void> {
        await this.db.run_async(`delete from ${this.table} where id=$1 and sector=$2`, [id, sector]);
    }

    async deleteVectors(id: string): Promise<void> {
        await this.db.run_async(`delete from ${this.table} where id=$1`, [id]);
    }

    async searchSimilar(sector: string, queryVec: number[], topK: number): Promise<Array<{ id: string; score: number }>> {

        const rows = await this.db.all_async(`select id,v,dim from ${this.table} where sector=$1`, [sector]);
        console.error(`[Vector] Search Sector: ${sector}, Found ${rows.length} rows.`);
        const sims: Array<{ id: string; score: number }> = [];
        for (const row of rows) {
            const vec = bufferToVector(row.v);
            const sim = cosineSimilarity(queryVec, vec);
            sims.push({ id: row.id, score: sim });
        }
        sims.sort((a, b) => b.score - a.score);
        return sims.slice(0, topK);
    }

    async getVector(id: string, sector: string): Promise<{ vector: number[]; dim: number } | null> {
        const row = await this.db.get_async(`select v,dim from ${this.table} where id=$1 and sector=$2`, [id, sector]);
        if (!row) return null;
        return { vector: bufferToVector(row.v), dim: row.dim };
    }

    async getVectorsById(id: string): Promise<Array<{ sector: string; vector: number[]; dim: number }>> {
        const rows = await this.db.all_async(`select sector,v,dim from ${this.table} where id=$1`, [id]);
        return rows.map(row => ({ sector: row.sector, vector: bufferToVector(row.v), dim: row.dim }));
    }

    async getVectorsBySector(sector: string): Promise<Array<{ id: string; vector: number[]; dim: number }>> {
        const rows = await this.db.all_async(`select id,v,dim from ${this.table} where sector=$1`, [sector]);
        return rows.map(row => ({ id: row.id, vector: bufferToVector(row.v), dim: row.dim }));
    }
}
