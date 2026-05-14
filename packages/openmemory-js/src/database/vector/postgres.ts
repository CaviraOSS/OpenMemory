import { VectorStore } from "../../services/vectorStore";
import {
  bufferToVector,
  vectorToBuffer,
  cosineSimilarity,
} from "../../retention/embed";

export interface DbOps {
  run_async: (sql: string, params?: any[]) => Promise<void>;
  get_async: (sql: string, params?: any[]) => Promise<any>;
  all_async: (sql: string, params?: any[]) => Promise<any[]>;
}

export class PostgresVectorStore implements VectorStore {
  private table: string;
  private usePgVector: boolean;

  constructor(
    private db: DbOps,
    tableName: string = "vectors",
    usePgVector: boolean = false,
  ) {
    this.table = tableName;
    this.usePgVector = usePgVector;
    console.error(
      `[PostgresVectorStore] mode: ${usePgVector ? "pgvector (native)" : "sqlite (compat)"}`,
    );
  }

  async storeVector(
    id: string,
    sector: string,
    vector: number[],
    dim: number,
    userId?: string,
    projectId?: string,
  ): Promise<void> {
    console.error(`[Vector] Storing ID: ${id}, Sector: ${sector}, Dim: ${dim}`);
    if (this.usePgVector) {
      const vectorJson = JSON.stringify(vector);
      const sql = `insert into ${this.table}(id,sector,user_id,project_id,v,dim) values($1,$2,$3,$4,$5::vector,$6) on conflict(id,sector) do update set user_id=excluded.user_id,project_id=excluded.project_id,v=excluded.v,dim=excluded.dim`;
      await this.db.run_async(sql, [
        id,
        sector,
        userId || "anonymous",
        projectId || null,
        vectorJson,
        dim,
      ]);
    } else {
      const vectorBuffer = vectorToBuffer(vector);
      const sql = `insert into ${this.table}(id,sector,user_id,project_id,v,dim) values($1,$2,$3,$4,$5,$6) on conflict(id,sector) do update set user_id=excluded.user_id,project_id=excluded.project_id,v=excluded.v,dim=excluded.dim`;
      await this.db.run_async(sql, [
        id,
        sector,
        userId || "anonymous",
        projectId || null,
        vectorBuffer,
        dim,
      ]);
    }
  }

  async deleteVector(id: string, sector: string): Promise<void> {
    await this.db.run_async(
      `delete from ${this.table} where id=$1 and sector=$2`,
      [id, sector],
    );
  }

  async deleteVectors(id: string): Promise<void> {
    await this.db.run_async(`delete from ${this.table} where id=$1`, [id]);
  }

  async searchSimilar(
    sector: string,
    queryVec: number[],
    topK: number,
    userId?: string,
    projectId?: string,
  ): Promise<Array<{ id: string; score: number }>> {
    if (this.usePgVector) {
      const vectorJson = JSON.stringify(queryVec);
      let filterSql = "where sector = $2";
      const args: any[] = [vectorJson, sector, topK];

      if (userId) {
        filterSql += ` and user_id = $${args.length + 1}`;
        args.push(userId);
      }

      if (projectId) {
        filterSql += ` and (project_id = $${args.length + 1} or project_id = 'system_global' or project_id IS NULL)`;
        args.push(projectId);
      }

      const sql = `
                select id, 1 - (v <=> $1::vector) as similarity
                from ${this.table}
                ${filterSql}
                order by v <=> $1::vector
                limit $3
            `;
      const rows = await this.db.all_async(sql, args);
      console.error(
        `[Vector] pgvector search in sector: ${sector}${userId ? `, user: ${userId}` : ""}${projectId ? `, project: ${projectId}` : ""}, returned ${rows.length} results`,
      );
      return rows.map((r) => ({ id: r.id, score: r.similarity }));
    } else {
      let filterSql = "where sector=$1";
      const args: any[] = [sector];

      if (userId) {
        filterSql += ` and user_id=$${args.length + 1}`;
        args.push(userId);
      }

      if (projectId) {
        filterSql += ` and (project_id=$${args.length + 1} or project_id='system_global' or project_id IS NULL)`;
        args.push(projectId);
      }

      const rows = await this.db.all_async(
        `select id,v,dim from ${this.table} ${filterSql}`,
        args,
      );
      console.error(
        `[Vector] sqlite-compat search in sector: ${sector}${userId ? `, user: ${userId}` : ""}${projectId ? `, project: ${projectId}` : ""}, found ${rows.length} rows`,
      );
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

  async getVector(
    id: string,
    sector: string,
  ): Promise<{ vector: number[]; dim: number } | null> {
    if (this.usePgVector) {
      const row = await this.db.get_async(
        `select v::text as v_txt,dim from ${this.table} where id=$1 and sector=$2`,
        [id, sector],
      );
      if (!row) return null;
      return { vector: JSON.parse(row.v_txt), dim: row.dim };
    } else {
      const row = await this.db.get_async(
        `select v,dim from ${this.table} where id=$1 and sector=$2`,
        [id, sector],
      );
      if (!row) return null;
      return { vector: bufferToVector(row.v), dim: row.dim };
    }
  }

  async getVectorsById(
    id: string,
  ): Promise<Array<{ sector: string; vector: number[]; dim: number }>> {
    if (this.usePgVector) {
      const rows = await this.db.all_async(
        `select sector,v::text as v_txt,dim from ${this.table} where id=$1`,
        [id],
      );
      return rows.map((row) => ({
        sector: row.sector,
        vector: JSON.parse(row.v_txt),
        dim: row.dim,
      }));
    } else {
      const rows = await this.db.all_async(
        `select sector,v,dim from ${this.table} where id=$1`,
        [id],
      );
      return rows.map((row) => ({
        sector: row.sector,
        vector: bufferToVector(row.v),
        dim: row.dim,
      }));
    }
  }

  async getVectorsBySector(
    sector: string,
  ): Promise<Array<{ id: string; vector: number[]; dim: number }>> {
    if (this.usePgVector) {
      const rows = await this.db.all_async(
        `select id,v::text as v_txt,dim from ${this.table} where sector=$1`,
        [sector],
      );
      return rows.map((row) => ({
        id: row.id,
        vector: JSON.parse(row.v_txt),
        dim: row.dim,
      }));
    } else {
      const rows = await this.db.all_async(
        `select id,v,dim from ${this.table} where sector=$1`,
        [sector],
      );
      return rows.map((row) => ({
        id: row.id,
        vector: bufferToVector(row.v),
        dim: row.dim,
      }));
    }
  }
}
