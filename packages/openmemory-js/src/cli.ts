#!/usr/bin/env node
import { run_async, all_async } from "./core/db";

const SCHEMA_DEFINITIONS = {
    memories: `create table if not exists memories(id text primary key,user_id text,segment integer default 0,content text not null,simhash text,primary_sector text not null,tags text,meta text,created_at integer,updated_at integer,last_seen_at integer,salience real,decay_lambda real,version integer default 1,mean_dim integer,mean_vec blob,compressed_vec blob,feedback_score real default 0)`,
    vectors: `create table if not exists vectors(id text not null,sector text not null,user_id text,v blob not null,dim integer not null,primary key(id,sector))`,
    waypoints: `create table if not exists waypoints(src_id text,dst_id text not null,user_id text,weight real not null,created_at integer,updated_at integer,primary key(src_id,user_id))`,
    embed_logs: `create table if not exists embed_logs(id text primary key,model text,status text,ts integer,err text)`,
    users: `create table if not exists users(user_id text primary key,summary text,reflection_count integer default 0,created_at integer,updated_at integer)`,
    stats: `create table if not exists stats(id integer primary key autoincrement,type text not null,count integer default 1,ts integer not null)`,
    temporal_facts: `create table if not exists temporal_facts(id text primary key,subject text not null,predicate text not null,object text not null,valid_from integer not null,valid_to integer,confidence real not null check(confidence >= 0 and confidence <= 1),last_updated integer not null,metadata text,unique(subject,predicate,object,valid_from))`,
    temporal_edges: `create table if not exists temporal_edges(id text primary key,source_id text not null,target_id text not null,relation_type text not null,valid_from integer not null,valid_to integer,weight real not null,metadata text,foreign key(source_id) references temporal_facts(id),foreign key(target_id) references temporal_facts(id))`,
};

const INDEX_DEFINITIONS = [
    "create index if not exists idx_memories_sector on memories(primary_sector)",
    "create index if not exists idx_memories_segment on memories(segment)",
    "create index if not exists idx_memories_simhash on memories(simhash)",
    "create index if not exists idx_memories_ts on memories(last_seen_at)",
    "create index if not exists idx_memories_user on memories(user_id)",
    "create index if not exists idx_vectors_user on vectors(user_id)",
    "create index if not exists idx_waypoints_src on waypoints(src_id)",
    "create index if not exists idx_waypoints_dst on waypoints(dst_id)",
    "create index if not exists idx_waypoints_user on waypoints(user_id)",
    "create index if not exists idx_stats_ts on stats(ts)",
    "create index if not exists idx_stats_type on stats(type)",
    "create index if not exists idx_temporal_subject on temporal_facts(subject)",
    "create index if not exists idx_temporal_predicate on temporal_facts(predicate)",
    "create index if not exists idx_temporal_validity on temporal_facts(valid_from,valid_to)",
    "create index if not exists idx_temporal_composite on temporal_facts(subject,predicate,valid_from,valid_to)",
    "create index if not exists idx_edges_source on temporal_edges(source_id)",
    "create index if not exists idx_edges_target on temporal_edges(target_id)",
    "create index if not exists idx_edges_validity on temporal_edges(valid_from,valid_to)",
];

async function get_existing_tables(): Promise<Set<string>> {
    const tables = await all_async(
        `SELECT name FROM sqlite_master WHERE type='table'`,
    );
    return new Set(tables.map((t) => t.name));
}

async function get_existing_indexes(): Promise<Set<string>> {
    const indexes = await all_async(
        `SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'`,
    );
    return new Set(indexes.map((i) => i.name));
}

async function run_migrations() {
    console.log("[MIGRATE] Starting automatic migration...");

    const existing_tables = await get_existing_tables();
    const existing_indexes = await get_existing_indexes();

    let created_tables = 0;
    let created_indexes = 0;

    for (const [table_name, schema] of Object.entries(SCHEMA_DEFINITIONS)) {
        if (!existing_tables.has(table_name)) {
            console.log(`[MIGRATE] Creating table: ${table_name}`);
            const statements = schema.split(";").filter((s) => s.trim());
            for (const stmt of statements) {
                if (stmt.trim()) {
                    await run_async(stmt.trim());
                }
            }
            created_tables++;
        }
    }

    for (const index_sql of INDEX_DEFINITIONS) {
        const match = index_sql.match(/create index if not exists (\w+)/);
        const index_name = match ? match[1] : null;
        if (index_name && !existing_indexes.has(index_name)) {
            console.log(`[MIGRATE] Creating index: ${index_name}`);
            await run_async(index_sql);
            created_indexes++;
        }
    }

    console.log(
        `[MIGRATE] Migration complete: ${created_tables} tables, ${created_indexes} indexes created`,
    );

    const final_tables = await get_existing_tables();
    console.log(`[MIGRATE] Total tables: ${final_tables.size}`);
    console.log(`[MIGRATE] Tables: ${Array.from(final_tables).join(", ")}`);
}

run_migrations().catch((err) => {
    console.error("[MIGRATE] Error:", err);
    process.exit(1);
});
