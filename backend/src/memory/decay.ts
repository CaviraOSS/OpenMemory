import { all_async, run_async, q } from '../core/db'
import { now } from '../utils'
import { env } from '../core/cfg'
import { LAMBDA_ONE_FAST_DECAY_RATE as l1, LAMBDA_TWO_SLOW_DECAY_RATE as l2, THETA_CONSOLIDATION_COEFFICIENT_FOR_LONG_TERM as t } from '../ops/dynamics'

const α = 0.8
let prev = 0, σ = 0
let last_decay = 0
const cooldown = 60000
let active_q = 0
export const inc_q = () => active_q++
export const dec_q = () => active_q--

const smooth = (p: number, c: number) => α * p + (1 - α) * c
const variance = (p: number, c: number) => 0.9 * p + 0.1 * Math.abs(c - prev)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export const apply_decay = async () => {
    if (active_q > 0) {
        console.log(`[decay] skipped - ${active_q} active queries`)
        return
    }
    const now_ts = Date.now()
    if (now_ts - last_decay < cooldown) {
        console.log(`[decay] skipped - cooldown active (${((cooldown - (now_ts - last_decay)) / 1000).toFixed(0)}s remaining)`)
        return
    }
    last_decay = now_ts
    const t0 = performance.now()
    const segments = await q.get_segments.all()
    let tot_proc = 0, tot_chg = 0
    for (const seg of segments) {
        const segment = seg.segment
        const rows = await all_async('select id,salience,decay_lambda,last_seen_at,updated_at from memories where segment=?', [segment])
        const decay_ratio = env.decay_ratio
        const batch_sz = Math.max(1, Math.floor(rows.length * decay_ratio))
        const start_idx = Math.floor(Math.random() * Math.max(1, rows.length - batch_sz + 1))
        const batch = rows.slice(start_idx, start_idx + batch_sz)
        const ts = now()
        const ups = await Promise.all(batch.map(async (m: any) => {
            const d = Math.max(0, (ts - (m.last_seen_at || m.updated_at)) / 86400000)
            const λ = m.decay_lambda || env.decay_lambda
            const f = Math.exp(-l1 * d)
            const s = t * Math.exp(-l2 * d)
            const dual = f + s
            const sect = Math.exp(-λ * d)
            const blend = dual * 0.6 + sect * 0.4
            const decay = Math.max(0.7, blend)
            const sal = Math.max(0, m.salience * decay)
            return { id: m.id, salience: sal, old: m.salience }
        }))
        const changed = ups.filter(u => Math.abs(u.salience - u.old) > 0.001).length
        await Promise.all(ups.map(u => run_async('update memories set salience=?,updated_at=? where id=?', [u.salience, ts, u.id])))
        tot_proc += batch.length
        tot_chg += changed
        if (seg !== segments[segments.length - 1]) {
            await sleep(env.decay_sleep_ms)
        }
    }
    const tot = performance.now() - t0
    const sm = smooth(prev, tot)
    σ = variance(σ, tot)
    prev = sm
    const Δ = prev > 0 ? ((tot - prev) / prev * 100) : 0
    const var_pct = prev > 0 ? (σ / prev * 100) : 0
    const alert = var_pct > 10 ? '⚠️' : ''
    console.log(`[decay] ${tot_chg}/${tot_proc} across ${segments.length} segments in ${tot.toFixed(1)}ms | smooth ${sm.toFixed(1)}ms | Δ${Δ >= 0 ? '+' : ''}${Δ.toFixed(1)}% | σ ${var_pct.toFixed(1)}% ${alert}`)
}