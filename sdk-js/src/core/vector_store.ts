import { cosineSimilarity, bufferToVector, vectorToBuffer } from "../memory/embed";

export interface VectorStore {
    storeVector(id: string, sector: string, vector: number[], dim: number, user_id?: string): Promise<void>;
    deleteVector(id: string, sector: string): Promise<void>;
    deleteVectors(id: string): Promise<void>;
    searchSimilar(sector: string, queryVec: number[], topK: number): Promise<Array<{ id: string; score: number }>>;
    getVector(id: string, sector: string): Promise<{ vector: number[]; dim: number } | null>;
    getVectorsById(id: string): Promise<Array<{ sector: string; vector: number[]; dim: number }>>;
    getVectorsBySector(sector: string): Promise<Array<{ id: string; vector: number[]; dim: number }>>;
}

export interface DbOps {
    run_async: (sql: string, params?: any[]) => Promise<void>;
    get_async: (sql: string, params?: any[]) => Promise<any>;
    all_async: (sql: string, params?: any[]) => Promise<any[]>;
}

export class SQLiteVectorStore implements VectorStore {
    private table: string;

    constructor(private db: DbOps, tableName: string = "vectors") {
        this.table = tableName;
    }

    async storeVector(id: string, sector: string, vector: number[], dim: number, user_id?: string): Promise<void> {
        const v = vectorToBuffer(vector);
        // SQLite: insert or replace. 
        // Logic mirrors backend PostgresVectorStore but explicitly compatible with SQLite syntax
        const sql = `insert or replace into ${this.table}(id,sector,user_id,v,dim) values(?,?,?,?,?)`;
        await this.db.run_async(sql, [id, sector, user_id || "anonymous", v, dim]);
    }

    async deleteVector(id: string, sector: string): Promise<void> {
        await this.db.run_async(`delete from ${this.table} where id=? and sector=?`, [id, sector]);
    }

    async deleteVectors(id: string): Promise<void> {
        await this.db.run_async(`delete from ${this.table} where id=?`, [id]);
    }

    async searchSimilar(sector: string, queryVec: number[], topK: number): Promise<Array<{ id: string; score: number }>> {
        // In-memory cosine similarity for SQLite (since no native vector extension assumed)
        const rows = await this.db.all_async(`select id,v,dim from ${this.table} where sector=?`, [sector]);
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
        const row = await this.db.get_async(`select v,dim from ${this.table} where id=? and sector=?`, [id, sector]);
        if (!row) return null;
        return { vector: bufferToVector(row.v), dim: row.dim };
    }

    async getVectorsById(id: string): Promise<Array<{ sector: string; vector: number[]; dim: number }>> {
        const rows = await this.db.all_async(`select sector,v,dim from ${this.table} where id=?`, [id]);
        return rows.map(row => ({ sector: row.sector, vector: bufferToVector(row.v), dim: row.dim }));
    }

    async getVectorsBySector(sector: string): Promise<Array<{ id: string; vector: number[]; dim: number }>> {
        const rows = await this.db.all_async(`select id,v,dim from ${this.table} where sector=?`, [sector]);
        return rows.map(row => ({ id: row.id, vector: bufferToVector(row.v), dim: row.dim }));
    }
}
