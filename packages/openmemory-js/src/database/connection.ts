import { Pool } from "pg";
import type { PoolClient } from "pg";
import { buildPgPoolConfig } from "./pgConfig";

const pool = new Pool(buildPgPoolConfig(process.env.OM_PG_DB || "openmemory"));
let transactionClient: PoolClient | null = null;

const query = async (sql: string, params: any[] = []) => {
  const client = transactionClient || pool;
  return await client.query(sql, params);
};

export const run_async = async (
  sql: string,
  params: any[] = [],
): Promise<void> => {
  await query(sql, params);
};

export const get_async = async (
  sql: string,
  params: any[] = [],
): Promise<any> => (await query(sql, params)).rows[0];

export const all_async = async (
  sql: string,
  params: any[] = [],
): Promise<any[]> => (await query(sql, params)).rows;

export const transaction = {
  begin: async () => {
    if (transactionClient) throw new Error("transaction active");
    transactionClient = await pool.connect();
    await transactionClient.query("BEGIN");
  },
  commit: async () => {
    if (!transactionClient) return;
    try {
      await transactionClient.query("COMMIT");
    } finally {
      transactionClient.release();
      transactionClient = null;
    }
  },
  rollback: async () => {
    if (!transactionClient) return;
    try {
      await transactionClient.query("ROLLBACK");
    } finally {
      transactionClient.release();
      transactionClient = null;
    }
  },
};

export const close_database = async () => {
  if (transactionClient) {
    transactionClient.release();
    transactionClient = null;
  }
  await pool.end();
};
