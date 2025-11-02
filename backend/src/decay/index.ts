import { allAsync, runAsync, q } from '../database'
import { now } from '../utils'
import { env } from '../config'
import { LAMBDA_ONE_FAST_DECAY_RATE as L1, LAMBDA_TWO_SLOW_DECAY_RATE as L2, THETA_CONSOLIDATION_COEFFICIENT_FOR_LONG_TERM as T } from '../memory-dynamics'

const α = 0.8
let prev = 0, σ = 0
let lastDecay = 0
const cooldown = 60000
let activeQ = 0
export const incQ = () => activeQ++
export const decQ = () => activeQ--

const smooth = (p: number, c: number) => α * p + (1 - α) * c
const variance = (p: number, c: number) => 0.9 * p + 0.1 * Math.abs(c - prev)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export const apply_decay = async () => {
    if (activeQ > 0) {
        console.log(`[Decay] Skipped - ${activeQ} active queries`)
        return
    }

    const now_ts = Date.now()
    if (now_ts - lastDecay < cooldown) {
        console.log(`[Decay] Skipped - cooldown active (${((cooldown - (now_ts - lastDecay)) / 1000).toFixed(0)}s remaining)`)
        return
    }
    lastDecay = now_ts

    const t0 = performance.now()

    // Segment-based decay with sleep between segments
    const segments = await q.get_segments.all()
    let totalProcessed = 0
    let totalChanged = 0

    for (const seg of segments) {
        const segment = seg.segment
        const rows = await allAsync('select id,salience,decay_lambda,last_seen_at,updated_at from memories where segment=?', [segment])

        const decayRatio = env.decay_ratio
        const batchSize = Math.max(1, Math.floor(rows.length * decayRatio))
        const startIdx = Math.floor(Math.random() * Math.max(1, rows.length - batchSize + 1))
        const batch = rows.slice(startIdx, startIdx + batchSize)

        const ts = now()
        const ups = await Promise.all(batch.map(async (m: any) => {
            const d = Math.max(0, (ts - (m.last_seen_at || m.updated_at)) / 86400000)
            const λ = m.decay_lambda || env.decay_lambda
            const f = Math.exp(-L1 * d)
            const s = T * Math.exp(-L2 * d)
            const dual = f + s
            const sect = Math.exp(-λ * d)
            const blend = dual * 0.6 + sect * 0.4
            const decay = Math.max(0.7, blend)
            const sal = Math.max(0, m.salience * decay)
            return { id: m.id, salience: sal, old: m.salience }
        }))

        const changed = ups.filter(u => Math.abs(u.salience - u.old) > 0.001).length
        await Promise.all(ups.map(u => runAsync('update memories set salience=?,updated_at=? where id=?', [u.salience, ts, u.id])))

        totalProcessed += batch.length
        totalChanged += changed

        // Sleep between segments to avoid lock contention
        if (seg !== segments[segments.length - 1]) {
            await sleep(env.decay_sleep_ms)
        }
    }

    const tot = performance.now() - t0
    const sm = smooth(prev, tot)
    σ = variance(σ, tot)
    prev = sm
    const Δ = prev > 0 ? ((tot - prev) / prev * 100) : 0
    const varPct = prev > 0 ? (σ / prev * 100) : 0
    const alert = varPct > 10 ? '⚠️' : ''
    console.log(`[Decay] ${totalChanged}/${totalProcessed} across ${segments.length} segments in ${tot.toFixed(1)}ms | smooth ${sm.toFixed(1)}ms | Δ${Δ >= 0 ? '+' : ''}${Δ.toFixed(1)}% | σ ${varPct.toFixed(1)}% ${alert}`)
}