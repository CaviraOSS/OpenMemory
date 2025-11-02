import sqlite3 from 'sqlite3'
import { Pool, PoolClient } from 'pg'
import { env } from '../config'
import fs from 'node:fs'
import path from 'node:path'

type Q = {
    ins_mem: { run: (...p: any[]) => Promise<void> }
    upd_mean_vec: { run: (...p: any[]) => Promise<void> }
    upd_compressed_vec: { run: (...p: any[]) => Promise<void> }
    upd_feedback: { run: (...p: any[]) => Promise<void> }
    upd_seen: { run: (...p: any[]) => Promise<void> }
    upd_mem: { run: (...p: any[]) => Promise<void> }
    upd_mem_with_sector: { run: (...p: any[]) => Promise<void> }
    del_mem: { run: (...p: any[]) => Promise<void> }
    get_mem: { get: (id: string) => Promise<any> }
    get_mem_by_simhash: { get: (simhash: string) => Promise<any> }
    all_mem: { all: (limit: number, offset: number) => Promise<any[]> }
    all_mem_by_sector: { all: (sector: string, limit: number, offset: number) => Promise<any[]> }
    get_segment_count: { get: (segment: number) => Promise<any> }
    get_max_segment: { get: () => Promise<any> }
    get_segments: { all: () => Promise<any[]> }
    get_mem_by_segment: { all: (segment: number) => Promise<any[]> }
    ins_vec: { run: (...p: any[]) => Promise<void> }
    get_vec: { get: (id: string, sector: string) => Promise<any> }
    get_vecs_by_id: { all: (id: string) => Promise<any[]> }
    get_vecs_by_sector: { all: (sector: string) => Promise<any[]> }
    get_vecs_batch: { all: (ids: string[], sector: string) => Promise<any[]> }
    del_vec: { run: (...p: any[]) => Promise<void> }
    del_vec_sector: { run: (...p: any[]) => Promise<void> }
    ins_waypoint: { run: (...p: any[]) => Promise<void> }
    get_neighbors: { all: (src: string) => Promise<any[]> }
    get_waypoints_by_src: { all: (src: string) => Promise<any[]> }
    get_waypoint: { get: (src: string, dst: string) => Promise<any> }
    upd_waypoint: { run: (...p: any[]) => Promise<void> }
    del_waypoints: { run: (...p: any[]) => Promise<void> }
    prune_waypoints: { run: (threshold: number) => Promise<void> }
    ins_log: { run: (...p: any[]) => Promise<void> }
    upd_log: { run: (...p: any[]) => Promise<void> }
    get_pending_logs: { all: () => Promise<any[]> }
    get_failed_logs: { all: () => Promise<any[]> }
}

let runAsync: (sql: string, p?: any[]) => Promise<void>
let getAsync: (sql: string, p?: any[]) => Promise<any>
let allAsync: (sql: string, p?: any[]) => Promise<any[]>
let transaction: { begin: () => Promise<void>; commit: () => Promise<void>; rollback: () => Promise<void> }
let q: Q

const isPg = env.metadata_backend === 'postgres'

if (isPg) {
    const ssl = process.env.OM_PG_SSL === 'require' ? { rejectUnauthorized: false } : process.env.OM_PG_SSL === 'disable' ? false : undefined
    const dbName = process.env.OM_PG_DB || 'openmemory'

    const pool = (db: string) => new Pool({
        host: process.env.OM_PG_HOST,
        port: process.env.OM_PG_PORT ? +process.env.OM_PG_PORT : undefined,
        database: db,
        user: process.env.OM_PG_USER,
        password: process.env.OM_PG_PASSWORD,
        ssl
    })

    let pg = pool(dbName)
    let cli: PoolClient | null = null
    const sc = process.env.OM_PG_SCHEMA || 'public'
    const m = `"${sc}"."${process.env.OM_PG_TABLE || 'openmemory_memories'}"`
    const v = `"${sc}"."${process.env.OM_VECTOR_TABLE || 'openmemory_vectors'}"`
    const w = `"${sc}"."openmemory_waypoints"`
    const l = `"${sc}"."openmemory_embed_logs"`
    const f = `"${sc}"."openmemory_memories_fts"`

    const exec = async (sql: string, p: any[] = []) => {
        const c = cli || pg
        return (await c.query(sql, p)).rows
    }

    runAsync = async (sql, p = []) => { await exec(sql, p) }
    getAsync = async (sql, p = []) => (await exec(sql, p))[0]
    allAsync = async (sql, p = []) => await exec(sql, p)

    transaction = {
        begin: async () => {
            if (cli) throw new Error('Transaction active')
            cli = await pg.connect()
            await cli.query('BEGIN')
        },
        commit: async () => {
            if (!cli) return
            try { await cli.query('COMMIT') } finally { cli.release(); cli = null }
        },
        rollback: async () => {
            if (!cli) return
            try { await cli.query('ROLLBACK') } finally { cli.release(); cli = null }
        }
    }

    let ready = false
    const waitReady = () => new Promise<void>(ok => {
        const check = () => ready ? ok() : setTimeout(check, 10)
        check()
    })

    const init = async () => {
        try {
            await pg.query('SELECT 1')
        } catch (err: any) {
            if (err.code === '3D000') {
                const admin = pool('postgres')
                try {
                    await admin.query(`CREATE DATABASE ${dbName}`)
                    console.log(`[DB] Created ${dbName}`)
                } catch (e: any) {
                    if (e.code !== '42P04') throw e
                } finally {
                    await admin.end()
                }
                pg = pool(dbName)
                await pg.query('SELECT 1')
            } else throw err
        }

        await pg.query(`create table if not exists ${m}(id uuid primary key,segment integer default 0,content text not null,simhash text,primary_sector text not null,tags text,meta text,created_at bigint,updated_at bigint,last_seen_at bigint,salience double precision,decay_lambda double precision,version integer default 1,mean_dim integer,mean_vec bytea,compressed_vec bytea,feedback_score double precision default 0)`)
        await pg.query(`create table if not exists ${v}(id uuid,sector text,v bytea,dim integer not null,primary key(id,sector))`)
        await pg.query(`create table if not exists ${w}(src_id text primary key,dst_id text not null,weight double precision not null,created_at bigint,updated_at bigint)`)
        await pg.query(`create table if not exists ${l}(id text primary key,model text,status text,ts bigint,err text)`)

        await pg.query(`create index if not exists openmemory_memories_sector_idx on ${m}(primary_sector)`)
        await pg.query(`create index if not exists openmemory_memories_segment_idx on ${m}(segment)`)
        await pg.query(`create index if not exists openmemory_memories_simhash_idx on ${m}(simhash)`)
        ready = true
    }

    init().catch(err => {
        console.error('[DB] Init failed:', err)
        process.exit(1)
    })

    const safeExec = async (sql: string, p: any[] = []) => {
        await waitReady()
        return exec(sql, p)
    }

    runAsync = async (sql, p = []) => { await safeExec(sql, p) }
    getAsync = async (sql, p = []) => (await safeExec(sql, p))[0]
    allAsync = async (sql, p = []) => await safeExec(sql, p)

    const clean = (s: string) => s ? s.replace(/"/g, '').replace(/\s+OR\s+/gi, ' OR ') : ''

    q = {
        ins_mem: { run: (...p) => runAsync(`insert into ${m}(id,segment,content,simhash,primary_sector,tags,meta,created_at,updated_at,last_seen_at,salience,decay_lambda,version,mean_dim,mean_vec,compressed_vec,feedback_score) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) on conflict(id) do update set segment=excluded.segment,content=excluded.content,simhash=excluded.simhash,primary_sector=excluded.primary_sector,tags=excluded.tags,meta=excluded.meta,created_at=excluded.created_at,updated_at=excluded.updated_at,last_seen_at=excluded.last_seen_at,salience=excluded.salience,decay_lambda=excluded.decay_lambda,version=excluded.version,mean_dim=excluded.mean_dim,mean_vec=excluded.mean_vec,compressed_vec=excluded.compressed_vec,feedback_score=excluded.feedback_score`, p) },
        upd_mean_vec: { run: (...p) => runAsync(`update ${m} set mean_dim=$2,mean_vec=$3 where id=$1`, p) },
        upd_compressed_vec: { run: (...p) => runAsync(`update ${m} set compressed_vec=$2 where id=$1`, p) },
        upd_feedback: { run: (...p) => runAsync(`update ${m} set feedback_score=$2 where id=$1`, p) },
        upd_seen: { run: (...p) => runAsync(`update ${m} set last_seen_at=$2,salience=$3,updated_at=$4 where id=$1`, p) },
        upd_mem: { run: (...p) => runAsync(`update ${m} set content=$1,tags=$2,meta=$3,updated_at=$4,version=version+1 where id=$5`, p) },
        upd_mem_with_sector: { run: (...p) => runAsync(`update ${m} set content=$1,primary_sector=$2,tags=$3,meta=$4,updated_at=$5,version=version+1 where id=$6`, p) },
        del_mem: { run: (...p) => runAsync(`delete from ${m} where id=$1`, p) },
        get_mem: { get: (id) => getAsync(`select * from ${m} where id=$1`, [id]) },
        get_mem_by_simhash: { get: (simhash) => getAsync(`select * from ${m} where simhash=$1 order by salience desc limit 1`, [simhash]) },
        all_mem: { all: (limit, offset) => allAsync(`select * from ${m} order by created_at desc limit $1 offset $2`, [limit, offset]) },
        all_mem_by_sector: { all: (sector, limit, offset) => allAsync(`select * from ${m} where primary_sector=$1 order by created_at desc limit $2 offset $3`, [sector, limit, offset]) },
        get_segment_count: { get: (segment) => getAsync(`select count(*) as c from ${m} where segment=$1`, [segment]) },
        get_max_segment: { get: () => getAsync(`select coalesce(max(segment), 0) as max_seg from ${m}`, []) },
        get_segments: { all: () => allAsync(`select distinct segment from ${m} order by segment desc`, []) },
        get_mem_by_segment: { all: (segment) => allAsync(`select * from ${m} where segment=$1 order by created_at desc`, [segment]) },
        ins_vec: { run: (...p) => runAsync(`insert into ${v}(id,sector,v,dim) values($1,$2,$3,$4) on conflict(id,sector) do update set v=excluded.v,dim=excluded.dim`, p) },
        get_vec: { get: (id, sector) => getAsync(`select v,dim from ${v} where id=$1 and sector=$2`, [id, sector]) },
        get_vecs_by_id: { all: (id) => allAsync(`select sector,v,dim from ${v} where id=$1`, [id]) },
        get_vecs_by_sector: { all: (sector) => allAsync(`select id,v,dim from ${v} where sector=$1`, [sector]) },
        get_vecs_batch: {
            all: (ids: string[], sector: string) => {
                if (!ids.length) return Promise.resolve([])
                const placeholders = ids.map((_, i) => `$${i + 2}`).join(',')
                return allAsync(`select id,v,dim from ${v} where sector=$1 and id in (${placeholders})`, [sector, ...ids])
            }
        },
        del_vec: { run: (...p) => runAsync(`delete from ${v} where id=$1`, p) },
        del_vec_sector: { run: (...p) => runAsync(`delete from ${v} where id=$1 and sector=$2`, p) },
        ins_waypoint: { run: (...p) => runAsync(`insert into ${w}(src_id,dst_id,weight,created_at,updated_at) values($1,$2,$3,$4,$5) on conflict(src_id) do update set dst_id=excluded.dst_id,weight=excluded.weight,updated_at=excluded.updated_at`, p) },
        get_neighbors: { all: (src) => allAsync(`select dst_id,weight from ${w} where src_id=$1 order by weight desc`, [src]) },
        get_waypoints_by_src: { all: (src) => allAsync(`select src_id,dst_id,weight,created_at,updated_at from ${w} where src_id=$1`, [src]) },
        get_waypoint: { get: (src, dst) => getAsync(`select weight from ${w} where src_id=$1 and dst_id=$2`, [src, dst]) },
        upd_waypoint: { run: (...p) => runAsync(`update ${w} set weight=$2,updated_at=$3 where src_id=$1 and dst_id=$4`, p) },
        del_waypoints: { run: (...p) => runAsync(`delete from ${w} where src_id=$1 or dst_id=$2`, p) },
        prune_waypoints: { run: (t) => runAsync(`delete from ${w} where weight<$1`, [t]) },
        ins_log: { run: (...p) => runAsync(`insert into ${l}(id,model,status,ts,err) values($1,$2,$3,$4,$5) on conflict(id) do update set model=excluded.model,status=excluded.status,ts=excluded.ts,err=excluded.err`, p) },
        upd_log: { run: (...p) => runAsync(`update ${l} set status=$2,err=$3 where id=$1`, p) },
        get_pending_logs: { all: () => allAsync(`select * from ${l} where status=$1`, ['pending']) },
        get_failed_logs: { all: () => allAsync(`select * from ${l} where status=$1 order by ts desc limit 100`, ['failed']) }
    }
} else {
    const dbPath = env.db_path || './data/openmemory.sqlite'
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const db = new sqlite3.Database(dbPath)
    db.serialize(() => {
        db.run('PRAGMA journal_mode=WAL')
        db.run('PRAGMA synchronous=NORMAL')
        db.run('PRAGMA temp_store=MEMORY')
        db.run('PRAGMA cache_size=-8000')
        db.run('PRAGMA mmap_size=134217728')
        db.run('PRAGMA foreign_keys=OFF')
        db.run('PRAGMA wal_autocheckpoint=20000')
        db.run('PRAGMA locking_mode=EXCLUSIVE')
        db.run('PRAGMA busy_timeout=50')

        db.run(`create table if not exists memories(id text primary key,segment integer default 0,content text not null,simhash text,primary_sector text not null,tags text,meta text,created_at integer,updated_at integer,last_seen_at integer,salience real,decay_lambda real,version integer default 1,mean_dim integer,mean_vec blob,compressed_vec blob,feedback_score real default 0)`)
        db.run(`create table if not exists vectors(id text not null,sector text not null,v blob not null,dim integer not null,primary key(id,sector))`)
        db.run(`create table if not exists waypoints(src_id text primary key,dst_id text not null,weight real not null,created_at integer,updated_at integer)`)
        db.run(`create table if not exists embed_logs(id text primary key,model text,status text,ts integer,err text)`)
        db.run('create index if not exists idx_memories_sector on memories(primary_sector)')
        db.run('create index if not exists idx_memories_segment on memories(segment)')
        db.run('create index if not exists idx_memories_simhash on memories(simhash)')
        db.run('create index if not exists idx_memories_ts on memories(last_seen_at)')
        db.run('create index if not exists idx_waypoints_src on waypoints(src_id)')
        db.run('create index if not exists idx_waypoints_dst on waypoints(dst_id)')
    })

    const exec = (sql: string, p: any[] = []) => new Promise<void>((ok, no) => db.run(sql, p, err => err ? no(err) : ok()))
    const one = (sql: string, p: any[] = []) => new Promise<any>((ok, no) => db.get(sql, p, (err, row) => err ? no(err) : ok(row)))
    const many = (sql: string, p: any[] = []) => new Promise<any[]>((ok, no) => db.all(sql, p, (err, rows) => err ? no(err) : ok(rows)))

    runAsync = exec
    getAsync = one
    allAsync = many

    transaction = {
        begin: () => exec('BEGIN TRANSACTION'),
        commit: () => exec('COMMIT'),
        rollback: () => exec('ROLLBACK')
    }

    q = {
        ins_mem: { run: (...p) => exec('insert into memories(id,segment,content,simhash,primary_sector,tags,meta,created_at,updated_at,last_seen_at,salience,decay_lambda,version,mean_dim,mean_vec,compressed_vec,feedback_score) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', p) },
        upd_mean_vec: { run: (...p) => exec('update memories set mean_dim=?,mean_vec=? where id=?', p) },
        upd_compressed_vec: { run: (...p) => exec('update memories set compressed_vec=? where id=?', p) },
        upd_feedback: { run: (...p) => exec('update memories set feedback_score=? where id=?', p) },
        upd_seen: { run: (...p) => exec('update memories set last_seen_at=?,salience=?,updated_at=? where id=?', p) },
        upd_mem: { run: (...p) => exec('update memories set content=?,tags=?,meta=?,updated_at=?,version=version+1 where id=?', p) },
        upd_mem_with_sector: { run: (...p) => exec('update memories set content=?,primary_sector=?,tags=?,meta=?,updated_at=?,version=version+1 where id=?', p) },
        del_mem: { run: (...p) => exec('delete from memories where id=?', p) },
        get_mem: { get: (id) => one('select * from memories where id=?', [id]) },
        get_mem_by_simhash: { get: (simhash) => one('select * from memories where simhash=? order by salience desc limit 1', [simhash]) },
        all_mem: { all: (limit, offset) => many('select * from memories order by created_at desc limit ? offset ?', [limit, offset]) },
        all_mem_by_sector: { all: (sector, limit, offset) => many('select * from memories where primary_sector=? order by created_at desc limit ? offset ?', [sector, limit, offset]) },
        get_segment_count: { get: (segment) => one('select count(*) as c from memories where segment=?', [segment]) },
        get_max_segment: { get: () => one('select coalesce(max(segment), 0) as max_seg from memories', []) },
        get_segments: { all: () => many('select distinct segment from memories order by segment desc', []) },
        get_mem_by_segment: { all: (segment) => many('select * from memories where segment=? order by created_at desc', [segment]) },
        ins_vec: { run: (...p) => exec('insert into vectors(id,sector,v,dim) values(?,?,?,?)', p) },
        get_vec: { get: (id, sector) => one('select v,dim from vectors where id=? and sector=?', [id, sector]) },
        get_vecs_by_id: { all: (id) => many('select sector,v,dim from vectors where id=?', [id]) },
        get_vecs_by_sector: { all: (sector) => many('select id,v,dim from vectors where sector=?', [sector]) },
        get_vecs_batch: {
            all: (ids: string[], sector: string) => {
                if (!ids.length) return Promise.resolve([])
                const placeholders = ids.map(() => '?').join(',')
                return many(`select id,v,dim from vectors where sector=? and id in (${placeholders})`, [sector, ...ids])
            }
        },
        del_vec: { run: (...p) => exec('delete from vectors where id=?', p) },
        del_vec_sector: { run: (...p) => exec('delete from vectors where id=? and sector=?', p) },
        ins_waypoint: { run: (...p) => exec('insert or replace into waypoints(src_id,dst_id,weight,created_at,updated_at) values(?,?,?,?,?)', p) },
        get_neighbors: { all: (src) => many('select dst_id,weight from waypoints where src_id=? order by weight desc', [src]) },
        get_waypoints_by_src: { all: (src) => many('select src_id,dst_id,weight,created_at,updated_at from waypoints where src_id=?', [src]) },
        get_waypoint: { get: (src, dst) => one('select weight from waypoints where src_id=? and dst_id=?', [src, dst]) },
        upd_waypoint: { run: (...p) => exec('update waypoints set weight=?,updated_at=? where src_id=? and dst_id=?', p) },
        del_waypoints: { run: (...p) => exec('delete from waypoints where src_id=? or dst_id=?', p) },
        prune_waypoints: { run: (t) => exec('delete from waypoints where weight<?', [t]) },
        ins_log: { run: (...p) => exec('insert or replace into embed_logs(id,model,status,ts,err) values(?,?,?,?,?)', p) },
        upd_log: { run: (...p) => exec('update embed_logs set status=?,err=? where id=?', p) },
        get_pending_logs: { all: () => many('select * from embed_logs where status=?', ['pending']) },
        get_failed_logs: { all: () => many('select * from embed_logs where status=? order by ts desc limit 100', ['failed']) }
    }
}

export { q, transaction, allAsync, getAsync, runAsync }
