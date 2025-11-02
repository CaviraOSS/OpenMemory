import { env, tier } from '../config'
import { getModel } from '../config/models'
import { SECTOR_CONFIGS } from '../hsg'
import { q } from '../database'
import { canonicalTokensFromText, addSynonymTokens } from '../utils/text'

let geminiQueue: Promise<any> = Promise.resolve()

export const emb_dim = () => env.vec_dim
export interface EmbeddingResult { sector: string; vector: number[]; dim: number }

// Compress high-dim vector to lower dims (for smart tier)
function compressVector(vec: number[], targetDim: number): number[] {
    if (vec.length <= targetDim) return vec
    const compressed = new Float32Array(targetDim)
    const bucketSize = vec.length / targetDim
    for (let i = 0; i < targetDim; i++) {
        const start = Math.floor(i * bucketSize)
        const end = Math.floor((i + 1) * bucketSize)
        let sum = 0, count = 0
        for (let j = start; j < end && j < vec.length; j++) {
            sum += vec[j]; count++
        }
        compressed[i] = count > 0 ? sum / count : 0
    }
    // Normalize
    let norm = 0
    for (let i = 0; i < targetDim; i++) norm += compressed[i] * compressed[i]
    norm = Math.sqrt(norm)
    if (norm > 0) for (let i = 0; i < targetDim; i++) compressed[i] /= norm
    return Array.from(compressed)
}

// Fuse synthetic + compressed semantic for smart tier
function fuseVectors(synthetic: number[], semantic: number[]): number[] {
    const fused = [...synthetic.map(v => v * 0.6), ...semantic.map(v => v * 0.4)]
    let norm = 0
    for (let i = 0; i < fused.length; i++) norm += fused[i] * fused[i]
    norm = Math.sqrt(norm)
    if (norm > 0) for (let i = 0; i < fused.length; i++) fused[i] /= norm
    return fused
}

export async function embedForSector(t: string, s: string): Promise<number[]> {
    if (!SECTOR_CONFIGS[s]) throw new Error(`Unknown sector: ${s}`)

    // Smart tier: hybrid embedding (synthetic + compressed semantic)
    if (tier === 'smart' && env.emb_kind !== 'synthetic') {
        const synthetic = generateSyntheticEmbedding(t, s)
        const semantic = await getSemanticEmbedding(t, s)
        const compressed = compressVector(semantic, 128)
        return fuseVectors(synthetic, compressed)
    }

    // Fast tier: pure synthetic
    if (tier === 'fast') return generateSyntheticEmbedding(t, s)

    // Deep tier: full AI embedding
    return await getSemanticEmbedding(t, s)
}

async function getSemanticEmbedding(t: string, s: string): Promise<number[]> {
    switch (env.emb_kind) {
        case 'openai': return await embedWithOpenAI(t, s)
        case 'gemini': return (await embedWithGemini({ [s]: t }))[s]
        case 'ollama': return await embedWithOllama(t, s)
        case 'local': return await embedWithLocal(t, s)
        default: return generateSyntheticEmbedding(t, s)
    }
}

async function embedWithOpenAI(t: string, s: string): Promise<number[]> {
    if (!env.openai_key) throw new Error('OpenAI key missing')
    const model = getModel(s, 'openai')
    const r = await fetch(`${env.openai_base_url.replace(/\/$/, '')}/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${env.openai_key}` },
        body: JSON.stringify({ input: t, model: env.openai_model || model, dimensions: env.vec_dim })
    })
    if (!r.ok) throw new Error(`OpenAI: ${r.status}`)
    return ((await r.json()) as any).data[0].embedding
}

async function embedBatchOpenAI(texts: Record<string, string>): Promise<Record<string, number[]>> {
    if (!env.openai_key) throw new Error('OpenAI key missing')
    const sectors = Object.keys(texts)
    const model = getModel('semantic', 'openai')
    const r = await fetch(`${env.openai_base_url.replace(/\/$/, '')}/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${env.openai_key}` },
        body: JSON.stringify({ input: Object.values(texts), model: env.openai_model || model, dimensions: env.vec_dim })
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

async function embedWithOllama(t: string, s: string): Promise<number[]> {
    const model = getModel(s, 'ollama')
    const r = await fetch(`${env.ollama_url}/api/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, prompt: t })
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
        const { createHash } = await import('crypto')
        const h = createHash('sha256').update(t + s).digest()
        const e: number[] = []
        for (let i = 0; i < env.vec_dim; i++) {
            const b1 = h[i % h.length]
            const b2 = h[(i + 1) % h.length]
            e.push((b1 * 256 + b2) / 65535 * 2 - 1)
        }
        const n = Math.sqrt(e.reduce((sum, v) => sum + v * v, 0))
        return e.map(v => v / n)
    } catch {
        console.warn('Local embedding failed, using synthetic')
        return generateSyntheticEmbedding(t, s)
    }
} const hash = (v: string) => {
    let h = 0x811c9dc5 | 0;
    const len = v.length | 0;
    for (let i = 0; i < len; i++) {
        h = Math.imul(h ^ v.charCodeAt(i), 16777619);
    }
    return h >>> 0;
}

// Secondary hash for better distribution
const hash2 = (v: string, seed: number) => {
    let h = seed | 0;
    for (let i = 0; i < v.length; i++) {
        h = Math.imul(h ^ v.charCodeAt(i), 0x5bd1e995);
        h = (h >>> 13) ^ h;
    }
    return h >>> 0;
}

const addFeat = (vec: Float32Array, dim: number, key: string, w: number) => {
    const h = hash(key);
    const h2 = hash2(key, 0xdeadbeef);
    const value = w * (1 - ((h & 1) << 1));

    // Primary feature
    if ((dim > 0) && (dim & (dim - 1)) === 0) {
        vec[h & (dim - 1)] += value;
        // Add secondary feature for better distribution
        vec[h2 & (dim - 1)] += value * 0.5;
    } else {
        vec[h % dim] += value;
        vec[h2 % dim] += value * 0.5;
    }
}

// Positional encoding (sin/cos) for word order
const addPositionalFeat = (vec: Float32Array, dim: number, pos: number, w: number) => {
    const idx = pos % dim;
    const angle = pos / Math.pow(10000, (2 * idx) / dim);
    vec[idx] += w * Math.sin(angle);
    vec[(idx + 1) % dim] += w * Math.cos(angle);
}

// Sector-specific weights for domain adaptation
const SECTOR_WEIGHTS: Record<string, number> = {
    episodic: 1.3,    // Boost temporal/narrative features
    semantic: 1.0,     // Baseline
    procedural: 1.2,   // Boost sequential patterns
    emotional: 1.4,    // Boost sentiment features
    reflective: 0.9    // Lower weight for abstract concepts
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

export function generateSyntheticEmbedding(t: string, s: string): number[] {
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

    // Token frequency counting
    for (let i = 0; i < etLength; i++) {
        const tok = et[i];
        tc.set(tok, (tc.get(tok) || 0) + 1)
    }

    // Sector-specific weight
    const sectorWeight = SECTOR_WEIGHTS[s] || 1.0

    // Document length for TF-IDF-like normalization
    const docLen = Math.log(1 + etLength)

    // === 1. UNIGRAM FEATURES (TF-IDF weighted) ===
    for (const [tok, c] of tc) {
        const tf = c / etLength  // Term frequency
        const idf = Math.log(1 + etLength / c)  // Inverse document frequency approximation
        const w = (tf * idf + 1) * sectorWeight
        addFeat(v, d, `${s}|tok|${tok}`, w)

        // Character n-grams for robustness (3-5 chars)
        if (tok.length >= 3) {
            for (let i = 0; i < tok.length - 2; i++) {
                addFeat(v, d, `${s}|c3|${tok.slice(i, i + 3)}`, w * 0.4)
            }
        }
        if (tok.length >= 4) {
            for (let i = 0; i < tok.length - 3; i++) {
                addFeat(v, d, `${s}|c4|${tok.slice(i, i + 4)}`, w * 0.3)
            }
        }
    }

    // === 2. BIGRAM FEATURES (sequential patterns) ===
    for (let i = 0; i < ct.length - 1; i++) {
        const a = ct[i], b = ct[i + 1]
        if (a && b) {
            // Position-weighted bigrams (early words matter more)
            const posWeight = 1.0 / (1.0 + i * 0.1)
            addFeat(v, d, `${s}|bi|${a}_${b}`, 1.4 * sectorWeight * posWeight)
        }
    }

    // === 3. TRIGRAM FEATURES (phrase patterns) ===
    for (let i = 0; i < ct.length - 2; i++) {
        const a = ct[i], b = ct[i + 1], c = ct[i + 2]
        if (a && b && c) {
            addFeat(v, d, `${s}|tri|${a}_${b}_${c}`, 1.0 * sectorWeight)
        }
    }

    // === 4. SKIP-GRAM FEATURES (long-range dependencies) ===
    for (let i = 0; i < Math.min(ct.length - 2, 20); i++) {
        const a = ct[i], c = ct[i + 2]
        if (a && c) {
            addFeat(v, d, `${s}|skip|${a}_${c}`, 0.7 * sectorWeight)
        }
    }

    // === 5. POSITIONAL ENCODING (word order) ===
    for (let i = 0; i < Math.min(ct.length, 50); i++) {
        addPositionalFeat(v, d, i, 0.5 * sectorWeight / docLen)
    }

    // === 6. DOCUMENT LENGTH SIGNAL ===
    const lenBucket = Math.min(Math.floor(Math.log2(etLength + 1)), 10)
    addFeat(v, d, `${s}|len|${lenBucket}`, 0.6 * sectorWeight)

    // === 7. SEMANTIC DENSITY (unique words / total words) ===
    const density = tc.size / etLength
    const densityBucket = Math.floor(density * 10)
    addFeat(v, d, `${s}|dens|${densityBucket}`, 0.5 * sectorWeight)

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
        i.models = { episodic: getModel('episodic', 'openai'), semantic: getModel('semantic', 'openai'), procedural: getModel('procedural', 'openai'), emotional: getModel('emotional', 'openai'), reflective: getModel('reflective', 'openai') }
    } else if (env.emb_kind === 'gemini') {
        i.configured = !!env.gemini_key
        i.batch_api = env.embed_mode === 'simple'
        i.model = 'embedding-001'
    } else if (env.emb_kind === 'ollama') {
        i.configured = true
        i.url = env.ollama_url
        i.models = { episodic: getModel('episodic', 'ollama'), semantic: getModel('semantic', 'ollama'), procedural: getModel('procedural', 'ollama'), emotional: getModel('emotional', 'ollama'), reflective: getModel('reflective', 'ollama') }
    } else if (env.emb_kind === 'local') {
        i.configured = !!env.local_model_path
        i.path = env.local_model_path
    } else {
        i.configured = true
        i.type = 'synthetic'
    }
    return i
}
