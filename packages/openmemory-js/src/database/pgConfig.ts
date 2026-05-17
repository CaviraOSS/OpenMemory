import type { PoolConfig } from "pg";

type OpenMemoryPoolConfig = PoolConfig & {
  statement_timeout?: number;
};

const positiveIntEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const sslConfig = () => {
  if (process.env.OM_PG_SSL === "require") return { rejectUnauthorized: false };
  if (process.env.OM_PG_SSL === "disable") return false;
  return undefined;
};

export function buildPgPoolConfig(database: string): OpenMemoryPoolConfig {
  return {
    host: process.env.OM_PG_HOST,
    port: process.env.OM_PG_PORT ? Number(process.env.OM_PG_PORT) : undefined,
    database,
    user: process.env.OM_PG_USER,
    password: process.env.OM_PG_PASSWORD,
    ssl: sslConfig(),
    max: positiveIntEnv("OM_PG_POOL_MAX", 10),
    idleTimeoutMillis: positiveIntEnv("OM_PG_IDLE_TIMEOUT_MS", 30000),
    connectionTimeoutMillis: positiveIntEnv(
      "OM_PG_CONNECTION_TIMEOUT_MS",
      5000,
    ),
    statement_timeout: positiveIntEnv("OM_PG_STATEMENT_TIMEOUT_MS", 30000),
  };
}
