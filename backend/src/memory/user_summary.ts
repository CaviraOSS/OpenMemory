import { q } from '../core/db'
import { env } from '../core/cfg'

const cos = (a: number[], b: number[]): number => {
    let d = 0, ma = 0, mb = 0
    for (let i = 0; i < a.length; i++) {
        d += a[i] * b[i]
        ma += a[i] * a[i]
        mb += b[i] * b[i]
    }
    return d / (Math.sqrt(ma) * Math.sqrt(mb))
}

const vec = (txt: string): number[] => {
    const w = txt.toLowerCase().split(/\s+/)
    const uniq = [...new Set(w)]
    return uniq.map(u => w.filter(x => x === u).length)
}

const sim = (t1: string, t2: string): number => cos(vec(t1), vec(t2))

const cluster = (mems: any[]): any[] => {
    const cls: any[] = []
    const used = new Set()
    for (const m of mems) {
        if (used.has(m.id) || m.primary_sector === 'reflective') continue
        const c = { mem: [m], n: 1, sector: m.primary_sector }
        used.add(m.id)
        for (const o of mems) {
            if (used.has(o.id) || m.primary_sector !== o.primary_sector) continue
            if (sim(m.content, o.content) > 0.75) {
                c.mem.push(o)
                c.n++
                used.add(o.id)
            }
        }
        cls.push(c)
    }
    return cls.sort((a, b) => b.n - a.n)
}

const sal = (c: any): number => {
    const now = Date.now()
    const p = c.n / 10
    const r = c.mem.reduce((s: number, m: any) => s + Math.exp(-(now - (m.created_at || now)) / 43200000), 0) / c.n
    const e = c.mem.some((m: any) => m.primary_sector === 'emotional') ? 1 : 0
    return Math.min(1, 0.6 * p + 0.3 * r + 0.1 * e)
}

const gen_user_summary = (mems: any[]): string => {
    if (!mems.length) return 'new user with no memories yet'

    const cls = cluster(mems)
    const top_cls = cls.slice(0, 5)

    const patterns = top_cls.map(c => {
        const s = sal(c)
        const snippet = c.mem[0].content.substring(0, 40)
        return `${c.sector}(${c.n}, sal=${s.toFixed(2)}): "${snippet}..."`
    }).join(' | ')

    const total_sal = mems.reduce((sum, m) => sum + (m.salience || 0), 0) / mems.length
    const now = Date.now()
    const week_ago = now - 7 * 24 * 60 * 60 * 1000
    const recent = mems.filter(m => m.updated_at > week_ago).length
    const activity = recent > 10 ? 'active' : recent > 3 ? 'moderate' : 'low'

    return `${mems.length} memories, ${cls.length} patterns | ${activity} | avg_sal=${total_sal.toFixed(2)} | top: ${patterns}`
}

export const gen_user_summary_async = async (user_id: string): Promise<string> => {
    const mems = await q.all_mem_by_user.all(user_id, 100, 0)
    return gen_user_summary(mems)
}

export const update_user_summary = async (user_id: string): Promise<void> => {
    const summary = await gen_user_summary_async(user_id)
    const now = Date.now()

    const existing = await q.get_user.get(user_id)
    if (!existing) {
        await q.ins_user.run(user_id, summary, 0, now, now)
    } else {
        await q.upd_user_summary.run(user_id, summary, now)
    }
}

export const auto_update_user_summaries = async (): Promise<{ updated: number }> => {
    const all_mems = await q.all_mem.all(10000, 0)
    const user_ids = new Set(all_mems.map(m => m.user_id).filter(Boolean))

    let updated = 0
    for (const uid of user_ids) {
        try {
            await update_user_summary(uid as string)
            updated++
        } catch (e) {
            console.error(`[user_summary] failed for ${uid}:`, e)
        }
    }

    return { updated }
}

let timer: NodeJS.Timeout | null = null

export const start_user_summary_reflection = () => {
    if (timer) return
    const int = (env.user_summary_interval || 30) * 60000
    timer = setInterval(() => auto_update_user_summaries().catch(e => console.error('[user_summary]', e)), int)
}

export const stop_user_summary_reflection = () => {
    if (timer) {
        clearInterval(timer)
        timer = null
    }
}
