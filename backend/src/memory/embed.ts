import { env, tier } from '../core/cfg'
import { get_model } from '../core/models'
import { sector_configs } from './hsg'
import { q } from '../core/db'
import { canonical_tokens_from_text, add_synonym_tokens } from '../utils/text'

let gem_q: Promise<any> = Promise.resolve()
export const emb_dim = () => env.vec_dim
export interface EmbeddingResult { sector: string; vector: number[]; dim: number }

const compress_vec = (v: number[], td: number): number[] => {
    if (v.length <= td) return v
    const c = new Float32Array(td), bs = v.length / td
    for (let i = 0; i < td; i++) {
        const s = Math.floor(i * bs), e = Math.floor((i + 1) * bs)
        let sum = 0, cnt = 0
        for (let j = s; j < e && j < v.length; j++) { sum += v[j]; cnt++ }
        c[i] = cnt > 0 ? sum / cnt : 0
    }
    let n = 0
    for (let i = 0; i < td; i++) n += c[i] * c[i]
    n = Math.sqrt(n)
    if (n > 0) for (let i = 0; i < td; i++) c[i] /= n
    return Array.from(c)
}

const fuse_vecs = (syn: number[], sem: number[]): number[] => {
    const f = [...syn.map(v => v * 0.6), ...sem.map(v => v * 0.4)]
    let n = 0
    for (let i = 0; i < f.length; i++) n += f[i] * f[i]
    n = Math.sqrt(n)
    if (n > 0) for (let i = 0; i < f.length; i++) f[i] /= n
    return f
}

export async function embedForSector(t: string, s: string): Promise<number[]> {
    if (!sector_configs[s]) throw new Error(`Unknown sector: ${s}`)
    if (tier === 'smart' && env.emb_kind !== 'synthetic') {
        const syn = gen_syn_emb(t, s), sem = await get_sem_emb(t, s), comp = compress_vec(sem, 128)
        return fuse_vecs(syn, comp)
    }
    if (tier === 'fast') return gen_syn_emb(t, s)
    return await get_sem_emb(t, s)
}

async function get_sem_emb(t: string, s: string): Promise<number[]> {
    switch (env.emb_kind) {
        case 'openai': return await emb_openai(t, s)
        case 'gemini': return (await emb_gemini({ [s]: t }))[s]
        case 'ollama': return await emb_ollama(t, s)
        case 'local': return await emb_local(t, s)
        default: return gen_syn_emb(t, s)
    }
}

async function emb_openai(t: string, s: string): Promise<number[]> {
    if (!env.openai_key) throw new Error('OpenAI key missing')
    const m = get_model(s, 'openai')
    const r = await fetch(`${env.openai_base_url.replace(/\/$/, '')}/embeddings`, { method: 'POST', headers: { 'content-type': 'application/json', 'authorization': `Bearer ${env.openai_key}` }, body: JSON.stringify({ input: t, model: env.openai_model || m, dimensions: env.vec_dim }) })
    if (!r.ok) throw new Error(`OpenAI: ${r.status}`)
    return ((await r.json()) as any).data[0].embedding
}

async function emb_batch_openai(txts: Record<string, string>): Promise<Record<string, number[]>> {
    if (!env.openai_key) throw new Error('OpenAI key missing')
    const secs = Object.keys(txts), m = get_model('semantic', 'openai')
    const r = await fetch(`${env.openai_base_url.replace(/\/$/, '')}/embeddings`, { method: 'POST', headers: { 'content-type': 'application/json', 'authorization': `Bearer ${env.openai_key}` }, body: JSON.stringify({ input: Object.values(txts), model: env.openai_model || m, dimensions: env.vec_dim }) })
    if (!r.ok) throw new Error(`OpenAI batch: ${r.status}`)
    const d = (await r.json()) as any, out: Record<string, number[]> = {}
    secs.forEach((s, i) => out[s] = d.data[i].embedding)
    return out
}

const task_map: Record<string, string> = { episodic: 'RETRIEVAL_DOCUMENT', semantic: 'SEMANTIC_SIMILARITY', procedural: 'RETRIEVAL_DOCUMENT', emotional: 'CLASSIFICATION', reflective: 'SEMANTIC_SIMILARITY' }

async function emb_gemini(txts: Record<string, string>): Promise<Record<string, number[]>> {
    if (!env.gemini_key) throw new Error('Gemini key missing')
    const prom = gem_q.then(async () => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:batchEmbedContents?key=${env.gemini_key}`
        for (let a = 0; a < 3; a++) {
            try {
                const reqs = Object.entries(txts).map(([s, t]) => ({ model: 'models/embedding-001', content: { parts: [{ text: t }] }, taskType: task_map[s] || task_map.semantic }))
                const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requests: reqs }) })
                if (!r.ok) {
                    if (r.status === 429) {
                        const d = Math.min(parseInt(r.headers.get('retry-after') || '2') * 1000, 1000 * Math.pow(2, a))
                        console.warn(` Gemini rate limit (${a + 1}/3), waiting ${d}ms`)
                        await new Promise(x => setTimeout(x, d))
                        continue
                    }
                    throw new Error(`Gemini: ${r.status}`)
                }
                const data = (await r.json()) as any, out: Record<string, number[]> = {}
                let i = 0
                for (const s of Object.keys(txts)) out[s] = resize_vec(data.embeddings[i++].values, env.vec_dim)
                await new Promise(x => setTimeout(x, 1500))
                return out
            } catch (e) {
                if (a === 2) {
                    console.error(` Gemini failed after 3 attempts, using synthetic`)
                    const fb: Record<string, number[]> = {}
                    for (const s of Object.keys(txts)) fb[s] = gen_syn_emb(txts[s], s)
                    return fb
                }
                console.warn(` Gemini error (${a + 1}/3): ${e instanceof Error ? e.message : String(e)}`)
                await new Promise(x => setTimeout(x, 1000 * Math.pow(2, a)))
            }
        }
        const fb: Record<string, number[]> = {}
        for (const s of Object.keys(txts)) fb[s] = gen_syn_emb(txts[s], s)
        return fb
    })
    gem_q = prom.catch(() => { })
    return prom
}

async function emb_ollama(t: string, s: string): Promise<number[]> {
    const m = get_model(s, 'ollama')
    const r = await fetch(`${env.ollama_url}/api/embeddings`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: m, prompt: t }) })
    if (!r.ok) throw new Error(`Ollama: ${r.status}`)
    return resize_vec(((await r.json()) as any).embedding, env.vec_dim)
}

async function emb_local(t: string, s: string): Promise<number[]> {
    if (!env.local_model_path) { console.warn('Local model missing, using synthetic'); return gen_syn_emb(t, s) }
    try {
        const { createHash } = await import('crypto')
        const h = createHash('sha256').update(t + s).digest(), e: number[] = []
        for (let i = 0; i < env.vec_dim; i++) { const b1 = h[i % h.length], b2 = h[(i + 1) % h.length]; e.push((b1 * 256 + b2) / 65535 * 2 - 1) }
        const n = Math.sqrt(e.reduce((sum, v) => sum + v * v, 0))
        return e.map(v => v / n)
    } catch { console.warn('Local embedding failed, using synthetic'); return gen_syn_emb(t, s) }
}

const h1 = (v: string) => { let h = 0x811c9dc5 | 0; for (let i = 0; i < v.length; i++) h = Math.imul(h ^ v.charCodeAt(i), 16777619); return h >>> 0 }
const h2 = (v: string, sd: number) => { let h = sd | 0; for (let i = 0; i < v.length; i++) { h = Math.imul(h ^ v.charCodeAt(i), 0x5bd1e995); h = (h >>> 13) ^ h } return h >>> 0 }
const add_feat = (vec: Float32Array, dim: number, k: string, w: number) => {
    const h = h1(k), h_2 = h2(k, 0xdeadbeef), val = w * (1 - ((h & 1) << 1))
    if ((dim > 0) && (dim & (dim - 1)) === 0) { vec[h & (dim - 1)] += val; vec[h_2 & (dim - 1)] += val * 0.5 } else { vec[h % dim] += val; vec[h_2 % dim] += val * 0.5 }
}
const add_pos_feat = (vec: Float32Array, dim: number, pos: number, w: number) => {
    const idx = pos % dim, ang = pos / Math.pow(10000, (2 * idx) / dim)
    vec[idx] += w * Math.sin(ang); vec[(idx + 1) % dim] += w * Math.cos(ang)
}
const sec_wts: Record<string, number> = { episodic: 1.3, semantic: 1.0, procedural: 1.2, emotional: 1.4, reflective: 0.9 }
const norm_v = (v: Float32Array) => { let n = 0; for (let i = 0; i < v.length; i++) n += v[i] * v[i]; if (n === 0) return; const inv = 1 / Math.sqrt(n); for (let i = 0; i < v.length; i++) v[i] *= inv }

export function gen_syn_emb(t: string, s: string): number[] {
    const d = env.vec_dim || 768, v = new Float32Array(d).fill(0), ct = canonical_tokens_from_text(t)
    if (!ct.length) { const x = 1 / Math.sqrt(d); return Array.from({ length: d }, () => x) }
    const et = Array.from(add_synonym_tokens(ct)), tc = new Map<string, number>(), el = et.length
    for (let i = 0; i < el; i++) { const tok = et[i]; tc.set(tok, (tc.get(tok) || 0) + 1) }
    const sw = sec_wts[s] || 1.0, dl = Math.log(1 + el)
    for (const [tok, c] of tc) {
        const tf = c / el, idf = Math.log(1 + el / c), w = (tf * idf + 1) * sw
        add_feat(v, d, `${s}|tok|${tok}`, w)
        if (tok.length >= 3) for (let i = 0; i < tok.length - 2; i++) add_feat(v, d, `${s}|c3|${tok.slice(i, i + 3)}`, w * 0.4)
        if (tok.length >= 4) for (let i = 0; i < tok.length - 3; i++) add_feat(v, d, `${s}|c4|${tok.slice(i, i + 4)}`, w * 0.3)
    }
    for (let i = 0; i < ct.length - 1; i++) { const a = ct[i], b = ct[i + 1]; if (a && b) { const pw = 1.0 / (1.0 + i * 0.1); add_feat(v, d, `${s}|bi|${a}_${b}`, 1.4 * sw * pw) } }
    for (let i = 0; i < ct.length - 2; i++) { const a = ct[i], b = ct[i + 1], c = ct[i + 2]; if (a && b && c) add_feat(v, d, `${s}|tri|${a}_${b}_${c}`, 1.0 * sw) }
    for (let i = 0; i < Math.min(ct.length - 2, 20); i++) { const a = ct[i], c = ct[i + 2]; if (a && c) add_feat(v, d, `${s}|skip|${a}_${c}`, 0.7 * sw) }
    for (let i = 0; i < Math.min(ct.length, 50); i++) add_pos_feat(v, d, i, 0.5 * sw / dl)
    const lb = Math.min(Math.floor(Math.log2(el + 1)), 10); add_feat(v, d, `${s}|len|${lb}`, 0.6 * sw)
    const dens = tc.size / el, db = Math.floor(dens * 10); add_feat(v, d, `${s}|dens|${db}`, 0.5 * sw)
    norm_v(v); return Array.from(v)
}

const resize_vec = (v: number[], t: number) => { if (v.length === t) return v; if (v.length > t) return v.slice(0, t); return [...v, ...Array(t - v.length).fill(0)] }

export async function embedMultiSector(id: string, txt: string, secs: string[], chunks?: Array<{ text: string }>): Promise<EmbeddingResult[]> {
    const r: EmbeddingResult[] = []
    await q.ins_log.run(id, 'multi-sector', 'pending', Date.now(), null)
    for (let a = 0; a < 3; a++) {
        try {
            const simp = env.embed_mode === 'simple'
            if (simp && (env.emb_kind === 'gemini' || env.emb_kind === 'openai')) {
                console.log(` SIMPLE (1 batch for ${secs.length} sectors)`)
                const tb: Record<string, string> = {}
                secs.forEach(s => tb[s] = txt)
                const b = env.emb_kind === 'gemini' ? await emb_gemini(tb) : await emb_batch_openai(tb)
                Object.entries(b).forEach(([s, v]) => r.push({ sector: s, vector: v, dim: v.length }))
            } else {
                console.log(` ADVANCED (${secs.length} calls)`)
                const par = env.adv_embed_parallel && env.emb_kind !== 'gemini'
                if (par) {
                    const p = secs.map(async s => {
                        let v: number[]
                        if (chunks && chunks.length > 1) { const cv: number[][] = []; for (const c of chunks) cv.push(await embedForSector(c.text, s)); v = agg_chunks(cv) } else v = await embedForSector(txt, s)
                        return { sector: s, vector: v, dim: v.length }
                    })
                    r.push(...await Promise.all(p))
                } else {
                    for (let i = 0; i < secs.length; i++) {
                        const s = secs[i]
                        let v: number[]
                        if (chunks && chunks.length > 1) { const cv: number[][] = []; for (const c of chunks) cv.push(await embedForSector(c.text, s)); v = agg_chunks(cv) } else v = await embedForSector(txt, s)
                        r.push({ sector: s, vector: v, dim: v.length })
                        if (env.embed_delay_ms > 0 && i < secs.length - 1) await new Promise(x => setTimeout(x, env.embed_delay_ms))
                    }
                }
            }
            await q.upd_log.run('completed', null, id)
            return r
        } catch (e) {
            if (a === 2) { await q.upd_log.run('failed', e instanceof Error ? e.message : String(e), id); throw e }
            await new Promise(x => setTimeout(x, 1000 * Math.pow(2, a)))
        }
    }
    throw new Error('Embedding failed after retries')
}

const agg_chunks = (vecs: number[][]): number[] => {
    if (!vecs.length) throw new Error('No vectors')
    if (vecs.length === 1) return vecs[0]
    const d = vecs[0].length, r = Array(d).fill(0)
    for (const v of vecs) for (let i = 0; i < d; i++) r[i] += v[i]
    return r.map(x => x / vecs.length)
}

export const cosineSimilarity = (a: number[], b: number[]) => {
    if (a.length !== b.length) return 0
    let dot = 0, na = 0, nb = 0
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
    return (na && nb) ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

export const vectorToBuffer = (v: number[]) => { const b = Buffer.allocUnsafe(v.length * 4); for (let i = 0; i < v.length; i++) b.writeFloatLE(v[i], i * 4); return b }
export const bufferToVector = (b: Buffer) => { const v: number[] = []; for (let i = 0; i < b.length; i += 4) v.push(b.readFloatLE(i)); return v }
export const embed = (t: string) => embedForSector(t, 'semantic')
export const getEmbeddingProvider = () => env.emb_kind

export const getEmbeddingInfo = () => {
    const i: Record<string, any> = { provider: env.emb_kind, dimensions: env.vec_dim, mode: env.embed_mode, batch_support: env.embed_mode === 'simple' && (env.emb_kind === 'gemini' || env.emb_kind === 'openai'), advanced_parallel: env.adv_embed_parallel, embed_delay_ms: env.embed_delay_ms }
    if (env.emb_kind === 'openai') { i.configured = !!env.openai_key; i.base_url = env.openai_base_url; i.model_override = env.openai_model || null; i.batch_api = env.embed_mode === 'simple'; i.models = { episodic: get_model('episodic', 'openai'), semantic: get_model('semantic', 'openai'), procedural: get_model('procedural', 'openai'), emotional: get_model('emotional', 'openai'), reflective: get_model('reflective', 'openai') } }
    else if (env.emb_kind === 'gemini') { i.configured = !!env.gemini_key; i.batch_api = env.embed_mode === 'simple'; i.model = 'embedding-001' }
    else if (env.emb_kind === 'ollama') { i.configured = true; i.url = env.ollama_url; i.models = { episodic: get_model('episodic', 'ollama'), semantic: get_model('semantic', 'ollama'), procedural: get_model('procedural', 'ollama'), emotional: get_model('emotional', 'ollama'), reflective: get_model('reflective', 'ollama') } }
    else if (env.emb_kind === 'local') { i.configured = !!env.local_model_path; i.path = env.local_model_path }
    else { i.configured = true; i.type = 'synthetic' }
    return i
}
