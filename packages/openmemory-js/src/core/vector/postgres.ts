import { VectorStore } from "../vector_store";
import { bufferToVector, vectorToBuffer, cosineSimilarity } from "../../memory/embed";

export interface DbOps {
    run_async: (sql: string, params?: any[]) => Promise<void>;
    get_async: (sql: string, params?: any[]) => Promise<any>;
    all_async: (sql: string, params?: any[]) => Promise<any[]>;
}

export class PostgresVectorStore implements VectorStore {
    private table: string;
    private usePgVector: boolean;

    constructor(private db: DbOps, tableName: string = "vectors", usePgVector: boolean = false) {
        this.table = tableName;
        this.usePgVector = usePgVector;
        console.error(`[PostgresVectorStore] mode: ${usePgVector ? 'pgvector (native)' : 'sqlite (compat)'}`);
    }

    async storeVector(id: string, sector: string, vector: number[], dim: number, user_id?: string): Promise<void> {
        console.error(`[Vector] Storing ID: ${id}, Sector: ${sector}, Dim: ${dim}`);
        if (this.usePgVector) {
            const v_str = JSON.stringify(vector);
            const sql = `insert into ${this.table}(id,sector,user_id,v,dim) values($1,$2,$3,$4::vector,$5) on conflict(id,sector) do update set user_id=excluded.user_id,v=excluded.v,dim=excluded.dim`;
            await this.db.run_async(sql, [id, sector, user_id || "anonymous", v_str, dim]);
        } else {
            const v = vectorToBuffer(vector);
            const sql = `insert into ${this.table}(id,sector,user_id,v,dim) values($1,$2,$3,$4,$5) on conflict(id,sector) do update set user_id=excluded.user_id,v=excluded.v,dim=excluded.dim`;
            await this.db.run_async(sql, [id, sector, user_id || "anonymous", v, dim]);
        }
    }

    async deleteVector(id: string, sector: string): Promise<void> {
        await this.db.run_async(`delete from ${this.table} where id=$1 and sector=$2`, [id, sector]);
    }

    async deleteVectors(id: string): Promise<void> {
        await this.db.run_async(`delete from ${this.table} where id=$1`, [id]);
    }

    async searchSimilar(sector: string, queryVec: number[], topK: number, user_id?: string): Promise<Array<{ id: string; score: number }>> {
        if (this.usePgVector) {
            const v_str = JSON.stringify(queryVec);
            let filter_sql = "where sector = $2";
            const args: any[] = [v_str, sector, topK];

            if (user_id) {
                filter_sql += " and user_id = $4";
                args.push(user_id);
            }

            const sql = `
                select id, 1 - (v <=> $1::vector) as similarity
                from ${this.table}
                ${filter_sql}
                order by v <=> $1::vector
                limit $3
            `;
            const rows = await this.db.all_async(sql, args);
            console.error(`[Vector] pgvector search in sector: ${sector}${user_id ? `, user: ${user_id}` : ''}, returned ${rows.length} results`);
            return rows.map(r => ({ id: r.id, score: r.similarity }));
        } else {
            let filter_sql = "where sector=$1";
            const args: any[] = [sector];

            if (user_id) {
                filter_sql += " and user_id=$2";
                args.push(user_id);
            }

            const rows = await this.db.all_async(`select id,v,dim from ${this.table} ${filter_sql}`, args);
            console.error(`[Vector] sqlite-compat search in sector: ${sector}${user_id ? `, user: ${user_id}` : ''}, found ${rows.length} rows`);
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

    async getVector(id: string, sector: string): Promise<{ vector: number[]; dim: number } | null> {
        if (this.usePgVector) {
            const row = await this.db.get_async(`select v::text as v_txt,dim from ${this.table} where id=$1 and sector=$2`, [id, sector]);
            if (!row) return null;
            return { vector: JSON.parse(row.v_txt), dim: row.dim };
        } else {
            const row = await this.db.get_async(`select v,dim from ${this.table} where id=$1 and sector=$2`, [id, sector]);
            if (!row) return null;
            return { vector: bufferToVector(row.v), dim: row.dim };
        }
    }

    async getVectorsById(id: string): Promise<Array<{ sector: string; vector: number[]; dim: number }>> {
        if (this.usePgVector) {
            const rows = await this.db.all_async(`select sector,v::text as v_txt,dim from ${this.table} where id=$1`, [id]);
            return rows.map(row => ({ sector: row.sector, vector: JSON.parse(row.v_txt), dim: row.dim }));
        } else {
            const rows = await this.db.all_async(`select sector,v,dim from ${this.table} where id=$1`, [id]);
            return rows.map(row => ({ sector: row.sector, vector: bufferToVector(row.v), dim: row.dim }));
        }
    }

    async getVectorsBySector(sector: string): Promise<Array<{ id: string; vector: number[]; dim: number }>> {
        if (this.usePgVector) {
            const rows = await this.db.all_async(`select id,v::text as v_txt,dim from ${this.table} where sector=$1`, [sector]);
            return rows.map(row => ({ id: row.id, vector: JSON.parse(row.v_txt), dim: row.dim }));
        } else {
            const rows = await this.db.all_async(`select id,v,dim from ${this.table} where sector=$1`, [sector]);
            return rows.map(row => ({ id: row.id, vector: bufferToVector(row.v), dim: row.dim }));
        }
    }
}
