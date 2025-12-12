import sqlite3 from "sqlite3";
import { env } from "./cfg";
import * as fs from "fs";
import * as path from "path";
import { SQLiteVectorStore, VectorStore } from "./vector_store";

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
    // ins_vec: { run: (...p: any[]) => Promise<void> };
    get_vec: { get: (id: string, sector: string) => Promise<any> };
    get_vecs_by_id: { all: (id: string) => Promise<any[]> };
    get_vecs_by_sector: { all: (sector: string) => Promise<any[]> };
    get_vecs_batch: { all: (ids: string[], sector: string) => Promise<any[]> };
    // del_vec: { run: (...p: any[]) => Promise<void> };
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
let vector_store: VectorStore;
let memories_table: string;
let db: sqlite3.Database | null = null;

export const init_db = (customPath?: string) => {
    if (db) return; // Already initialized

    const db_path = customPath || env.db_path || "./data/openmemory.sqlite";
    const dir = path.dirname(db_path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new sqlite3.Database(db_path);
    db.serialize(() => {
        if (!db) return;
        db.run("PRAGMA journal_mode=WAL");
        db.run("PRAGMA synchronous=NORMAL");
        db.run("PRAGMA temp_store=MEMORY");
        db.run("PRAGMA cache_size=-8000");
        db.run("PRAGMA mmap_size=134217728");
        db.run("PRAGMA foreign_keys=OFF");
        db.run("PRAGMA wal_autocheckpoint=20000");
        db.run("PRAGMA locking_mode=NORMAL");
        db.run("PRAGMA busy_timeout=5000");
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
};

memories_table = "memories";
const exec = (sql: string, p: any[] = []) =>
    new Promise<void>((ok, no) => {
        if (!db) return no(new Error("DB not initialized"));
        db.run(sql, p, (err) => (err ? no(err) : ok()));
    });
const one = (sql: string, p: any[] = []) =>
    new Promise<any>((ok, no) => {
        if (!db) return no(new Error("DB not initialized"));
        db.get(sql, p, (err, row) => (err ? no(err) : ok(row)));
    });
const many = (sql: string, p: any[] = []) =>
    new Promise<any[]>((ok, no) => {
        if (!db) return no(new Error("DB not initialized"));
        db.all(sql, p, (err, rows) => (err ? no(err) : ok(rows)));
    });

run_async = exec;
get_async = one;
all_async = many;

// Initialize VectorStore
const sqlite_vector_table = "vectors";
vector_store = new SQLiteVectorStore({ run_async, get_async, all_async }, sqlite_vector_table);

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
    /*
    ins_vec: {
        run: (...p) =>
            exec(
                "insert into vectors(id,sector,user_id,v,dim) values(?,?,?,?,?)",
                p,
            ),
    },
    */
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
    // del_vec: { run: (...p) => exec("delete from vectors where id=?", p) },
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
};

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

export { q, transaction, all_async, get_async, run_async, memories_table, vector_store };
