import sqlite3 from 'sqlite3'
import { Pool, PoolClient } from 'pg'
import { env } from './config'
import fs from 'node:fs'
import path from 'node:path'

type Queryable = {
    query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>
}

type RunFunction = (sql: string, params?: any[]) => Promise<void>
type GetFunction = (sql: string, params?: any[]) => Promise<any>
type AllFunction = (sql: string, params?: any[]) => Promise<any[]>

type SqliteStatement = sqlite3.Statement

type QueryFunctions = {
    runAsync: RunFunction
    getAsync: GetFunction
    allAsync: AllFunction
}

type TransactionFunctions = {
    begin: () => Promise<void>
    commit: () => Promise<void>
    rollback: () => Promise<void>
}

type QueryInterface = {
    ins_mem: { run: (...params: any[]) => Promise<void> }
    upd_mean_vec: { run: (...params: any[]) => Promise<void> }
    upd_seen: { run: (...params: any[]) => Promise<void> }
    upd_mem: { run: (...params: any[]) => Promise<void> }
    upd_mem_with_sector: { run: (...params: any[]) => Promise<void> }
    del_mem: { run: (...params: any[]) => Promise<void> }
    get_mem: { get: (id: string) => Promise<any> }
    all_mem: { all: (limit: number, offset: number) => Promise<any[]> }
    all_mem_by_sector: { all: (sector: string, limit: number, offset: number) => Promise<any[]> }
    ins_vec: { run: (...params: any[]) => Promise<void> }
    get_vec: { get: (id: string, sector: string) => Promise<any> }
    get_vecs_by_id: { all: (id: string) => Promise<any[]> }
    get_vecs_by_sector: { all: (sector: string) => Promise<any[]> }
    del_vec: { run: (...params: any[]) => Promise<void> }
    del_vec_sector: { run: (...params: any[]) => Promise<void> }
    ins_waypoint: { run: (...params: any[]) => Promise<void> }
    get_neighbors: { all: (src_id: string) => Promise<any[]> }
    get_waypoint: { get: (src_id: string, dst_id: string) => Promise<any> }
    upd_waypoint: { run: (...params: any[]) => Promise<void> }
    del_waypoints: { run: (...params: any[]) => Promise<void> }
    prune_waypoints: { run: (threshold: number) => Promise<void> }
    ins_log: { run: (...params: any[]) => Promise<void> }
    upd_log: { run: (...params: any[]) => Promise<void> }
    get_pending_logs: { all: () => Promise<any[]> }
    get_failed_logs: { all: () => Promise<any[]> }
    ins_fts: { run: (...params: any[]) => Promise<void> }
    del_fts: { run: (...params: any[]) => Promise<void> }
    search_fts: { all: (query: string, limit: number) => Promise<any[]> }
}

let runAsync: RunFunction
let getAsync: GetFunction
let allAsync: AllFunction
let transaction: TransactionFunctions
let q: QueryInterface

const metadataBackend = env.metadata_backend || 'sqlite'

if (metadataBackend === 'postgres') {
    const pool = new Pool({
        host: process.env.OM_PG_HOST,
        port: process.env.OM_PG_PORT ? Number(process.env.OM_PG_PORT) : undefined,
        database: process.env.OM_PG_DB,
        user: process.env.OM_PG_USER,
        password: process.env.OM_PG_PASSWORD,
        ssl: process.env.OM_PG_SSL === 'require' ? { rejectUnauthorized: false } : process.env.OM_PG_SSL ? {} : undefined
    })

    const schema = process.env.OM_PG_SCHEMA || 'public'
    const memoriesTable = `"${schema}"."${process.env.OM_PG_TABLE || 'openmemory_memories'}"`
    const vectorsTable = `"${schema}"."${process.env.OM_VECTOR_TABLE || 'openmemory_vectors'}"`
    const waypointsTable = `"${schema}"."openmemory_waypoints"`
    const logsTable = `"${schema}"."openmemory_embed_logs"`
    const ftsTable = `"${schema}"."openmemory_memories_fts"`

    let activeClient: PoolClient | null = null

    const query = async (sql: string, params: any[] = []) => {
        const client: Queryable = activeClient || pool
        return (await client.query(sql, params)) as { rows: any[] }
    }

    runAsync = async (sql: string, params: any[] = []) => {
        await query(sql, params)
    }
    getAsync = async (sql: string, params: any[] = []) => {
        const res = await query(sql, params)
        return res.rows[0]
    }
    allAsync = async (sql: string, params: any[] = []) => {
        const res = await query(sql, params)
        return res.rows
    }

    transaction = {
        begin: async () => {
            if (activeClient) throw new Error('Transaction already active')
            const client = await pool.connect()
            await client.query('BEGIN')
            activeClient = client
        },
        commit: async () => {
            if (!activeClient) return
            try {
                await activeClient.query('COMMIT')
            } finally {
                activeClient.release()
                activeClient = null
            }
        },
        rollback: async () => {
            if (!activeClient) return
            try {
                await activeClient.query('ROLLBACK')
            } finally {
                activeClient.release()
                activeClient = null
            }
        }
    }

    const normalizedTsQuery = (input: string) => {
        if (!input) return ''
        return input.replace(/"/g, '').replace(/\s+OR\s+/gi, ' OR ')
    }

    const initPostgres = async () => {
        await pool.query(`create table if not exists ${memoriesTable}(
            id uuid primary key,
            content text not null,
            primary_sector text not null,
            tags text,
            meta text,
            created_at bigint,
            updated_at bigint,
            last_seen_at bigint,
            salience double precision,
            decay_lambda double precision,
            version integer default 1,
            mean_dim integer,
            mean_vec bytea
        )`)
        await pool.query(`create table if not exists ${vectorsTable}(
            id uuid,
            sector text,
            v bytea,
            dim integer not null,
            primary key(id, sector)
        )`)
        await pool.query(`create table if not exists ${waypointsTable}(
            src_id text primary key,
            dst_id text not null,
            weight double precision not null,
            created_at bigint,
            updated_at bigint
        )`)
        await pool.query(`create table if not exists ${logsTable}(
            id text primary key,
            model text,
            status text,
            ts bigint,
            err text
        )`)
        await pool.query(`create table if not exists ${ftsTable}(
            id uuid primary key,
            content tsvector
        )`)
        await pool.query(`create index if not exists openmemory_memories_sector_idx on ${memoriesTable}(primary_sector)`)
        await pool.query(`create index if not exists openmemory_memories_fts_idx on ${ftsTable} using gin(content)`)
    }

    initPostgres().catch(error => {
        console.error('[DB] Failed to initialise PostgreSQL metadata store:', error)
        process.exit(1)
    })

    q = {
        ins_mem: {
            run: (...params: any[]) =>
                runAsync(
                    `insert into ${memoriesTable}
                    (id, content, primary_sector, tags, meta, created_at, updated_at, last_seen_at, salience, decay_lambda, version, mean_dim, mean_vec)
                    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                    on conflict(id) do update set
                        content=excluded.content,
                        primary_sector=excluded.primary_sector,
                        tags=excluded.tags,
                        meta=excluded.meta,
                        created_at=excluded.created_at,
                        updated_at=excluded.updated_at,
                        last_seen_at=excluded.last_seen_at,
                        salience=excluded.salience,
                        decay_lambda=excluded.decay_lambda,
                        version=excluded.version,
                        mean_dim=excluded.mean_dim,
                        mean_vec=excluded.mean_vec`,
                    params
                )
        },
        upd_mean_vec: {
            run: (...params: any[]) =>
                runAsync(`update ${memoriesTable} set mean_dim=$2, mean_vec=$3 where id=$1`, params)
        },
        upd_seen: {
            run: (...params: any[]) =>
                runAsync(`update ${memoriesTable} set last_seen_at=$2, salience=$3, updated_at=$4 where id=$1`, params)
        },
        upd_mem: {
            run: (...params: any[]) =>
                runAsync(`update ${memoriesTable} set content=$1, tags=$2, meta=$3, updated_at=$4, version=version+1 where id=$5`, params)
        },
        upd_mem_with_sector: {
            run: (...params: any[]) =>
                runAsync(`update ${memoriesTable} set content=$1, primary_sector=$2, tags=$3, meta=$4, updated_at=$5, version=version+1 where id=$6`, params)
        },
        del_mem: {
            run: (...params: any[]) => runAsync(`delete from ${memoriesTable} where id=$1`, params)
        },
        get_mem: {
            get: (id: string) => getAsync(`select * from ${memoriesTable} where id=$1`, [id])
        },
        all_mem: {
            all: (limit: number, offset: number) =>
                allAsync(`select * from ${memoriesTable} order by created_at desc limit $1 offset $2`, [limit, offset])
        },
        all_mem_by_sector: {
            all: (sector: string, limit: number, offset: number) =>
                allAsync(
                    `select * from ${memoriesTable} where primary_sector=$1 order by created_at desc limit $2 offset $3`,
                    [sector, limit, offset]
                )
        },
        ins_vec: {
            run: (...params: any[]) =>
                runAsync(
                    `insert into ${vectorsTable}(id, sector, v, dim) values($1,$2,$3,$4)
                     on conflict(id, sector) do update set v=excluded.v, dim=excluded.dim`,
                    params
                )
        },
        get_vec: {
            get: (id: string, sector: string) =>
                getAsync(`select v, dim from ${vectorsTable} where id=$1 and sector=$2`, [id, sector])
        },
        get_vecs_by_id: {
            all: (id: string) => allAsync(`select sector, v, dim from ${vectorsTable} where id=$1`, [id])
        },
        get_vecs_by_sector: {
            all: (sector: string) => allAsync(`select id, v, dim from ${vectorsTable} where sector=$1`, [sector])
        },
        del_vec: {
            run: (...params: any[]) => runAsync(`delete from ${vectorsTable} where id=$1`, params)
        },
        del_vec_sector: {
            run: (...params: any[]) => runAsync(`delete from ${vectorsTable} where id=$1 and sector=$2`, params)
        },
        ins_waypoint: {
            run: (...params: any[]) =>
                runAsync(
                    `insert into ${waypointsTable}(src_id, dst_id, weight, created_at, updated_at)
                     values($1,$2,$3,$4,$5)
                     on conflict(src_id) do update set dst_id=excluded.dst_id, weight=excluded.weight, updated_at=excluded.updated_at`,
                    params
                )
        },
        get_neighbors: {
            all: (src_id: string) =>
                allAsync(`select dst_id, weight from ${waypointsTable} where src_id=$1 order by weight desc`, [src_id])
        },
        get_waypoint: {
            get: (src_id: string, dst_id: string) =>
                getAsync(`select weight from ${waypointsTable} where src_id=$1 and dst_id=$2`, [src_id, dst_id])
        },
        upd_waypoint: {
            run: (...params: any[]) =>
                runAsync(`update ${waypointsTable} set weight=$2, updated_at=$3 where src_id=$1 and dst_id=$4`, params)
        },
        del_waypoints: {
            run: (...params: any[]) => runAsync(`delete from ${waypointsTable} where src_id=$1 or dst_id=$2`, params)
        },
        prune_waypoints: {
            run: (threshold: number) => runAsync(`delete from ${waypointsTable} where weight < $1`, [threshold])
        },
        ins_log: {
            run: (...params: any[]) =>
                runAsync(
                    `insert into ${logsTable}(id, model, status, ts, err) values($1,$2,$3,$4,$5)
                     on conflict(id) do update set model=excluded.model, status=excluded.status, ts=excluded.ts, err=excluded.err`,
                    params
                )
        },
        upd_log: {
            run: (...params: any[]) => runAsync(`update ${logsTable} set status=$2, err=$3 where id=$1`, params)
        },
        get_pending_logs: {
            all: () => allAsync(`select * from ${logsTable} where status=$1`, ['pending'])
        },
        get_failed_logs: {
            all: () => allAsync(`select * from ${logsTable} where status=$1 order by ts desc limit 100`, ['failed'])
        },
        ins_fts: {
            run: (...params: any[]) =>
                runAsync(
                    `insert into ${ftsTable}(id, content) values($1, to_tsvector('simple', $2))
                     on conflict(id) do update set content=excluded.content`,
                    params
                )
        },
        del_fts: {
            run: (...params: any[]) => runAsync(`delete from ${ftsTable} where id=$1`, params)
        },
        search_fts: {
            all: (queryText: string, limit: number) =>
                allAsync(
                    `select id, ts_rank(content, websearch_to_tsquery('simple', $1)) as rank
                     from ${ftsTable}
                     where content @@ websearch_to_tsquery('simple', $1)
                     order by rank desc
                     limit $2`,
                    [normalizedTsQuery(queryText), limit]
                )
        }
    }
} else {
    const dbPath = env.db_path || './data/openmemory.sqlite'
    const dir = path.dirname(dbPath)
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const db = new sqlite3.Database(dbPath)
db.serialize(() => {
    db.run(`
        create table if not exists memories(
        id text primary key,
        content text not null,
        primary_sector text not null,
        tags text,
        meta text,
        created_at integer,
        updated_at integer,
        last_seen_at integer,
        salience real,
        decay_lambda real,
        version integer default 1,
        mean_dim integer,
        mean_vec blob
        )
    `)
    db.run(`
        create table if not exists vectors(
        id text not null,
        sector text not null,
        v blob not null,
        dim integer not null,
        primary key(id, sector)
        )
    `)
        db.run(`
            create virtual table if not exists memories_fts using fts5(
                id UNINDEXED,
                content,
                tokenize = 'porter'
        )
    `)
    db.run(`
        create table if not exists waypoints(
        src_id text primary key,
        dst_id text not null,
        weight real not null,
        created_at integer,
        updated_at integer
        )
    `)
    db.run(`
        create table if not exists embed_logs(
        id text primary key,
        model text,
        status text,
        ts integer,
        err text
        )
    `)
    db.run('create index if not exists idx_memories_sector on memories(primary_sector)')
    db.run('create index if not exists idx_waypoints_src on waypoints(src_id)')
    db.run('create index if not exists idx_waypoints_dst on waypoints(dst_id)')
})

    const run = (sql: string, params: any[] = []) =>
        new Promise<void>((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                console.error('[DB ERROR]', err.message)
                console.error('[DB SQL]', sql)
                console.error('[DB PARAMS]', params.length, 'params:', params.slice(0, 3))
                reject(err)
                } else {
                    resolve()
                }
            })
        })
    const get = (sql: string, params: any[] = []) =>
        new Promise<any>((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err)
            else resolve(row)
        })
    })
    const all = (sql: string, params: any[] = []) =>
        new Promise<any[]>((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err)
            else resolve(rows)
        })
    })

    runAsync = run
    getAsync = get
    allAsync = all

    transaction = {
        begin: () => runAsync('BEGIN TRANSACTION'),
        commit: () => runAsync('COMMIT'),
        rollback: () => runAsync('ROLLBACK')
    }

    const prepare = (sql: string): Promise<SqliteStatement> =>
        new Promise((resolve, reject) => {
            const stmt = db.prepare(sql, err => {
                if (err) reject(err)
                else resolve(stmt)
            })
        })

    q = {
        ins_mem: {
            run: (...params: any[]) =>
                runAsync(
                    'insert into memories(id,content,primary_sector,tags,meta,created_at,updated_at,last_seen_at,salience,decay_lambda,version,mean_dim,mean_vec) values(?,?,?,?,?,?,?,?,?,?,?,?,?)',
                    params
                )
        },
        upd_mean_vec: {
            run: (...params: any[]) => runAsync('update memories set mean_dim=?, mean_vec=? where id=?', params)
        },
        upd_seen: {
            run: (...params: any[]) =>
                runAsync('update memories set last_seen_at=?, salience=?, updated_at=? where id=?', params)
        },
        upd_mem: {
            run: (...params: any[]) =>
                runAsync('update memories set content=?, tags=?, meta=?, updated_at=?, version=version+1 where id=?', params)
        },
        upd_mem_with_sector: {
            run: (...params: any[]) =>
                runAsync('update memories set content=?, primary_sector=?, tags=?, meta=?, updated_at=?, version=version+1 where id=?', params)
        },
        del_mem: {
            run: (...params: any[]) => runAsync('delete from memories where id=?', params)
        },
        get_mem: {
            get: (id: string) => getAsync('select * from memories where id=?', [id])
        },
        all_mem: {
            all: (limit: number, offset: number) =>
                allAsync('select * from memories order by created_at desc limit ? offset ?', [limit, offset])
        },
        all_mem_by_sector: {
            all: (sector: string, limit: number, offset: number) =>
                allAsync('select * from memories where primary_sector=? order by created_at desc limit ? offset ?', [
                    sector,
                    limit,
                    offset
                ])
        },
        ins_vec: {
            run: (...params: any[]) =>
                runAsync('insert into vectors(id,sector,v,dim) values(?,?,?,?)', params)
        },
        get_vec: {
            get: (id: string, sector: string) => getAsync('select v,dim from vectors where id=? and sector=?', [id, sector])
        },
        get_vecs_by_id: {
            all: (id: string) => allAsync('select sector,v,dim from vectors where id=?', [id])
        },
        get_vecs_by_sector: {
            all: (sector: string) => allAsync('select id,v,dim from vectors where sector=?', [sector])
        },
        del_vec: {
            run: (...params: any[]) => runAsync('delete from vectors where id=?', params)
        },
        del_vec_sector: {
            run: (...params: any[]) => runAsync('delete from vectors where id=? and sector=?', params)
        },
        ins_waypoint: {
            run: (...params: any[]) =>
                runAsync('insert or replace into waypoints(src_id,dst_id,weight,created_at,updated_at) values(?,?,?,?,?)', params)
        },
        get_neighbors: {
            all: (src_id: string) => allAsync('select dst_id,weight from waypoints where src_id=? order by weight desc', [src_id])
        },
        get_waypoint: {
            get: (src_id: string, dst_id: string) => getAsync('select weight from waypoints where src_id=? and dst_id=?', [src_id, dst_id])
        },
        upd_waypoint: {
            run: (...params: any[]) => runAsync('update waypoints set weight=?, updated_at=? where src_id=? and dst_id=?', params)
        },
        del_waypoints: {
            run: (...params: any[]) => runAsync('delete from waypoints where src_id=? or dst_id=?', params)
        },
        prune_waypoints: {
            run: (threshold: number) => runAsync('delete from waypoints where weight < ?', [threshold])
        },
        ins_log: {
            run: (...params: any[]) => runAsync('insert or replace into embed_logs(id,model,status,ts,err) values(?,?,?,?,?)', params)
        },
        upd_log: {
            run: (...params: any[]) => runAsync('update embed_logs set status=?, err=? where id=?', params)
        },
        get_pending_logs: {
            all: () => allAsync('select * from embed_logs where status=?', ['pending'])
        },
        get_failed_logs: {
            all: () => allAsync('select * from embed_logs where status=? order by ts desc limit 100', ['failed'])
        },
        ins_fts: {
            run: (...params: any[]) => runAsync('insert into memories_fts(id, content) values(?, ?)', params)
        },
        del_fts: {
            run: (...params: any[]) => runAsync('delete from memories_fts where id=?', params)
        },
        search_fts: {
            all: (query: string, limit: number) =>
                allAsync('select id, rank from memories_fts where memories_fts match ? order by rank limit ?', [
                    query,
                    limit
                ])
        }
    }
}

export { q, transaction, allAsync, getAsync, runAsync }
