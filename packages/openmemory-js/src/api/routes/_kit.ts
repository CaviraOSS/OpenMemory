/*
   ____                   __  __                                 
  / __ \                 |  \/  |                                
 | |  | |_ __   ___ _ __ | \  / | ___ _ __ ___   ___  _ __ _   _ 
 | |  | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 | |__| | |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
  \____/| .__/ \___|_| |_|_|  |_|\___|_| |_| |_|\___/|_|   \__, |
        | |                                                 __/ |
        |_|                                                |___/ 
  CaviraOSS @ 2026

 - filename: packages/openmemory-js/src/api/routes/_kit.ts
 - what is the file used for: shared api route types, validation helpers, db executor, and route context
*/

import { all_async, run_async, transaction } from "../../database/connection";
import { env } from "../../configuration";
import { embed } from "../../embeddings/embed";
import type {
  DurableEdgeType,
  DurableRecallInput,
  DurableRememberInput,
} from "../../durable/repository";
import { createVectorStore, type VectorStore } from "../../vectorStores";

export type mode = "strict" | "historical" | "associative";
export const modes = ["strict", "historical", "associative"] as const;

export type remember_req = {
  content?: string;
  source?: { kind?: string; uri?: string; id?: string };
  metadata?: Record<string, unknown>;
  facets?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
  entities?: DurableRememberInput["entities"];
  edges?: DurableRememberInput["edges"];
  tags?: string[];
  user_id?: string;
  project_id?: string;
  actor_id?: string;
};

export type recall_req = {
  query?: string;
  mode?: mode;
  at_time?: string | number;
  limit?: number;
  include_timings?: boolean;
  user_id?: string;
  project_id?: string;
  source?: { kind?: string; uri?: string; id?: string };
};

export type update_req = {
  content?: string;
  facets?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  tags?: string[];
  user_id?: string;
  expected_version?: number;
};

export type reinforce_req = { boost?: number; user_id?: string };
export type delete_req = { user_id?: string; actor_id?: string; reason?: string };
export type resolve_contradiction_req = {
  resolution?: string;
  actor_id?: string;
  reason?: string;
  user_id?: string;
};
export type create_contradiction_req = {
  user_id?: string;
  project_id?: string;
  memory_id?: string;
  contradicts_memory_id?: string;
  conflict_group_id?: string;
  resolution_policy?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
};
export type consolidation_req = {
  user_id?: string;
  project_id?: string;
  idempotency_key?: string;
  scope?: Record<string, unknown>;
  source_memory_ids?: string[];
  metadata?: Record<string, unknown>;
};
export type claim_req = { worker_id?: string; user_id?: string; project_id?: string };
export type complete_req = {
  result_memory_id?: string;
  source_memory_ids?: string[];
  summary?: string;
  metadata?: Record<string, unknown>;
};
export type tier_req = {
  tier?: "active" | "warm" | "cold" | "archived";
  user_id?: string;
  project_id?: string;
  reason?: string;
};
export type edge_req = {
  edge_id?: string;
  edge_type?: DurableEdgeType;
  source_memory_id?: string;
  target_memory_id?: string;
  user_id?: string;
  project_id?: string;
  metadata?: Record<string, unknown>;
};
export type temporal_req = {
  user_id?: string;
  project_id?: string;
  memory_id?: string;
  edge_type?: DurableEdgeType;
  at_time?: string;
  from?: string;
  to?: string;
  limit?: number;
};
export type decay_req = {
  user_id?: string;
  project_id?: string;
  actor_id?: string;
  limit?: number;
  dry_run?: boolean;
};
export type ingest_req = {
  user_id?: string;
  project_id?: string;
  source?: { kind?: string; uri?: string; id?: string; content_type?: string };
  content?: string;
  metadata?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
  observed_at?: string;
};
export type doc_req = {
  user_id?: string;
  project_id?: string;
  source?: { kind?: string; uri?: string; id?: string; content_type?: string };
  content_type?: string;
  data?: string;
  url?: string;
  encoding?: "text" | "base64";
  metadata?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
  observed_at?: string;
};
export type source_req = {
  user_id?: string;
  project_id?: string;
  config?: Record<string, unknown>;
  filters?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
};
export type accept_req = {
  source?: { kind?: string; uri?: string; id?: string; observed_at?: string };
};
export type reject_req = { reason?: string; user_id?: string };

export const bad = (res: any, field: string, msg: string) =>
  res.status(400).json({ err: "invalid_request", field, msg });

export const fail = (res: any, err: string, e: unknown) =>
  res.status(500).json({ err, msg: e instanceof Error ? e.message : String(e) });

export const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

export const posint = (v: unknown) => Number.isInteger(v) && Number(v) > 0;

export const parse_posint = (v: unknown) => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

export const parse_time = (v: string | number | undefined) => {
  if (v === undefined) return undefined;
  if (typeof v === "number") return v;
  const n = Date.parse(v);
  return Number.isNaN(n) ? undefined : n;
};

export const has_update = (b: update_req | undefined) =>
  !!b &&
  (b.content !== undefined ||
    b.facets !== undefined ||
    b.contracts !== undefined ||
    b.metadata !== undefined ||
    b.tags !== undefined);

export const mem_ref = (m: Record<string, any>) => ({
  id: m.id,
  memory_id: m.memory_id || m.id,
  status: m.status,
  version: m.version,
  salience: m.salience,
});

export const make_db = (
  run: (sql: string, params?: any[]) => Promise<void>,
  all: (sql: string, params?: any[]) => Promise<any[]>,
  tx = transaction,
) => ({
  query: async (sql: string, params: unknown[] = []) => {
    const cmd = sql.trim().toUpperCase();
    if (cmd === "BEGIN") return await tx.begin(), { rows: [] };
    if (cmd === "COMMIT") return await tx.commit(), { rows: [] };
    if (cmd === "ROLLBACK") return await tx.rollback(), { rows: [] };
    if (/^\s*select\b/i.test(sql)) return { rows: await all(sql, params as any[]) };
    await run(sql, params as any[]);
    return { rows: [] };
  },
});

export const to_memory = (b: remember_req, embedding?: number[]): DurableRememberInput => ({
  content: b.content || "",
  user_id: b.user_id,
  project_id: b.project_id,
  actor_id: b.actor_id,
  facets: b.facets,
  contracts: b.contracts,
  metadata: b.metadata,
  entities: b.entities,
  edges: b.edges,
  source: b.source,
  embedding,
});

export const to_recall = async (
  b: recall_req,
  m: mode,
  at: number | undefined,
  embedder: (text: string) => Promise<number[]> = embed,
): Promise<DurableRecallInput> => {
  const embedding = await embedder(b.query || "");
  return {
    query: b.query || "",
    mode: m,
    at_time: at === undefined ? undefined : new Date(at),
    limit: b.limit,
    user_id: b.user_id,
    project_id: b.project_id,
    source: b.source,
    embedding: embedding.length ? embedding : undefined,
  };
};

export const external_ids = async (
  vec: Pick<VectorStore, "query"> | null,
  input: { embedding?: number[]; limit?: number; user_id?: string; project_id?: string },
) => {
  if (!vec || !input.embedding?.length) return [];
  const out = await vec.query({
    embedding: input.embedding,
    limit: Math.max(1, Math.min(input.limit || 10, 100)),
    user_id: input.user_id,
    project_id: input.project_id,
  });
  return out.map((x) => x.id).filter(Boolean);
};

export type route_ctx = {
  db: ReturnType<typeof make_db>;
  vec: VectorStore | null;
  mem: boolean;
  store: string;
};

const stores = new Set(["memory", "sqlite", "valkey", "redis"]);

export const make_ctx = (): route_ctx => ({
  db: make_db(run_async, all_async),
  vec: createVectorStore(),
  mem: stores.has(env.storage_backend),
  store: env.storage_backend === "redis" ? "valkey" : env.storage_backend,
});
