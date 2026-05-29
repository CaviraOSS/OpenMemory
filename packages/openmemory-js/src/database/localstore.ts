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

 - filename: packages/openmemory-js/src/database/localstore.ts
 - what is the file used for: memory, sqlite, and valkey storage for local openmemory runs
*/

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type RedisClientType } from "redis";
import { env } from "../configuration";
import { scoreDurableRecall } from "../durable/scoring";
import { computeKeywordOverlap, extractKeywords } from "../utilities/keyword";

export type mem = {
  id: string;
  content: string;
  user_id: string;
  project_id: string | null;
  metadata: Record<string, unknown>;
  facets: Record<string, unknown>;
  contracts: Record<string, unknown>;
  embedding?: number[];
  status: string;
  salience: number;
  confidence: number;
  created_at: string;
  updated_at: string;
  superseded_at: string | null;
};

export type add_in = {
  content: string;
  user_id?: string;
  project_id?: string;
  metadata?: Record<string, unknown>;
  facets?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
  embedding?: number[];
};

export type recall_in = {
  query: string;
  mode: "strict" | "historical" | "associative";
  limit?: number;
  user_id?: string;
  project_id?: string;
  embedding?: number[];
};

export type list_in = { user_id?: string; project_id?: string; limit?: number; offset?: number };
export type upd_in = { id: string; user_id?: string; content?: string; metadata?: Record<string, unknown>; facets?: Record<string, unknown>; contracts?: Record<string, unknown>; embedding?: number[] };

const ram = new Map<string, mem>();
let redis: RedisClientType | null = null;
let sqlite_ready = false;
let sqlite_mod: any;
let sqlite_db: any;

const kind = () => (env.storage_backend === "redis" ? "valkey" : env.storage_backend);
const now = () => new Date().toISOString();
const scope_user = (u?: string) => u || "anonymous";
const key = (id: string) => `om:mem:${id}`;
const idx = "om:mem:ids";
const enc = (m: mem) => JSON.stringify(m);
const dec = (s: string | null | undefined): mem | null => (s ? JSON.parse(s) : null);

const cos = (a?: number[], b?: number[]) => {
  if (!a?.length || !b?.length) return 0;
  const n = Math.min(a.length, b.length);
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < n; i++) dot += a[i] * b[i], aa += a[i] * a[i], bb += b[i] * b[i];
  return aa && bb ? Math.max(0, dot / (Math.sqrt(aa) * Math.sqrt(bb))) : 0;
};

const in_scope = (m: mem, x: { user_id?: string; project_id?: string }) =>
  m.user_id === scope_user(x.user_id) && (!x.project_id || m.project_id === x.project_id || m.project_id === null);

const row = (m: mem) => ({
  id: m.id,
  memory_id: m.id,
  content: m.content,
  user_id: m.user_id,
  project_id: m.project_id,
  metadata: m.metadata,
  facets: m.facets,
  contracts: m.contracts,
  status: m.status,
  salience: m.salience,
  confidence: m.confidence,
  recorded_at: m.created_at,
  valid_from: m.created_at,
  valid_to: null,
  superseded_at: m.superseded_at,
});

const sqlite = async () => {
  if (sqlite_ready) return sqlite_db;
  const req = eval("require");
  sqlite_mod = req("sqlite3");
  fs.mkdirSync(path.dirname(path.resolve(env.sqlite_path)), { recursive: true });
  sqlite_db = new sqlite_mod.Database(env.sqlite_path);
  await sqlrun(`create table if not exists memories(id text primary key, body text not null)`);
  sqlite_ready = true;
  return sqlite_db;
};

const sqlrun = (sql: string, p: unknown[] = []) =>
  new Promise<void>((ok, bad) => sqlite_db.run(sql, p, (e: Error | null) => e ? bad(e) : ok()));
const sqlall = <t = any>(sql: string, p: unknown[] = []) =>
  new Promise<t[]>((ok, bad) => sqlite_db.all(sql, p, (e: Error | null, r: t[]) => e ? bad(e) : ok(r)));

const valkey = async () => {
  if (redis) return redis;
  redis = createClient({
    url: env.valkey_url,
    socket: { connectTimeout: 1000 },
    disableOfflineQueue: true,
  }) as RedisClientType;
  redis.on("error", () => undefined);
  try {
    await Promise.race([
      redis.connect(),
      new Promise((_, bad) => setTimeout(() => bad(new Error("valkey connect timeout")), 1200)),
    ]);
  } catch (e) {
    redis.disconnect().catch(() => undefined);
    redis = null;
    throw e;
  }
  return redis;
};

const all = async (): Promise<mem[]> => {
  if (kind() === "sqlite") {
    await sqlite();
    return (await sqlall<{ body: string }>("select body from memories")).map((x) => JSON.parse(x.body));
  }
  if (kind() === "valkey") {
    const r = await valkey();
    const ids = await r.sMembers(idx);
    if (!ids.length) return [];
    return (await r.mGet(ids.map(key))).map(dec).filter(Boolean) as mem[];
  }
  return [...ram.values()];
};

const put = async (m: mem) => {
  if (kind() === "sqlite") {
    await sqlite();
    await sqlrun("insert or replace into memories(id,body) values(?,?)", [m.id, enc(m)]);
  } else if (kind() === "valkey") {
    const r = await valkey();
    await r.sAdd(idx, m.id);
    await r.set(key(m.id), enc(m));
  } else ram.set(m.id, m);
  return m;
};

export const local_add = async (x: add_in) => put({
  id: randomUUID(),
  content: x.content,
  user_id: scope_user(x.user_id),
  project_id: x.project_id || null,
  metadata: x.metadata || {},
  facets: x.facets || {},
  contracts: x.contracts || {},
  embedding: x.embedding,
  status: "active",
  salience: 0.5,
  confidence: 0.8,
  created_at: now(),
  updated_at: now(),
  superseded_at: null,
});

export const local_get = async (id: string, x: { user_id?: string; project_id?: string } = {}) =>
  (await all()).find((m) => m.id === id && !m.superseded_at && in_scope(m, x)) || null;

export const local_list = async (x: list_in) => {
  const limit = Math.max(1, Math.min(x.limit || 50, 100));
  const offset = Math.max(0, x.offset || 0);
  const items = (await all()).filter((m) => !m.superseded_at && in_scope(m, x)).slice(offset, offset + limit).map(row);
  return { items, limit, offset };
};

export const local_recall = async (x: recall_in) => {
  const q = extractKeywords(x.query);
  const results = (await all())
    .filter((m) => in_scope(m, x))
    .filter((m) => x.mode !== "strict" || !m.superseded_at)
    .map((m) => {
      const score = scoreDurableRecall({
        vector_distance: 1 - cos(x.embedding, m.embedding),
        lexical_score: computeKeywordOverlap(q, extractKeywords(m.content)),
        confidence: m.confidence,
        salience: m.salience,
        provenance_count: 1,
      });
      return { ...row(m), score: score.score, score_components: score, provenance_summary: { count: 1, sources: [] } };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(x.limit || 10, 100)));
  return { query: x.query, mode: x.mode, results };
};

export const local_update = async (x: upd_in) => {
  const m = await local_get(x.id, x);
  if (!m) return null;
  await put({ ...m, content: x.content ?? m.content, metadata: x.metadata ?? m.metadata, facets: x.facets ?? m.facets, contracts: x.contracts ?? m.contracts, embedding: x.embedding ?? m.embedding, updated_at: now() });
  return await local_get(x.id, x);
};

export const local_reinforce = async (id: string, user_id?: string, boost = 0.1) => {
  const m = await local_get(id, { user_id });
  if (!m) return null;
  m.salience = Math.max(0, Math.min(1, m.salience + boost));
  m.updated_at = now();
  return put(m);
};

export const local_delete = async (id: string, user_id?: string) => {
  const m = await local_get(id, { user_id });
  if (!m) return null;
  m.superseded_at = now();
  m.status = "deleted";
  return put(m);
};
