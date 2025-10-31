import { createHash } from 'crypto';
import { env } from '../config';
import { q } from '../database';
import { SECTOR_CONFIGS } from '../hsg';
import { addSynonymTokens, canonicalTokensFromText } from '../utils/text';

let geminiQueue: Promise<any> = Promise.resolve()

export const emb_dim = () => env.vec_dim
export interface EmbeddingResult { sector: string; vector: number[]; dim: number }
export async function embedForSector(t: string, s: string): Promise<number[]> {
    if (!SECTOR_CONFIGS[s]) throw new Error(`Unknown sector: ${s}`)
    switch (env.emb_kind) {
        case 'openai': return await embedWithOpenAI(t, s)
        case 'gemini': return (await embedWithGemini({ [s]: t }))[s]
        case 'ollama': return await embedWithOllama(t, s)
        case 'local': return await embedWithLocal(t, s)
        default: return generateSyntheticEmbedding(t, s)
    }
}

const MOD: Record<string, string> = {
    episodic: 'text-embedding-3-small',
    semantic: 'text-embedding-3-small',
    procedural: 'text-embedding-3-small',
    emotional: 'text-embedding-3-small',
    reflective: 'text-embedding-3-large'
}

async function embedWithOpenAI(t: string, s: string): Promise<number[]> {
    if (!env.openai_key) throw new Error('OpenAI key missing')
    const r = await fetch(`${env.openai_base_url.replace(/\/$/, '')}/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${env.openai_key}` },
        body: JSON.stringify({ input: t, model: env.openai_model || MOD[s] || MOD.semantic, dimensions: env.vec_dim })
    })
    if (!r.ok) throw new Error(`OpenAI: ${r.status}`)
    return ((await r.json()) as any).data[0].embedding
}

async function embedBatchOpenAI(texts: Record<string, string>): Promise<Record<string, number[]>> {
    if (!env.openai_key) throw new Error('OpenAI key missing')
    const sectors = Object.keys(texts)
    const r = await fetch(`${env.openai_base_url.replace(/\/$/, '')}/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${env.openai_key}` },
        body: JSON.stringify({ input: Object.values(texts), model: env.openai_model || MOD.semantic, dimensions: env.vec_dim })
    })
    if (!r.ok) throw new Error(`OpenAI batch: ${r.status}`)
    const d = (await r.json()) as any
    const out: Record<string, number[]> = {}
    sectors.forEach((s, i) => out[s] = d.data[i].embedding)
    return out
}

const TASK: Record<string, string> = {
    episodic: 'RETRIEVAL_DOCUMENT',
    semantic: 'SEMANTIC_SIMILARITY',
    procedural: 'RETRIEVAL_DOCUMENT',
    emotional: 'CLASSIFICATION',
    reflective: 'SEMANTIC_SIMILARITY'
}

async function embedWithGemini(texts: Record<string, string>): Promise<Record<string, number[]>> {
    if (!env.gemini_key) throw new Error('Gemini key missing')
    const promise = geminiQueue.then(async () => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:batchEmbedContents?key=${env.gemini_key}`
        for (let a = 0; a < 3; a++) {
            try {
                const reqs = Object.entries(texts).map(([s, t]) => ({
                    model: 'models/embedding-001',
                    content: { parts: [{ text: t }] },
                    taskType: TASK[s] || TASK.semantic
                }))
                const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requests: reqs }) })
                if (!r.ok) {
                    if (r.status === 429) {
                        const d = Math.min(parseInt(r.headers.get('retry-after') || '2') * 1000, 1000 * Math.pow(2, a))
                        console.warn(`⚠️ Gemini rate limit (${a + 1}/3), waiting ${d}ms`)
                        await new Promise(x => setTimeout(x, d))
                        continue
                    }
                    throw new Error(`Gemini: ${r.status}`)
                }
                const data = (await r.json()) as any
                const out: Record<string, number[]> = {}
                let i = 0
                for (const s of Object.keys(texts)) out[s] = resizeVector(data.embeddings[i++].values, env.vec_dim)
                await new Promise(x => setTimeout(x, 1500))
                return out
            } catch (e) {
                if (a === 2) {
                    console.error(`❌ Gemini failed after 3 attempts, using synthetic`)
                    const fb: Record<string, number[]> = {}
                    for (const s of Object.keys(texts)) fb[s] = generateSyntheticEmbedding(texts[s], s)
                    return fb
                }
                console.warn(`⚠️ Gemini error (${a + 1}/3): ${e instanceof Error ? e.message : String(e)}`)
                await new Promise(x => setTimeout(x, 1000 * Math.pow(2, a)))
            }
        }
        const fb: Record<string, number[]> = {}
        for (const s of Object.keys(texts)) fb[s] = generateSyntheticEmbedding(texts[s], s)
        return fb
    })
    geminiQueue = promise.catch(() => { })
    return promise
}

const OMOD: Record<string, string> = {
    episodic: 'nomic-embed-text',
    semantic: 'nomic-embed-text',
    procedural: 'bge-small',
    emotional: 'nomic-embed-text',
    reflective: 'bge-large'
}

async function embedWithOllama(t: string, s: string): Promise<number[]> {
    const r = await fetch(`${env.ollama_url}/api/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: OMOD[s] || OMOD.semantic, prompt: t })
    })
    if (!r.ok) throw new Error(`Ollama: ${r.status}`)
    return resizeVector(((await r.json()) as any).embedding, env.vec_dim)
}

async function embedWithLocal(t: string, s: string): Promise<number[]> {
    if (!env.local_model_path) {
        console.warn('Local model missing, using synthetic')
        return generateSyntheticEmbedding(t, s)
    }
    try {
        const hash = createHash('sha256').update(t, 'utf8').update(s, 'utf8').digest();
        const dim = env.vec_dim;
        const e = new Array<number>(dim);
        const HLEN = 32;

        let i = 0;
        for (let idx = 0; idx < dim; idx++) {
        const b1 = hash[i];
        i = (i + 1) % HLEN;
        const b2 = hash[i];
        e[idx] = (b1 * 256 + b2) / 65535 * 2 - 1;
        }

        let sumSquares = 0;
        for (let idx = 0; idx < dim; idx++) {
        const v = e[idx];
        sumSquares += v * v;
        }
        const norm = Math.sqrt(sumSquares);

        for (let idx = 0; idx < dim; idx++) {
        e[idx] /= norm;
        }

        return e;
    } catch {
        console.warn('Local embedding failed, using synthetic')
        return generateSyntheticEmbedding(t, s)
    }
}

const hash = (v: string) => {
    let h = 0x811c9dc5 | 0;
    const len = v.length | 0;
    for (let i = 0; i < len; i++) {
        h = Math.imul(h ^ v.charCodeAt(i), 16777619);
    }
    return h >>> 0;
}

const addFeat = (vec: Float32Array, dim: number, key: string, w: number) => {
    const h = hash(key);
    const value = w * (1 - ((h & 1) << 1));
    if ((dim > 0) && (dim & (dim - 1)) === 0) {
        vec[h & (dim - 1)] += value;
    } else {
        vec[h % dim] += value;
    }
}

const norm = (vec: Float32Array) => {
    let n = 0;
    const len = vec.length;
    for (let i = 0; i < len; i++) {
        const v = vec[i];
        n += v * v;
    }
    if (n === 0) return;
    const invSqrt = 1 / Math.sqrt(n);
    for (let i = 0; i < len; i++) {
        vec[i] *= invSqrt;
    }
}

function generateSyntheticEmbedding(t: string, s: string): number[] {
    const d = env.vec_dim || 768
    const v = new Float32Array(d).fill(0)
    const ct = canonicalTokensFromText(t)
    if (!ct.length) {
        const x = 1 / Math.sqrt(d)
        return Array.from({ length: d }, () => x)
    }
    const et = Array.from(addSynonymTokens(ct))
    const tc = new Map<string, number>()
    const etLength: number = et.length;
    for (let i = 0; i < etLength; i++) {
        const tok = et[i];
        tc.set(tok, (tc.get(tok) || 0) + 1)
    }

    for (const [tok, c] of tc) {
        const w = Math.log(1 + c) + 1
        addFeat(v, d, `${s}|tok|${tok}`, w)
        if (tok.length >= 3) for (let i = 0; i < tok.length - 2; i++) addFeat(v, d, `${s}|tri|${tok.slice(i, i + 3)}`, w * 0.6)
    }

    for (let i = 0; i < ct.length - 1; i++) {
        const a = ct[i], b = ct[i + 1]
        if (a && b) addFeat(v, d, `${s}|bi|${a}_${b}`, 1.2)
    }

    norm(v)
    return Array.from(v)
}

const resizeVector = (v: number[], t: number) => {
    if (v.length === t) return v
    if (v.length > t) return v.slice(0, t)
    return [...v, ...Array(t - v.length).fill(0)]
}

export async function embedMultiSector(id: string, text: string, sectors: string[], chunks?: Array<{ text: string }>): Promise<EmbeddingResult[]> {
    const r: EmbeddingResult[] = []
    await q.ins_log.run(id, 'multi-sector', 'pending', Date.now(), null)
    for (let a = 0; a < 3; a++) {
        try {
            const simple = env.embed_mode === 'simple'
            if (simple && (env.emb_kind === 'gemini' || env.emb_kind === 'openai')) {
                console.log(`📦 SIMPLE (1 batch for ${sectors.length} sectors)`)
                const tb: Record<string, string> = {}
                sectors.forEach(s => tb[s] = text)
                const b = env.emb_kind === 'gemini' ? await embedWithGemini(tb) : await embedBatchOpenAI(tb)
                Object.entries(b).forEach(([s, v]) => r.push({ sector: s, vector: v, dim: v.length }))
            } else {
                console.log(`🔬 ADVANCED (${sectors.length} calls)`)
                const par = env.adv_embed_parallel && env.emb_kind !== 'gemini'
                if (par) {
                    const p = sectors.map(async s => {
                        let v: number[]
                        if (chunks && chunks.length > 1) {
                            const cv: number[][] = []
                            for (const c of chunks) cv.push(await embedForSector(c.text, s))
                            v = aggChunks(cv)
                        } else v = await embedForSector(text, s)
                        return { sector: s, vector: v, dim: v.length }
                    })
                    r.push(...await Promise.all(p))
                } else {
                    for (let i = 0; i < sectors.length; i++) {
                        const s = sectors[i]
                        let v: number[]
                        if (chunks && chunks.length > 1) {
                            const cv: number[][] = []
                            for (const c of chunks) cv.push(await embedForSector(c.text, s))
                            v = aggChunks(cv)
                        } else v = await embedForSector(text, s)
                        r.push({ sector: s, vector: v, dim: v.length })
                        if (env.embed_delay_ms > 0 && i < sectors.length - 1) await new Promise(x => setTimeout(x, env.embed_delay_ms))
                    }
                }
            }
            await q.upd_log.run('completed', null, id)
            return r
        } catch (e) {
            if (a === 2) {
                await q.upd_log.run('failed', e instanceof Error ? e.message : String(e), id)
                throw e
            }
            await new Promise(x => setTimeout(x, 1000 * Math.pow(2, a)))
        }
    }
    throw new Error('Embedding failed after retries')
}

const aggChunks = (vecs: number[][]): number[] => {
    if (!vecs.length) throw new Error('No vectors')
    if (vecs.length === 1) return vecs[0]
    const d = vecs[0].length
    const r = Array(d).fill(0)
    for (const v of vecs) for (let i = 0; i < d; i++) r[i] += v[i]
    return r.map(x => x / vecs.length)
}
export const cosineSimilarity = (a: number[], b: number[]) => {
    if (a.length !== b.length) return 0
    let dot = 0, na = 0, nb = 0
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
    return (na && nb) ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

export const vectorToBuffer = (v: number[]) => {
    const b = Buffer.allocUnsafe(v.length * 4)
    for (let i = 0; i < v.length; i++) b.writeFloatLE(v[i], i * 4)
    return b
}

export const bufferToVector = (b: Buffer) => {
    const v: number[] = []
    for (let i = 0; i < b.length; i += 4) v.push(b.readFloatLE(i))
    return v
}

export const embed = (t: string) => embedForSector(t, 'semantic')
export const getEmbeddingProvider = () => env.emb_kind

export const getEmbeddingInfo = () => {
    const i: Record<string, any> = {
        provider: env.emb_kind,
        dimensions: env.vec_dim,
        mode: env.embed_mode,
        batch_support: env.embed_mode === 'simple' && (env.emb_kind === 'gemini' || env.emb_kind === 'openai'),
        advanced_parallel: env.adv_embed_parallel,
        embed_delay_ms: env.embed_delay_ms
    }
    if (env.emb_kind === 'openai') {
        i.configured = !!env.openai_key
        i.base_url = env.openai_base_url
        i.model_override = env.openai_model || null
        i.batch_api = env.embed_mode === 'simple'
        i.models = MOD
    } else if (env.emb_kind === 'gemini') {
        i.configured = !!env.gemini_key
        i.batch_api = env.embed_mode === 'simple'
        i.model = 'embedding-001'
    } else if (env.emb_kind === 'ollama') {
        i.configured = true
        i.url = env.ollama_url
        i.models = OMOD
    } else if (env.emb_kind === 'local') {
        i.configured = !!env.local_model_path
        i.path = env.local_model_path
    } else {
        i.configured = true
        i.type = 'synthetic'
    }
    return i
}
