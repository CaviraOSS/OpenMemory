import { allAsync, runAsync } from './utils/database'
import { now } from './utils'
import { env } from './utils/config'
export const apply_decay = async () => {
    const memories = await allAsync('select id,salience,decay_lambda,last_seen_at,updated_at from memories')
    const n = now()
    const updates = memories.map((r: any) => {
        const dt = Math.max(0, (n - (r.last_seen_at || r.updated_at)) / 86400000)
        const l = r.decay_lambda || env.decay_lambda
        const s = Math.max(0, r.salience * Math.exp(-l * dt))
        return { id: r.id, salience: s }
    })
    await Promise.all(updates.map(update =>
        runAsync('update memories set salience=?, updated_at=? where id=?', [update.salience, n, update.id])
    ))
    console.log(`Applied decay to ${updates.length} memories`)
}
