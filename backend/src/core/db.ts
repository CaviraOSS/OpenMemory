import sqlite3 from "sqlite3";
import { Pool, PoolClient } from "pg";
import { env } from "./cfg";
import fs from "node:fs";
import path from "node:path";

type q_type = {
    ins_mem: { run: (...p: any[]) => Promise<void> };
    upd_mean_vec: { run: (...p: any[]) => Promise<void> };
    upd_compressed_vec: { run: (...p: any[]) => Promise<void> };
    upd_feedback: { run: (...p: any[]) => Promise<void> };
    upd_seen: { run: (...p: any[]) => Promise<void> };
    upd_mem: { run: (...p: any[]) => Promise<void> };
    upd_mem_with_sector: { run: (...p: any[]) => Promise<void> };
    del_mem: { run: (...p: any[]) => Promise<void> };
    get_mem: { get: (id: string) => Promise<any> };
    get_mem_by_simhash: { get: (simhash: string) => Promise<any> };
    all_mem: { all: (limit: number, offset: number) => Promise<any[]> };
    all_mem_by_sector: {
        all: (sector: string, limit: number, offset: number) => Promise<any[]>;
    };
    all_mem_by_user: {
        all: (user_id: string, limit: number, offset: number) => Promise<any[]>;
    };
    get_segment_count: { get: (segment: number) => Promise<any> };
    get_max_segment: { get: () => Promise<any> };
    get_segments: { all: () => Promise<any[]> };
    get_mem_by_segment: { all: (segment: number) => Promise<any[]> };
    ins_vec: { run: (...p: any[]) => Promise<void> };
    get_vec: { get: (id: string, sector: string) => Promise<any> };
    get_vecs_by_id: { all: (id: string) => Promise<any[]> };
    get_vecs_by_sector: { all: (sector: string) => Promise<any[]> };
    get_vecs_batch: { all: (ids: string[], sector: string) => Promise<any[]> };
    del_vec: { run: (...p: any[]) => Promise<void> };
    del_vec_sector: { run: (...p: any[]) => Promise<void> };
    ins_waypoint: { run: (...p: any[]) => Promise<void> };
    get_neighbors: { all: (src: string) => Promise<any[]> };
    get_waypoints_by_src: { all: (src: string) => Promise<any[]> };
    get_waypoint: { get: (src: string, dst: string) => Promise<any> };
    upd_waypoint: { run: (...p: any[]) => Promise<void> };
    del_waypoints: { run: (...p: any[]) => Promise<void> };
    prune_waypoints: { run: (threshold: number) => Promise<void> };
    ins_log: { run: (...p: any[]) => Promise<void> };
    upd_log: { run: (...p: any[]) => Promise<void> };
    get_pending_logs: { all: () => Promise<any[]> };
    get_failed_logs: { all: () => Promise<any[]> };
    ins_user: { run: (...p: any[]) => Promise<void> };
    get_user: { get: (user_id: string) => Promise<any> };
    upd_user_summary: { run: (...p: any[]) => Promise<void> };
    // Agent registration queries
    ins_agent: { run: (...p: any[]) => Promise<void> };
    upd_agent: { run: (...p: any[]) => Promise<void> };
    del_agent: { run: (agent_id: string) => Promise<void> };
    get_agent: { get: (agent_id: string) => Promise<any> };
    get_agent_by_api_key: { get: (api_key: string) => Promise<any> };
    all_agents: { all: () => Promise<any[]> };
    upd_agent_access: { run: (agent_id: string, timestamp: number) => Promise<void> };
    ins_namespace: { run: (...p: any[]) => Promise<void> };
    upd_namespace: { run: (...p: any[]) => Promise<void> };
    del_namespace: { run: (namespace: string) => Promise<void> };
    get_namespace: { get: (namespace: string) => Promise<any> };
    all_namespaces: { all: () => Promise<any[]> };
    ins_access_log: { run: (...p: any[]) => Promise<void> };
    get_agent_access_log: { all: (agent_id: string, limit?: number) => Promise<any[]> };
};

let run_async: (sql: string, p?: any[]) => Promise<void>;
let get_async: (sql: string, p?: any[]) => Promise<any>;
let all_async: (sql: string, p?: any[]) => Promise<any[]>;
let transaction: {
    begin: () => Promise<void>;
    commit: () => Promise<void>;
    rollback: () => Promise<void>;
};
let q: q_type;
let memories_table: string;

const is_pg = env.metadata_backend === "postgres";

if (is_pg) {
    const ssl =
        process.env.OM_PG_SSL === "require"
            ? { rejectUnauthorized: false }
            : process.env.OM_PG_SSL === "disable"
              ? false
              : undefined;
    const db_name = process.env.OM_PG_DB || "openmemory";
    const pool = (db: string) =>
        new Pool({
            host: process.env.OM_PG_HOST,
            port: process.env.OM_PG_PORT ? +process.env.OM_PG_PORT : undefined,
            database: db,
            user: process.env.OM_PG_USER,
            password: process.env.OM_PG_PASSWORD,
            ssl,
        });
    let pg = pool(db_name);
    let cli: PoolClient | null = null;
    const sc = process.env.OM_PG_SCHEMA || "public";
    const m = `"${sc}"."${process.env.OM_PG_TABLE || "openmemory_memories"}"`;
    memories_table = m;
    const v = `"${sc}"."${process.env.OM_VECTOR_TABLE || "openmemory_vectors"}"`;
    const w = `"${sc}"."openmemory_waypoints"`;
    const l = `"${sc}"."openmemory_embed_logs"`;
    const f = `"${sc}"."openmemory_memories_fts"`;
    const exec = async (sql: string, p: any[] = []) => {
        const c = cli || pg;
        return (await c.query(sql, p)).rows;
    };
    run_async = async (sql, p = []) => {
        await exec(sql, p);
    };
    get_async = async (sql, p = []) => (await exec(sql, p))[0];
    all_async = async (sql, p = []) => await exec(sql, p);
    transaction = {
        begin: async () => {
            if (cli) throw new Error("transaction active");
            cli = await pg.connect();
            await cli.query("BEGIN");
        },
        commit: async () => {
            if (!cli) return;
            try {
                await cli.query("COMMIT");
            } finally {
                cli.release();
                cli = null;
            }
        },
        rollback: async () => {
            if (!cli) return;
            try {
                await cli.query("ROLLBACK");
            } finally {
                cli.release();
                cli = null;
            }
        },
    };
    let ready = false;
    const wait_ready = () =>
        new Promise<void>((ok) => {
            const check = () => (ready ? ok() : setTimeout(check, 10));
            check();
        });
    const init = async () => {
        try {
            await pg.query("SELECT 1");
        } catch (err: any) {
            if (err.code === "3D000") {
                const admin = pool("postgres");
                try {
                    await admin.query(`CREATE DATABASE ${db_name}`);
                    console.log(`[DB] Created ${db_name}`);
                } catch (e: any) {
                    if (e.code !== "42P04") throw e;
                } finally {
                    await admin.end();
                }
                pg = pool(db_name);
                await pg.query("SELECT 1");
            } else throw err;
        }
        await pg.query(
            `create table if not exists ${m}(id uuid primary key,user_id text,segment integer default 0,content text not null,simhash text,primary_sector text not null,tags text,meta text,created_at bigint,updated_at bigint,last_seen_at bigint,salience double precision,decay_lambda double precision,version integer default 1,mean_dim integer,mean_vec bytea,compressed_vec bytea,feedback_score double precision default 0)`,
        );
        await pg.query(
            `create table if not exists ${v}(id uuid,sector text,user_id text,v bytea,dim integer not null,primary key(id,sector))`,
        );
        await pg.query(
            `create table if not exists ${w}(src_id text,dst_id text not null,user_id text,weight double precision not null,created_at bigint,updated_at bigint,primary key(src_id,user_id))`,
        );
        await pg.query(
            `create table if not exists ${l}(id text primary key,model text,status text,ts bigint,err text)`,
        );
        await pg.query(
            `create table if not exists "${sc}"."openmemory_users"(user_id text primary key,summary text,reflection_count integer default 0,created_at bigint,updated_at bigint)`,
        );
        await pg.query(
            `create index if not exists openmemory_memories_sector_idx on ${m}(primary_sector)`,
        );
        await pg.query(
            `create index if not exists openmemory_memories_segment_idx on ${m}(segment)`,
        );
        await pg.query(
            `create index if not exists openmemory_memories_simhash_idx on ${m}(simhash)`,
        );
        await pg.query(
            `create index if not exists openmemory_memories_user_idx on ${m}(user_id)`,
        );
        await pg.query(
            `create index if not exists openmemory_vectors_user_idx on ${v}(user_id)`,
        );
        await pg.query(
            `create index if not exists openmemory_waypoints_user_idx on ${w}(user_id)`,
        );
        ready = true;
    };
    init().catch((err) => {
        console.error("[DB] Init failed:", err);
        process.exit(1);
    });
    const safe_exec = async (sql: string, p: any[] = []) => {
        await wait_ready();
        return exec(sql, p);
    };
    run_async = async (sql, p = []) => {
        await safe_exec(sql, p);
    };
    get_async = async (sql, p = []) => (await safe_exec(sql, p))[0];
    all_async = async (sql, p = []) => await safe_exec(sql, p);
    const clean = (s: string) =>
        s ? s.replace(/"/g, "").replace(/\s+OR\s+/gi, " OR ") : "";
    q = {
        ins_mem: {
            run: (...p) =>
                run_async(
                    `insert into ${m}(id,user_id,segment,content,simhash,primary_sector,tags,meta,created_at,updated_at,last_seen_at,salience,decay_lambda,version,mean_dim,mean_vec,compressed_vec,feedback_score) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) on conflict(id) do update set user_id=excluded.user_id,segment=excluded.segment,content=excluded.content,simhash=excluded.simhash,primary_sector=excluded.primary_sector,tags=excluded.tags,meta=excluded.meta,created_at=excluded.created_at,updated_at=excluded.updated_at,last_seen_at=excluded.last_seen_at,salience=excluded.salience,decay_lambda=excluded.decay_lambda,version=excluded.version,mean_dim=excluded.mean_dim,mean_vec=excluded.mean_vec,compressed_vec=excluded.compressed_vec,feedback_score=excluded.feedback_score`,
                    p,
                ),
        },
        upd_mean_vec: {
            run: (...p) =>
                run_async(
                    `update ${m} set mean_dim=$2,mean_vec=$3 where id=$1`,
                    p,
                ),
        },
        upd_compressed_vec: {
            run: (...p) =>
                run_async(`update ${m} set compressed_vec=$2 where id=$1`, p),
        },
        upd_feedback: {
            run: (...p) =>
                run_async(`update ${m} set feedback_score=$2 where id=$1`, p),
        },
        upd_seen: {
            run: (...p) =>
                run_async(
                    `update ${m} set last_seen_at=$2,salience=$3,updated_at=$4 where id=$1`,
                    p,
                ),
        },
        upd_mem: {
            run: (...p) =>
                run_async(
                    `update ${m} set content=$1,tags=$2,meta=$3,updated_at=$4,version=version+1 where id=$5`,
                    p,
                ),
        },
        upd_mem_with_sector: {
            run: (...p) =>
                run_async(
                    `update ${m} set content=$1,primary_sector=$2,tags=$3,meta=$4,updated_at=$5,version=version+1 where id=$6`,
                    p,
                ),
        },
        del_mem: {
            run: (...p) => run_async(`delete from ${m} where id=$1`, p),
        },
        get_mem: {
            get: (id) => get_async(`select * from ${m} where id=$1`, [id]),
        },
        get_mem_by_simhash: {
            get: (simhash) =>
                get_async(
                    `select * from ${m} where simhash=$1 order by salience desc limit 1`,
                    [simhash],
                ),
        },
        all_mem: {
            all: (limit, offset) =>
                all_async(
                    `select * from ${m} order by created_at desc limit $1 offset $2`,
                    [limit, offset],
                ),
        },
        all_mem_by_sector: {
            all: (sector, limit, offset) =>
                all_async(
                    `select * from ${m} where primary_sector=$1 order by created_at desc limit $2 offset $3`,
                    [sector, limit, offset],
                ),
        },
        get_segment_count: {
            get: (segment) =>
                get_async(`select count(*) as c from ${m} where segment=$1`, [
                    segment,
                ]),
        },
        get_max_segment: {
            get: () =>
                get_async(
                    `select coalesce(max(segment), 0) as max_seg from ${m}`,
                    [],
                ),
        },
        get_segments: {
            all: () =>
                all_async(
                    `select distinct segment from ${m} order by segment desc`,
                    [],
                ),
        },
        get_mem_by_segment: {
            all: (segment) =>
                all_async(
                    `select * from ${m} where segment=$1 order by created_at desc`,
                    [segment],
                ),
        },
        ins_vec: {
            run: (...p) =>
                run_async(
                    `insert into ${v}(id,sector,user_id,v,dim) values($1,$2,$3,$4,$5) on conflict(id,sector) do update set user_id=excluded.user_id,v=excluded.v,dim=excluded.dim`,
                    p,
                ),
        },
        get_vec: {
            get: (id, sector) =>
                get_async(`select v,dim from ${v} where id=$1 and sector=$2`, [
                    id,
                    sector,
                ]),
        },
        get_vecs_by_id: {
            all: (id) =>
                all_async(`select sector,v,dim from ${v} where id=$1`, [id]),
        },
        get_vecs_by_sector: {
            all: (sector) =>
                all_async(`select id,v,dim from ${v} where sector=$1`, [
                    sector,
                ]),
        },
        get_vecs_batch: {
            all: (ids: string[], sector: string) => {
                if (!ids.length) return Promise.resolve([]);
                const ph = ids.map((_, i) => `$${i + 2}`).join(",");
                return all_async(
                    `select id,v,dim from ${v} where sector=$1 and id in (${ph})`,
                    [sector, ...ids],
                );
            },
        },
        del_vec: {
            run: (...p) => run_async(`delete from ${v} where id=$1`, p),
        },
        del_vec_sector: {
            run: (...p) =>
                run_async(`delete from ${v} where id=$1 and sector=$2`, p),
        },
        ins_waypoint: {
            run: (...p) =>
                run_async(
                    `insert into ${w}(src_id,dst_id,user_id,weight,created_at,updated_at) values($1,$2,$3,$4,$5,$6) on conflict(src_id,user_id) do update set dst_id=excluded.dst_id,weight=excluded.weight,updated_at=excluded.updated_at`,
                    p,
                ),
        },
        get_neighbors: {
            all: (src) =>
                all_async(
                    `select dst_id,weight from ${w} where src_id=$1 order by weight desc`,
                    [src],
                ),
        },
        get_waypoints_by_src: {
            all: (src) =>
                all_async(
                    `select src_id,dst_id,weight,created_at,updated_at from ${w} where src_id=$1`,
                    [src],
                ),
        },
        get_waypoint: {
            get: (src, dst) =>
                get_async(
                    `select weight from ${w} where src_id=$1 and dst_id=$2`,
                    [src, dst],
                ),
        },
        upd_waypoint: {
            run: (...p) =>
                run_async(
                    `update ${w} set weight=$2,updated_at=$3 where src_id=$1 and dst_id=$4`,
                    p,
                ),
        },
        del_waypoints: {
            run: (...p) =>
                run_async(`delete from ${w} where src_id=$1 or dst_id=$2`, p),
        },
        prune_waypoints: {
            run: (t) => run_async(`delete from ${w} where weight<$1`, [t]),
        },
        ins_log: {
            run: (...p) =>
                run_async(
                    `insert into ${l}(id,model,status,ts,err) values($1,$2,$3,$4,$5) on conflict(id) do update set model=excluded.model,status=excluded.status,ts=excluded.ts,err=excluded.err`,
                    p,
                ),
        },
        upd_log: {
            run: (...p) =>
                run_async(`update ${l} set status=$2,err=$3 where id=$1`, p),
        },
        get_pending_logs: {
            all: () =>
                all_async(`select * from ${l} where status=$1`, ["pending"]),
        },
        get_failed_logs: {
            all: () =>
                all_async(
                    `select * from ${l} where status=$1 order by ts desc limit 100`,
                    ["failed"],
                ),
        },
        all_mem_by_user: {
            all: (user_id, limit, offset) =>
                all_async(
                    `select * from ${m} where user_id=$1 order by created_at desc limit $2 offset $3`,
                    [user_id, limit, offset],
                ),
        },
        ins_user: {
            run: (...p) =>
                run_async(
                    `insert into "${sc}"."openmemory_users"(user_id,summary,reflection_count,created_at,updated_at) values($1,$2,$3,$4,$5) on conflict(user_id) do update set summary=excluded.summary,reflection_count=excluded.reflection_count,updated_at=excluded.updated_at`,
                    p,
                ),
        },
        get_user: {
            get: (user_id) =>
                get_async(
                    `select * from "${sc}"."openmemory_users" where user_id=$1`,
                    [user_id],
                ),
        },
        upd_user_summary: {
            run: (...p) =>
                run_async(
                    `update "${sc}"."openmemory_users" set summary=$2,reflection_count=reflection_count+1,updated_at=$3 where user_id=$1`,
                    p,
                ),
        },
        // Agent registration queries for PostgreSQL
        ins_agent: {
            run: (...p) =>
                run_async(
                    `insert into "${sc}"."agent_registrations"(agent_id,namespace,permissions,shared_namespaces,api_key,description,registration_date,last_access,active) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(agent_id) do update set namespace=excluded.namespace,permissions=excluded.permissions,shared_namespaces=excluded.shared_namespaces,api_key=excluded.api_key,description=excluded.description,last_access=excluded.last_access,active=excluded.active`,
                    p,
                ),
        },
        upd_agent: {
            run: (...p) =>
                run_async(
                    `update "${sc}"."agent_registrations" set namespace=$2,permissions=$3,shared_namespaces=$4,description=$5,last_access=$6 where agent_id=$1`,
                    p,
                ),
        },
        del_agent: {
            run: (agent_id) =>
                run_async(
                    `delete from "${sc}"."agent_registrations" where agent_id=$1`,
                    [agent_id],
                ),
        },
        get_agent: {
            get: (agent_id) =>
                get_async(
                    `select * from "${sc}"."agent_registrations" where agent_id=$1 and active=1`,
                    [agent_id],
                ),
        },
        get_agent_by_api_key: {
            get: (api_key) =>
                get_async(
                    `select * from "${sc}"."agent_registrations" where api_key=$1 and active=1`,
                    [api_key],
                ),
        },
        all_agents: {
            all: () =>
                all_async(
                    `select * from "${sc}"."agent_registrations" where active=1 order by registration_date desc`,
                ),
        },
        upd_agent_access: {
            run: (agent_id, timestamp) =>
                run_async(
                    `update "${sc}"."agent_registrations" set last_access=$2 where agent_id=$1`,
                    [agent_id, timestamp],
                ),
        },
        ins_namespace: {
            run: (...p) =>
                run_async(
                    `insert into "${sc}"."namespace_groups"(namespace,group_type,description,created_by,created_at,updated_at,active) values($1,$2,$3,$4,$5,$6,$7) on conflict(namespace) do update set group_type=excluded.group_type,description=excluded.description,updated_at=excluded.updated_at,active=excluded.active`,
                    p,
                ),
        },
        upd_namespace: {
            run: (...p) =>
                run_async(
                    `update "${sc}"."namespace_groups" set group_type=$2,description=$3,updated_at=$4 where namespace=$1`,
                    p,
                ),
        },
        del_namespace: {
            run: (namespace) =>
                run_async(
                    `delete from "${sc}"."namespace_groups" where namespace=$1`,
                    [namespace],
                ),
        },
        get_namespace: {
            get: (namespace) =>
                get_async(
                    `select * from "${sc}"."namespace_groups" where namespace=$1 and active=1`,
                    [namespace],
                ),
        },
        all_namespaces: {
            all: () =>
                all_async(
                    `select * from "${sc}"."namespace_groups" where active=1 order by created_at desc`,
                ),
        },
        ins_access_log: {
            run: (...p) =>
                run_async(
                    `insert into "${sc}"."agent_access_log"(agent_id,operation,namespace,timestamp,success,error_message) values($1,$2,$3,$4,$5,$6)`,
                    p,
                ),
        },
        get_agent_access_log: {
            all: (agent_id: string, limit = 10) =>
                all_async(
                    `select * from "${sc}"."agent_access_log" where agent_id=$1 order by timestamp desc limit $2`,
                    [agent_id, limit],
                ),
        },
    };
} else {
    const db_path = env.db_path || "./data/openmemory.sqlite";
    const dir = path.dirname(db_path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const db = new sqlite3.Database(db_path);
    db.serialize(() => {
        db.run("PRAGMA journal_mode=WAL");
        db.run("PRAGMA synchronous=NORMAL");
        db.run("PRAGMA temp_store=MEMORY");
        db.run("PRAGMA cache_size=-8000");
        db.run("PRAGMA mmap_size=134217728");
        db.run("PRAGMA foreign_keys=OFF");
        db.run("PRAGMA wal_autocheckpoint=20000");
        db.run("PRAGMA locking_mode=NORMAL"); // Changed from EXCLUSIVE to allow MCP access
        db.run("PRAGMA busy_timeout=5000"); // Increased timeout to handle concurrent access
        db.run(
            `create table if not exists memories(id text primary key,user_id text,segment integer default 0,content text not null,simhash text,primary_sector text not null,tags text,meta text,created_at integer,updated_at integer,last_seen_at integer,salience real,decay_lambda real,version integer default 1,mean_dim integer,mean_vec blob,compressed_vec blob,feedback_score real default 0)`,
        );
        db.run(
            `create table if not exists vectors(id text not null,sector text not null,user_id text,v blob not null,dim integer not null,primary key(id,sector))`,
        );
        db.run(
            `create table if not exists waypoints(src_id text,dst_id text not null,user_id text,weight real not null,created_at integer,updated_at integer,primary key(src_id,user_id))`,
        );
        db.run(
            `create table if not exists embed_logs(id text primary key,model text,status text,ts integer,err text)`,
        );
        db.run(
            `create table if not exists users(user_id text primary key,summary text,reflection_count integer default 0,created_at integer,updated_at integer)`,
        );
        db.run(
            `create table if not exists stats(id integer primary key autoincrement,type text not null,count integer default 1,ts integer not null)`,
        );
        db.run(
            `create table if not exists temporal_facts(id text primary key,subject text not null,predicate text not null,object text not null,valid_from integer not null,valid_to integer,confidence real not null check(confidence >= 0 and confidence <= 1),last_updated integer not null,metadata text,unique(subject,predicate,object,valid_from))`,
        );
        db.run(
            `create table if not exists temporal_edges(id text primary key,source_id text not null,target_id text not null,relation_type text not null,valid_from integer not null,valid_to integer,weight real not null,metadata text,foreign key(source_id) references temporal_facts(id),foreign key(target_id) references temporal_facts(id))`,
        );
        db.run(
            "create index if not exists idx_memories_sector on memories(primary_sector)",
        );
        db.run(
            "create index if not exists idx_memories_segment on memories(segment)",
        );
        db.run(
            "create index if not exists idx_memories_simhash on memories(simhash)",
        );
        db.run(
            "create index if not exists idx_memories_ts on memories(last_seen_at)",
        );
        db.run(
            "create index if not exists idx_memories_user on memories(user_id)",
        );
        db.run(
            "create index if not exists idx_vectors_user on vectors(user_id)",
        );
        db.run(
            "create index if not exists idx_waypoints_src on waypoints(src_id)",
        );
        db.run(
            "create index if not exists idx_waypoints_dst on waypoints(dst_id)",
        );
        db.run(
            "create index if not exists idx_waypoints_user on waypoints(user_id)",
        );
        db.run("create index if not exists idx_stats_ts on stats(ts)");
        db.run("create index if not exists idx_stats_type on stats(type)");
        db.run(
            "create index if not exists idx_temporal_subject on temporal_facts(subject)",
        );
        db.run(
            "create index if not exists idx_temporal_predicate on temporal_facts(predicate)",
        );
        db.run(
            "create index if not exists idx_temporal_validity on temporal_facts(valid_from,valid_to)",
        );
        db.run(
            "create index if not exists idx_temporal_composite on temporal_facts(subject,predicate,valid_from,valid_to)",
        );
        db.run(
            "create index if not exists idx_edges_source on temporal_edges(source_id)",
        );
        db.run(
            "create index if not exists idx_edges_target on temporal_edges(target_id)",
        );
        db.run(
            "create index if not exists idx_edges_validity on temporal_edges(valid_from,valid_to)",
        );
    });
    memories_table = "memories";
    const exec = (sql: string, p: any[] = []) =>
        new Promise<void>((ok, no) =>
            db.run(sql, p, (err) => (err ? no(err) : ok())),
        );
    const one = (sql: string, p: any[] = []) =>
        new Promise<any>((ok, no) =>
            db.get(sql, p, (err, row) => (err ? no(err) : ok(row))),
        );
    const many = (sql: string, p: any[] = []) =>
        new Promise<any[]>((ok, no) =>
            db.all(sql, p, (err, rows) => (err ? no(err) : ok(rows))),
        );
    run_async = exec;
    get_async = one;
    all_async = many;
    transaction = {
        begin: () => exec("BEGIN TRANSACTION"),
        commit: () => exec("COMMIT"),
        rollback: () => exec("ROLLBACK"),
    };
    q = {
        ins_mem: {
            run: (...p) =>
                exec(
                    "insert into memories(id,user_id,segment,content,simhash,primary_sector,tags,meta,created_at,updated_at,last_seen_at,salience,decay_lambda,version,mean_dim,mean_vec,compressed_vec,feedback_score) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    p,
                ),
        },
        upd_mean_vec: {
            run: (...p) =>
                exec("update memories set mean_dim=?,mean_vec=? where id=?", p),
        },
        upd_compressed_vec: {
            run: (...p) =>
                exec("update memories set compressed_vec=? where id=?", p),
        },
        upd_feedback: {
            run: (...p) =>
                exec("update memories set feedback_score=? where id=?", p),
        },
        upd_seen: {
            run: (...p) =>
                exec(
                    "update memories set last_seen_at=?,salience=?,updated_at=? where id=?",
                    p,
                ),
        },
        upd_mem: {
            run: (...p) =>
                exec(
                    "update memories set content=?,tags=?,meta=?,updated_at=?,version=version+1 where id=?",
                    p,
                ),
        },
        upd_mem_with_sector: {
            run: (...p) =>
                exec(
                    "update memories set content=?,primary_sector=?,tags=?,meta=?,updated_at=?,version=version+1 where id=?",
                    p,
                ),
        },
        del_mem: { run: (...p) => exec("delete from memories where id=?", p) },
        get_mem: {
            get: (id) => one("select * from memories where id=?", [id]),
        },
        get_mem_by_simhash: {
            get: (simhash) =>
                one(
                    "select * from memories where simhash=? order by salience desc limit 1",
                    [simhash],
                ),
        },
        all_mem: {
            all: (limit, offset) =>
                many(
                    "select * from memories order by created_at desc limit ? offset ?",
                    [limit, offset],
                ),
        },
        all_mem_by_sector: {
            all: (sector, limit, offset) =>
                many(
                    "select * from memories where primary_sector=? order by created_at desc limit ? offset ?",
                    [sector, limit, offset],
                ),
        },
        get_segment_count: {
            get: (segment) =>
                one("select count(*) as c from memories where segment=?", [
                    segment,
                ]),
        },
        get_max_segment: {
            get: () =>
                one(
                    "select coalesce(max(segment), 0) as max_seg from memories",
                    [],
                ),
        },
        get_segments: {
            all: () =>
                many(
                    "select distinct segment from memories order by segment desc",
                    [],
                ),
        },
        get_mem_by_segment: {
            all: (segment) =>
                many(
                    "select * from memories where segment=? order by created_at desc",
                    [segment],
                ),
        },
        ins_vec: {
            run: (...p) =>
                exec(
                    "insert into vectors(id,sector,user_id,v,dim) values(?,?,?,?,?)",
                    p,
                ),
        },
        get_vec: {
            get: (id, sector) =>
                one("select v,dim from vectors where id=? and sector=?", [
                    id,
                    sector,
                ]),
        },
        get_vecs_by_id: {
            all: (id) =>
                many("select sector,v,dim from vectors where id=?", [id]),
        },
        get_vecs_by_sector: {
            all: (sector) =>
                many("select id,v,dim from vectors where sector=?", [sector]),
        },
        get_vecs_batch: {
            all: (ids: string[], sector: string) => {
                if (!ids.length) return Promise.resolve([]);
                const ph = ids.map(() => "?").join(",");
                return many(
                    `select id,v,dim from vectors where sector=? and id in (${ph})`,
                    [sector, ...ids],
                );
            },
        },
        del_vec: { run: (...p) => exec("delete from vectors where id=?", p) },
        del_vec_sector: {
            run: (...p) =>
                exec("delete from vectors where id=? and sector=?", p),
        },
        ins_waypoint: {
            run: (...p) =>
                exec(
                    "insert or replace into waypoints(src_id,dst_id,user_id,weight,created_at,updated_at) values(?,?,?,?,?,?)",
                    p,
                ),
        },
        get_neighbors: {
            all: (src) =>
                many(
                    "select dst_id,weight from waypoints where src_id=? order by weight desc",
                    [src],
                ),
        },
        get_waypoints_by_src: {
            all: (src) =>
                many(
                    "select src_id,dst_id,weight,created_at,updated_at from waypoints where src_id=?",
                    [src],
                ),
        },
        get_waypoint: {
            get: (src, dst) =>
                one(
                    "select weight from waypoints where src_id=? and dst_id=?",
                    [src, dst],
                ),
        },
        upd_waypoint: {
            run: (...p) =>
                exec(
                    "update waypoints set weight=?,updated_at=? where src_id=? and dst_id=?",
                    p,
                ),
        },
        del_waypoints: {
            run: (...p) =>
                exec("delete from waypoints where src_id=? or dst_id=?", p),
        },
        prune_waypoints: {
            run: (t) => exec("delete from waypoints where weight<?", [t]),
        },
        ins_log: {
            run: (...p) =>
                exec(
                    "insert or replace into embed_logs(id,model,status,ts,err) values(?,?,?,?,?)",
                    p,
                ),
        },
        upd_log: {
            run: (...p) =>
                exec("update embed_logs set status=?,err=? where id=?", p),
        },
        get_pending_logs: {
            all: () =>
                many("select * from embed_logs where status=?", ["pending"]),
        },
        get_failed_logs: {
            all: () =>
                many(
                    "select * from embed_logs where status=? order by ts desc limit 100",
                    ["failed"],
                ),
        },
        all_mem_by_user: {
            all: (user_id, limit, offset) =>
                many(
                    "select * from memories where user_id=? order by created_at desc limit ? offset ?",
                    [user_id, limit, offset],
                ),
        },
        ins_user: {
            run: (...p) =>
                exec(
                    "insert or replace into users(user_id,summary,reflection_count,created_at,updated_at) values(?,?,?,?,?)",
                    p,
                ),
        },
        get_user: {
            get: (user_id) =>
                one("select * from users where user_id=?", [user_id]),
        },
        upd_user_summary: {
            run: (...p) =>
                exec(
                    "update users set summary=?,reflection_count=reflection_count+1,updated_at=? where user_id=?",
                    p,
                ),
        },
        // Agent registration queries for SQLite
        ins_agent: {
            run: (...p) =>
                exec(
                    "insert or replace into agent_registrations(agent_id,namespace,permissions,shared_namespaces,api_key,description,registration_date,last_access,active) values(?,?,?,?,?,?,?,?,?)",
                    p,
                ),
        },
        upd_agent: {
            run: (...p) =>
                exec(
                    "update agent_registrations set namespace=?,permissions=?,shared_namespaces=?,description=?,last_access=? where agent_id=?",
                    p,
                ),
        },
        del_agent: {
            run: (agent_id) =>
                exec("delete from agent_registrations where agent_id=?", [agent_id]),
        },
        get_agent: {
            get: (agent_id) =>
                one("select * from agent_registrations where agent_id=? and active=1", [agent_id]),
        },
        get_agent_by_api_key: {
            get: (api_key) =>
                one("select * from agent_registrations where api_key=? and active=1", [api_key]),
        },
        all_agents: {
            all: () =>
                many("select * from agent_registrations where active=1 order by registration_date desc"),
        },
        upd_agent_access: {
            run: (agent_id, timestamp) =>
                exec("update agent_registrations set last_access=? where agent_id=?", [timestamp, agent_id]),
        },
        ins_namespace: {
            run: (...p) =>
                exec(
                    "insert or replace into namespace_groups(namespace,group_type,description,created_by,created_at,updated_at,active) values(?,?,?,?,?,?,?)",
                    p,
                ),
        },
        upd_namespace: {
            run: (...p) =>
                exec(
                    "update namespace_groups set group_type=?,description=?,updated_at=? where namespace=?",
                    p,
                ),
        },
        del_namespace: {
            run: (namespace) =>
                exec("delete from namespace_groups where namespace=?", [namespace]),
        },
        get_namespace: {
            get: (namespace) =>
                one("select * from namespace_groups where namespace=? and active=1", [namespace]),
        },
        all_namespaces: {
            all: () =>
                many("select * from namespace_groups where active=1 order by created_at desc"),
        },
        ins_access_log: {
            run: (...p) =>
                exec(
                    "insert into agent_access_log(agent_id,operation,namespace,timestamp,success,error_message) values(?,?,?,?,?,?)",
                    p,
                ),
        },
        get_agent_access_log: {
            all: (agent_id, limit = 10) =>
                many(
                    "select * from agent_access_log where agent_id=? order by timestamp desc limit ?",
                    [agent_id, limit],
                ),
        },
    };
}

export const log_maint_op = async (
    type: "decay" | "reflect" | "consolidate",
    cnt = 1,
) => {
    try {
        await run_async("insert into stats(type,count,ts) values(?,?,?)", [
            type,
            cnt,
            Date.now(),
        ]);
    } catch (e) {
        console.error("[DB] Maintenance log error:", e);
    }
};

export { q, transaction, all_async, get_async, run_async, memories_table };
