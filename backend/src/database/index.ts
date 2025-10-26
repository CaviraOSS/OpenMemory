import sqlite3 from 'sqlite3'
import { env } from '../config'
import fs from 'node:fs'
import path from 'node:path'
const dir = path.dirname(env.db_path)
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
const db = new sqlite3.Database(env.db_path)
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
const runAsync = (sql: string, params: any[] = []) => {
    return new Promise<void>((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                console.error('[DB ERROR]', err.message)
                console.error('[DB SQL]', sql)
                console.error('[DB PARAMS]', params.length, 'params:', params.slice(0, 3))
                reject(err)
            }
            else resolve()
        })
    })
}
const getAsync = (sql: string, params: any[] = []) => {
    return new Promise<any>((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err)
            else resolve(row)
        })
    })
}
const allAsync = (sql: string, params: any[] = []) => {
    return new Promise<any[]>((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err)
            else resolve(rows)
        })
    })
}

export const transaction = {
    begin: () => runAsync('BEGIN TRANSACTION'),
    commit: () => runAsync('COMMIT'),
    rollback: () => runAsync('ROLLBACK')
}

export const q = {
    ins_mem: {
        run: (...params: any[]) => runAsync('insert into memories(id,content,primary_sector,tags,meta,created_at,updated_at,last_seen_at,salience,decay_lambda,version,mean_dim,mean_vec) values(?,?,?,?,?,?,?,?,?,?,?,?,?)', params)
    },
    upd_mean_vec: {
        run: (...params: any[]) => runAsync('update memories set mean_dim=?, mean_vec=? where id=?', params)
    },
    upd_seen: {
        run: (...params: any[]) => runAsync('update memories set last_seen_at=?, salience=?, updated_at=? where id=?', params)
    },
    upd_mem: {
        run: (...params: any[]) => runAsync('update memories set content=?, tags=?, meta=?, updated_at=?, version=version+1 where id=?', params)
    },
    upd_mem_with_sector: {
        run: (...params: any[]) => runAsync('update memories set content=?, primary_sector=?, tags=?, meta=?, updated_at=?, version=version+1 where id=?', params)
    },
    del_mem: {
        run: (...params: any[]) => runAsync('delete from memories where id=?', params)
    },
    get_mem: {
        get: (id: string) => getAsync('select * from memories where id=?', [id])
    },
    all_mem: {
        all: (limit: number, offset: number) => allAsync('select * from memories order by created_at desc limit ? offset ?', [limit, offset])
    },
    all_mem_by_sector: {
        all: (sector: string, limit: number, offset: number) => allAsync('select * from memories where primary_sector=? order by created_at desc limit ? offset ?', [sector, limit, offset])
    },
    ins_vec: {
        run: (...params: any[]) => runAsync('insert into vectors(id,sector,v,dim) values(?,?,?,?)', params)
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
        run: (...params: any[]) => runAsync('insert or replace into waypoints(src_id,dst_id,weight,created_at,updated_at) values(?,?,?,?,?)', params)
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
    }
}
export { db, allAsync, getAsync, runAsync }
