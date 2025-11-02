import crypto from 'node:crypto'
import { canonical_token_set } from '../utils/text'
import { inc_q, dec_q } from './decay'
import { env, tier } from '../core/cfg'
import { cos_sim, buf_to_vec, vec_to_buf } from '../utils/index'
export interface sector_cfg {
    model: string
    decay_lambda: number
    weight: number
    patterns: RegExp[]
}
export interface sector_class {
    primary: string
    additional: string[]
    confidence: number
}
export interface hsg_mem {
    id: string
    content: string
    primary_sector: string
    sectors: string[]
    tags?: string
    meta?: any
    created_at: number
    updated_at: number
    last_seen_at: number
    salience: number
    decay_lambda: number
    version: number
}
export interface waypoint {
    src_id: string
    dst_id: string
    weight: number
    created_at: number
    updated_at: number
}
export interface hsg_q_result {
    id: string
    content: string
    score: number
    sectors: string[]
    primary_sector: string
    path: string[]
    salience: number
    last_seen_at: number
}
export const sector_configs: Record<string, sector_cfg> = {
    episodic: {
        model: 'episodic-optimized',
        decay_lambda: 0.015,
        weight: 1.2,
        patterns: [
            /\b(today|yesterday|last\s+week|remember\s+when|that\s+time)\b/i,
            /\b(I\s+(did|went|saw|met|felt))\b/i,
            /\b(at\s+\d+:\d+|on\s+\w+day|in\s+\d{4})\b/i,
            /\b(happened|occurred|experience|event|moment)\b/i
        ]
    },
    semantic: {
        model: 'semantic-optimized',
        decay_lambda: 0.005,
        weight: 1.0,
        patterns: [
            /\b(define|definition|meaning|concept|theory)\b/i,
            /\b(what\s+is|how\s+does|why\s+do|facts?\s+about)\b/i,
            /\b(principle|rule|law|algorithm|method)\b/i,
            /\b(knowledge|information|data|research|study)\b/i
        ]
    },
    procedural: {
        model: 'procedural-optimized',
        decay_lambda: 0.008,
        weight: 1.1,
        patterns: [
            /\b(how\s+to|step\s+by\s+step|procedure|process)\b/i,
            /\b(first|then|next|finally|afterwards)\b/i,
            /\b(install|configure|setup|run|execute)\b/i,
            /\b(tutorial|guide|instructions|manual)\b/i,
            /\b(click|press|type|enter|select)\b/i
        ]
    },
    emotional: {
        model: 'emotional-optimized',
        decay_lambda: 0.020,
        weight: 1.3,
        patterns: [
            /\b(feel|feeling|felt|emotion|mood)\b/i,
            /\b(happy|sad|angry|excited|worried|anxious|calm)\b/i,
            /\b(love|hate|like|dislike|enjoy|fear)\b/i,
            /\b(amazing|terrible|wonderful|awful|fantastic|horrible)\b/i,
            /[!]{2,}|[\?\!]{2,}/
        ]
    },
    reflective: {
        model: 'reflective-optimized',
        decay_lambda: 0.001,
        weight: 0.8,
        patterns: [
            /\b(think|thinking|thought|reflect|reflection)\b/i,
            /\b(realize|understand|insight|conclusion|lesson)\b/i,
            /\b(why|purpose|meaning|significance|impact)\b/i,
            /\b(philosophy|wisdom|belief|value|principle)\b/i,
            /\b(should\s+have|could\s+have|if\s+only|what\s+if)\b/i
        ]
    }
}
export const sectors = Object.keys(sector_configs)
export const scoring_weights = {
    similarity: 0.6,
    overlap: 0.2,
    waypoint: 0.15,
    recency: 0.05
}
export const hybrid_params = {
    tau: 3,
    beta: 2,
    eta: 0.1,
    gamma: 0.2,
    alpha_reinforce: 0.08,
    t_days: 7,
    t_max_days: 60,
    tau_hours: 1,
    epsilon: 1e-8
}
export const reinforcement = {
    salience_boost: 0.1,
    waypoint_boost: 0.05,
    max_salience: 1.0,
    max_waypoint_weight: 1.0,
    prune_threshold: 0.05
}

const compress_vec_for_storage = (vec: number[], target_dim: number): number[] => {
    if (vec.length <= target_dim) return vec
    const compressed = new Float32Array(target_dim)
    const bucket_sz = vec.length / target_dim
    for (let i = 0; i < target_dim; i++) {
        const start = Math.floor(i * bucket_sz)
        const end = Math.floor((i + 1) * bucket_sz)
        let sum = 0, count = 0
        for (let j = start; j < end && j < vec.length; j++) {
            sum += vec[j]; count++
        }
        compressed[i] = count > 0 ? sum / count : 0
    }
    let norm = 0
    for (let i = 0; i < target_dim; i++)norm += compressed[i] * compressed[i]
    norm = Math.sqrt(norm)
    if (norm > 0) for (let i = 0; i < target_dim; i++)compressed[i] /= norm
    return Array.from(compressed)
}

export function classify_content(content: string, metadata?: any): sector_class {
    if (metadata?.sector && sectors.includes(metadata.sector)) {
        return {
            primary: metadata.sector,
            additional: [],
            confidence: 1.0
        }
    }
    const scores: Record<string, number> = {}
    for (const [sector, config] of Object.entries(sector_configs)) {
        let score = 0
        for (const pattern of config.patterns) {
            const matches = content.match(pattern)
            if (matches) {
                score += matches.length * config.weight
            }
        }
        scores[sector] = score
    }
    const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a)
    const primary = sortedScores[0][0]
    const primaryScore = sortedScores[0][1]
    const threshold = Math.max(1, primaryScore * 0.3)
    const additional = sortedScores
        .slice(1)
        .filter(([, score]) => score > 0 && score >= threshold)
        .map(([sector]) => sector)
    const confidence = primaryScore > 0 ?
        Math.min(1.0, primaryScore / (primaryScore + (sortedScores[1]?.[1] || 0) + 1)) :
        0.2
    return {
        primary: primaryScore > 0 ? primary : 'semantic',
        additional,
        confidence
    }
}
export function calc_decay(sec: string, init_sal: number, days_since: number, seg_idx?: number, max_seg?: number): number {
    const cfg = sector_configs[sec]
    if (!cfg) return init_sal
    let lambda = cfg.decay_lambda
    if (seg_idx !== undefined && max_seg !== undefined && max_seg > 0) {
        const seg_ratio = Math.sqrt(seg_idx / max_seg)
        lambda = lambda * (1 - seg_ratio)
    }
    const decayed = init_sal * Math.exp(-lambda * days_since)
    const reinf = hybrid_params.alpha_reinforce * (1 - Math.exp(-lambda * days_since))
    return Math.max(0, Math.min(1, decayed + reinf))
}
export function calc_recency_score(last_seen: number): number {
    const now = Date.now()
    const days_since = (now - last_seen) / (1000 * 60 * 60 * 24)
    const t = hybrid_params.t_days
    const tmax = hybrid_params.t_max_days
    return Math.exp(-days_since / t) * (1 - days_since / tmax)
}
export function boosted_sim(s: number): number {
    return 1 - Math.exp(-hybrid_params.tau * s)
}
export function compute_simhash(text: string): string {
    const tokens = canonical_token_set(text)
    const hashes = Array.from(tokens).map(t => {
        let h = 0
        for (let i = 0; i < t.length; i++) {
            h = ((h << 5) - h) + t.charCodeAt(i)
            h = h & h
        }
        return h
    })
    const vec = new Array(64).fill(0)
    for (const h of hashes) {
        for (let i = 0; i < 64; i++) {
            if (h & (1 << i)) vec[i]++
            else vec[i]--
        }
    }
    let hash = ''
    for (let i = 0; i < 64; i += 4) {
        const nibble = (vec[i] > 0 ? 8 : 0) + (vec[i + 1] > 0 ? 4 : 0) + (vec[i + 2] > 0 ? 2 : 0) + (vec[i + 3] > 0 ? 1 : 0)
        hash += nibble.toString(16)
    }
    return hash
}
export function hamming_dist(hash1: string, hash2: string): number {
    let dist = 0
    for (let i = 0; i < hash1.length; i++) {
        const xor = parseInt(hash1[i], 16) ^ parseInt(hash2[i], 16)
        dist += (xor & 8 ? 1 : 0) + (xor & 4 ? 1 : 0) + (xor & 2 ? 1 : 0) + (xor & 1 ? 1 : 0)
    }
    return dist
}
export function sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x))
}
export function extract_essence(raw: string, sec: string, max_len: number): string {
    if (!env.use_summary_only || raw.length <= max_len) return raw
    const sents = raw.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10)
    if (sents.length === 0) return raw.slice(0, max_len)
    const score_sent = (s: string): number => {
        let sc = 0
        if (/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d+/i.test(s)) sc += 5
        if (/\$\d+|\d+\s*(miles|dollars|years|months|km)/.test(s)) sc += 4
        if (/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(s)) sc += 3
        if (/\b(bought|purchased|serviced|visited|went|got|received|paid|earned|learned|discovered|found|saw|met|completed|finished)\b/i.test(s)) sc += 4
        if (/\b(who|what|when|where|why|how)\b/i.test(s)) sc += 2
        if (s.length < 80) sc += 2
        if (/\b(I|my|me)\b/.test(s)) sc += 1
        return sc
    }
    const scored = sents.map(s => ({ text: s, score: score_sent(s) }))
    scored.sort((a, b) => b.score - a.score)
    let comp = ''
    for (const item of scored) {
        const cand = comp ? `${comp}. ${item.text}` : item.text
        if (cand.length <= max_len) {
            comp = cand
        } else if (comp.length < max_len * 0.7) {
            const rem = max_len - comp.length - 2
            if (rem > 20) {
                comp += '. ' + item.text.slice(0, rem)
            }
            break
        } else {
            break
        }
    }
    return comp || raw.slice(0, max_len)
}
export function compute_token_overlap(q_toks: Set<string>, mem_toks: Set<string>): number {
    if (q_toks.size === 0) return 0
    let ov = 0
    for (const t of q_toks) {
        if (mem_toks.has(t)) ov++
    }
    return ov / q_toks.size
}
export function compute_hybrid_score(
    sim: number,
    tok_ov: number,
    wp_wt: number,
    rec_sc: number
): number {
    const s_p = boosted_sim(sim)
    const raw = scoring_weights.similarity * s_p +
        scoring_weights.overlap * tok_ov +
        scoring_weights.waypoint * wp_wt +
        scoring_weights.recency * rec_sc
    return sigmoid(raw)
}
import { q, transaction } from '../core/db'
export async function create_cross_sector_waypoints(
    prim_id: string,
    prim_sec: string,
    add_secs: string[]
): Promise<void> {
    const now = Date.now()
    const wt = 0.5
    for (const sec of add_secs) {
        await q.ins_waypoint.run(prim_id, `${prim_id}:${sec}`, wt, now, now)
        await q.ins_waypoint.run(`${prim_id}:${sec}`, prim_id, wt, now, now)
    }
}
export function calc_mean_vec(emb_res: EmbeddingResult[], secs: string[]): number[] {
    const dim = emb_res[0].vector.length
    const wsum = new Array(dim).fill(0)
    const sec_scores = emb_res.map(r => ({
        vector: r.vector,
        confidence: sector_configs[r.sector]?.weight || 1.0
    }))
    const beta = hybrid_params.beta
    const exp_sum = sec_scores.reduce((sum, s) => sum + Math.exp(beta * s.confidence), 0)
    for (const result of emb_res) {
        const sec_wt = sector_configs[result.sector]?.weight || 1.0
        const sm_wt = Math.exp(beta * sec_wt) / exp_sum
        for (let i = 0; i < dim; i++) {
            wsum[i] += result.vector[i] * sm_wt
        }
    }
    const norm = Math.sqrt(wsum.reduce((sum, v) => sum + v * v, 0)) + hybrid_params.epsilon
    return wsum.map(v => v / norm)
}
export async function create_single_waypoint(
    new_id: string,
    new_mean: number[],
    ts: number
): Promise<void> {
    const thresh = 0.75
    const mems = await q.all_mem.all(1000, 0)
    let best: { id: string, similarity: number } | null = null
    for (const mem of mems) {
        if (mem.id === new_id || !mem.mean_vec) continue
        const ex_mean = buf_to_vec(mem.mean_vec)
        const sim = cos_sim(new Float32Array(new_mean), ex_mean)
        if (!best || sim > best.similarity) {
            best = { id: mem.id, similarity: sim }
        }
    }
    if (best) {
        await q.ins_waypoint.run(new_id, best.id, best.similarity, ts, ts)
    } else {
        await q.ins_waypoint.run(new_id, new_id, 1.0, ts, ts)
    }
}
export async function create_inter_mem_waypoints(
    new_id: string,
    prim_sec: string,
    new_vec: number[],
    ts: number
): Promise<void> {
    const thresh = 0.75
    const wt = 0.5
    const vecs = await q.get_vecs_by_sector.all(prim_sec)
    for (const vr of vecs) {
        if (vr.id === new_id) continue
        const ex_vec = buf_to_vec(vr.v)
        const sim = cos_sim(new Float32Array(new_vec), ex_vec)
        if (sim >= thresh) {
            await q.ins_waypoint.run(new_id, vr.id, wt, ts, ts)
            await q.ins_waypoint.run(vr.id, new_id, wt, ts, ts)
        }
    }
}
export async function create_contextual_waypoints(
    mem_id: string,
    rel_ids: string[],
    base_wt: number = 0.3
): Promise<void> {
    const now = Date.now()
    for (const rel_id of rel_ids) {
        if (mem_id === rel_id) continue
        const existing = await q.get_waypoint.get(mem_id, rel_id)
        if (existing) {
            const new_wt = Math.min(1.0, existing.weight + 0.1)
            await q.upd_waypoint.run(new_wt, now, mem_id, rel_id)
        } else {
            await q.ins_waypoint.run(mem_id, rel_id, base_wt, now, now)
        }
    }
}
export async function expand_via_waypoints(
    init_res: string[],
    max_exp: number = 10
): Promise<Array<{ id: string, weight: number, path: string[] }>> {
    const exp: Array<{ id: string, weight: number, path: string[] }> = []
    const vis = new Set<string>()
    for (const id of init_res) {
        exp.push({ id, weight: 1.0, path: [id] })
        vis.add(id)
    }
    const q_arr = [...exp]
    let exp_cnt = 0
    while (q_arr.length > 0 && exp_cnt < max_exp) {
        const cur = q_arr.shift()!
        const neighs = await q.get_neighbors.all(cur.id)
        for (const neigh of neighs) {
            if (vis.has(neigh.dst_id)) continue
            const exp_wt = cur.weight * neigh.weight * 0.8
            if (exp_wt < 0.1) continue
            const exp_item = {
                id: neigh.dst_id,
                weight: exp_wt,
                path: [...cur.path, neigh.dst_id]
            }
            exp.push(exp_item)
            vis.add(neigh.dst_id)
            q_arr.push(exp_item)
            exp_cnt++
        }
    }
    return exp
}
export async function reinforce_waypoints(trav_path: string[]): Promise<void> {
    const now = Date.now()
    for (let i = 0; i < trav_path.length - 1; i++) {
        const src_id = trav_path[i]
        const dst_id = trav_path[i + 1]
        const wp = await q.get_waypoint.get(src_id, dst_id)
        if (wp) {
            const new_wt = Math.min(reinforcement.max_waypoint_weight,
                wp.weight + reinforcement.waypoint_boost)
            await q.upd_waypoint.run(new_wt, now, src_id, dst_id)
        }
    }
}
export async function prune_weak_waypoints(): Promise<number> {
    await q.prune_waypoints.run(reinforcement.prune_threshold)
    return 0
}
import { embedForSector, embedMultiSector, cosineSimilarity, bufferToVector, vectorToBuffer, EmbeddingResult } from './embed'
import { chunk_text } from '../utils/chunking'
import { j } from '../utils'
import {
    calculateCrossSectorResonanceScore,
    applyRetrievalTraceReinforcementToMemory,
    propagateAssociativeReinforcementToLinkedNodes,
    ALPHA_LEARNING_RATE_FOR_RECALL_REINFORCEMENT,
    BETA_LEARNING_RATE_FOR_EMOTIONAL_FREQUENCY
} from '../ops/dynamics'
export interface multi_vec_fusion_weights {
    semantic_dimension_weight: number
    emotional_dimension_weight: number
    procedural_dimension_weight: number
    temporal_dimension_weight: number
    reflective_dimension_weight: number
}
export async function calc_multi_vec_fusion_score(
    mid: string,
    qe: Record<string, number[]>,
    w: multi_vec_fusion_weights
): Promise<number> {
    const vecs = await q.get_vecs_by_id.all(mid)
    let sum = 0, tot = 0
    const wm: Record<string, number> = { semantic: w.semantic_dimension_weight, emotional: w.emotional_dimension_weight, procedural: w.procedural_dimension_weight, episodic: w.temporal_dimension_weight, reflective: w.reflective_dimension_weight }
    for (const v of vecs) {
        const qv = qe[v.sector]
        if (!qv) continue
        const mv = bufferToVector(v.v)
        const sim = cosineSimilarity(qv, mv)
        const wgt = wm[v.sector] || 0.5
        sum += sim * wgt
        tot += wgt
    }
    return tot > 0 ? sum / tot : 0
}
const cache = new Map<string, { r: hsg_q_result[], t: number }>()
const sal_cache = new Map<string, { s: number, t: number }>()
const vec_cache = new Map<string, { v: number[], t: number }>()
const seg_cache = new Map<number, any[]>()
const coact_buf: Array<[string, string]> = []
const TTL = 60000
const VEC_CACHE_MAX = 1000
let active_queries = 0
const get_vec = (id: string, v: Buffer): number[] => {
    const ck = vec_cache.get(id)
    if (ck && Date.now() - ck.t < TTL) return ck.v
    const vec = bufferToVector(v)
    vec_cache.set(id, { v: vec, t: Date.now() })
    if (vec_cache.size > VEC_CACHE_MAX) {
        const first = vec_cache.keys().next().value
        if (first) vec_cache.delete(first)
    }
    return vec
}
const get_segment = async (seg: number): Promise<any[]> => {
    if (seg_cache.has(seg)) return seg_cache.get(seg)!
    const rows = await q.get_mem_by_segment.all(seg)
    seg_cache.set(seg, rows)
    if (seg_cache.size > env.cache_segments) {
        const first = seg_cache.keys().next().value
        if (first !== undefined) seg_cache.delete(first)
    }
    return rows
}
setInterval(async () => {
    if (!coact_buf.length) return
    const pairs = coact_buf.splice(0, 50)
    const now = Date.now()
    const tau_ms = hybrid_params.tau_hours * 3600000
    for (const [a, b] of pairs) {
        try {
            const [memA, memB] = await Promise.all([q.get_mem.get(a), q.get_mem.get(b)])
            if (!memA || !memB) continue
            const time_diff = Math.abs(memA.last_seen_at - memB.last_seen_at)
            const temp_fact = Math.exp(-time_diff / tau_ms)
            const wp = await q.get_waypoint.get(a, b)
            const cur_wt = wp?.weight || 0
            const new_wt = Math.min(1, cur_wt + hybrid_params.eta * (1 - cur_wt) * temp_fact)
            await q.ins_waypoint.run(a, b, new_wt, wp?.created_at || now, now)
        } catch (e) {
        }
    }
}, 1000)
const get_sal = async (id: string, def_sal: number): Promise<number> => {
    const c = sal_cache.get(id)
    if (c && Date.now() - c.t < TTL) return c.s
    const m = await q.get_mem.get(id)
    const s = m?.salience ?? def_sal
    sal_cache.set(id, { s, t: Date.now() })
    return s
}
export async function hsg_query(qt: string, k = 10, f?: { sectors?: string[], minSalience?: number, user_id?: string }): Promise<hsg_q_result[]> {
    if (active_queries >= env.max_active) {
        throw new Error(`Rate limit: ${active_queries} active queries (max ${env.max_active})`)
    }
    active_queries++
    inc_q()
    try {
        const h = `${qt}:${k}:${JSON.stringify(f || {})}`
        const cached = cache.get(h)
        if (cached && Date.now() - cached.t < TTL) return cached.r
        const qc = classify_content(qt)
        const cs = [qc.primary, ...qc.additional]
        const qtk = canonical_token_set(qt)
        const ss = f?.sectors?.length ? cs.filter(s => f.sectors!.includes(s)) : cs
        if (!ss.length) ss.push('semantic')
        const qe: Record<string, number[]> = {}
        for (const s of ss) qe[s] = await embedForSector(qt, s)
        const w: multi_vec_fusion_weights = {
            semantic_dimension_weight: qc.primary === 'semantic' ? 1.2 : 0.8,
            emotional_dimension_weight: qc.primary === 'emotional' ? 1.5 : 0.6,
            procedural_dimension_weight: qc.primary === 'procedural' ? 1.3 : 0.7,
            temporal_dimension_weight: qc.primary === 'episodic' ? 1.4 : 0.7,
            reflective_dimension_weight: qc.primary === 'reflective' ? 1.1 : 0.5
        }
        const sr: Record<string, Array<{ id: string, similarity: number }>> = {}
        for (const s of ss) {
            const qv = qe[s]
            const vecs = await q.get_vecs_by_sector.all(s)
            const sims: Array<{ id: string, similarity: number }> = []
            for (const vr of vecs) {
                const mv = get_vec(vr.id, vr.v)
                const sim = cosineSimilarity(qv, mv)
                sims.push({ id: vr.id, similarity: sim })
            }
            sims.sort((a, b) => b.similarity - a.similarity)
            sr[s] = sims.slice(0, k * 3)
        }
        const all_sims = Object.values(sr).flatMap(r => r.slice(0, 8).map(x => x.similarity))
        const avg_top = all_sims.length ? all_sims.reduce((a, b) => a + b, 0) / all_sims.length : 0
        const adapt_exp = Math.ceil(0.3 * k * (1 - avg_top))
        const eff_k = k + adapt_exp
        const high_conf = avg_top >= 0.55
        const ids = new Set<string>()
        for (const r of Object.values(sr)) for (const x of r) ids.add(x.id)
        const exp = high_conf ? [] : await expand_via_waypoints(Array.from(ids), k * 2)
        for (const e of exp) ids.add(e.id)
        const res: hsg_q_result[] = []
        for (const mid of Array.from(ids)) {
            const m = await q.get_mem.get(mid)
            if (!m || (f?.minSalience && m.salience < f.minSalience)) continue
            if (f?.user_id && m.user_id !== f.user_id) continue
            const mvf = await calc_multi_vec_fusion_score(mid, qe, w)
            const csr = await calculateCrossSectorResonanceScore(m.primary_sector, qc.primary, mvf)
            let bs = csr, bsec = m.primary_sector
            for (const [sec, rr] of Object.entries(sr)) {
                const mat = rr.find(r => r.id === mid)
                if (mat && mat.similarity > bs) { bs = mat.similarity; bsec = sec }
            }
            const em = exp.find((e: { id: string }) => e.id === mid)
            const ww = em?.weight || 0
            const ds = (Date.now() - m.last_seen_at) / 86400000
            const sal = calc_decay(m.primary_sector, m.salience, ds)
            const mtk = canonical_token_set(m.content)
            const tok_ov = compute_token_overlap(qtk, mtk)
            const rec_sc = calc_recency_score(m.last_seen_at)
            const fs = compute_hybrid_score(bs, tok_ov, ww, rec_sc)
            const msec = await q.get_vecs_by_id.all(mid)
            const sl = msec.map(v => v.sector)
            res.push({ id: mid, content: m.content, score: fs, sectors: sl, primary_sector: m.primary_sector, path: em?.path || [mid], salience: sal, last_seen_at: m.last_seen_at })
        }
        res.sort((a, b) => b.score - a.score)
        const top_cands = res.slice(0, eff_k)
        if (top_cands.length > 0) {
            const scores = top_cands.map(r => r.score)
            const mean = scores.reduce((a, b) => a + b, 0) / scores.length
            const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length
            const stdDev = Math.sqrt(variance)
            for (const r of top_cands) {
                r.score = (r.score - mean) / (stdDev + hybrid_params.epsilon)
            }
            top_cands.sort((a, b) => b.score - a.score)
        }
        const top = top_cands.slice(0, k)
        const tids = top.map(r => r.id)

        // Update feedback scores for returned memories (simple learning)
        for (const r of top) {
            const cur_fb = (await q.get_mem.get(r.id))?.feedback_score || 0
            const new_fb = cur_fb * 0.9 + r.score * 0.1  // Exponential moving average
            await q.upd_feedback.run(r.id, new_fb)
        }

        for (let i = 0; i < tids.length; i++) {
            for (let j = i + 1; j < tids.length; j++) {
                const [a, b] = [tids[i], tids[j]].sort()
                coact_buf.push([a, b])
            }
        }
        for (const r of top) {
            const rsal = await applyRetrievalTraceReinforcementToMemory(r.id, r.salience)
            await q.upd_seen.run(r.id, Date.now(), rsal, Date.now())
            if (r.path.length > 1) {
                await reinforce_waypoints(r.path)
                const wps = await q.get_waypoints_by_src.all(r.id)
                const lns = wps.map((wp: any) => ({ target_id: wp.dst_id, weight: wp.weight }))
                const pru = await propagateAssociativeReinforcementToLinkedNodes(r.id, rsal, lns)
                for (const u of pru) {
                    const linked_mem = await q.get_mem.get(u.node_id)
                    if (linked_mem) {
                        const time_diff = (Date.now() - linked_mem.last_seen_at) / 86400000
                        const decay_fact = Math.exp(-0.02 * time_diff)
                        const ctx_boost = hybrid_params.gamma * (rsal - linked_mem.salience) * decay_fact
                        const new_sal = Math.max(0, Math.min(1, linked_mem.salience + ctx_boost))
                        await q.upd_seen.run(u.node_id, Date.now(), new_sal, Date.now())
                    }
                }
            }
        }
        cache.set(h, { r: top, t: Date.now() })
        return top
    } finally {
        active_queries--
        dec_q()
    }
}
export async function run_decay_process(): Promise<{ processed: number, decayed: number }> {
    const mems = await q.all_mem.all(10000, 0)
    let p = 0, d = 0
    for (const m of mems) {
        const ds = (Date.now() - m.last_seen_at) / 86400000
        const ns = calc_decay(m.primary_sector, m.salience, ds)
        if (ns !== m.salience) { await q.upd_seen.run(m.id, m.last_seen_at, ns, Date.now()); d++ }
        p++
    }
    return { processed: p, decayed: d }
}
export async function add_hsg_memory(
    content: string,
    tags?: string,
    metadata?: any,
    user_id?: string
): Promise<{ id: string, primary_sector: string, sectors: string[], chunks?: number, deduplicated?: boolean }> {
    const simhash = compute_simhash(content)
    const existing = await q.get_mem_by_simhash.get(simhash)
    if (existing && hamming_dist(simhash, existing.simhash) <= 3) {
        const now = Date.now()
        const boosted_sal = Math.min(1, existing.salience + 0.15)
        await q.upd_seen.run(existing.id, now, boosted_sal, now)
        return {
            id: existing.id,
            primary_sector: existing.primary_sector,
            sectors: [existing.primary_sector],
            deduplicated: true
        }
    }
    const id = crypto.randomUUID()
    const now = Date.now()
    const chunks = chunk_text(content)
    const use_chunking = chunks.length > 1
    const classification = classify_content(content, metadata)
    const all_sectors = [classification.primary, ...classification.additional]
    await transaction.begin()
    try {
        const max_seg_res = await q.get_max_segment.get()
        let cur_seg = max_seg_res?.max_seg ?? 0
        const seg_cnt_res = await q.get_segment_count.get(cur_seg)
        const seg_cnt = seg_cnt_res?.c ?? 0
        if (seg_cnt >= env.seg_size) {
            cur_seg++
            console.log(`[HSG] Rotated to segment ${cur_seg} (previous segment full: ${seg_cnt} memories)`)
        }
        const stored_content = extract_essence(content, classification.primary, env.summary_max_length)
        const sec_cfg = sector_configs[classification.primary]
        const init_sal = Math.max(0, Math.min(1, 0.4 + 0.1 * classification.additional.length))
        await q.ins_mem.run(
            id,
            user_id || null,
            cur_seg,
            stored_content,
            simhash,
            classification.primary,
            tags || null,
            JSON.stringify(metadata || {}),
            now,
            now,
            now,
            init_sal,
            sec_cfg.decay_lambda,
            1,
            null,
            null,
            null,  // compressed_vec
            0      // feedback_score
        )
        const emb_res = await embedMultiSector(id, content, all_sectors, use_chunking ? chunks : undefined)
        for (const result of emb_res) {
            const vec_buf = vectorToBuffer(result.vector)
            await q.ins_vec.run(id, result.sector, vec_buf, result.dim)
        }
        const mean_vec = calc_mean_vec(emb_res, all_sectors)
        const mean_vec_buf = vectorToBuffer(mean_vec)
        await q.upd_mean_vec.run(id, mean_vec.length, mean_vec_buf)

        // Store compressed vector for smart tier (for future query optimization)
        if (tier === 'smart' && mean_vec.length > 128) {
            const comp = compress_vec_for_storage(mean_vec, 128)
            const comp_buf = vectorToBuffer(comp)
            await q.upd_compressed_vec.run(comp_buf, id)
        }

        await create_single_waypoint(id, mean_vec, now)
        await transaction.commit()
        return {
            id,
            primary_sector: classification.primary,
            sectors: all_sectors,
            chunks: chunks.length
        }
    } catch (error) {
        await transaction.rollback()
        throw error
    }
}
export async function reinforce_memory(id: string, boost: number = 0.1): Promise<void> {
    const mem = await q.get_mem.get(id)
    if (!mem) throw new Error(`Memory ${id} not found`)
    const new_sal = Math.min(reinforcement.max_salience, mem.salience + boost)
    await q.upd_seen.run(Date.now(), new_sal, Date.now(), id)
}
export async function update_memory(
    id: string,
    content?: string,
    tags?: string[],
    metadata?: any
): Promise<{ id: string, updated: boolean }> {
    const mem = await q.get_mem.get(id)
    if (!mem) throw new Error(`Memory ${id} not found`)
    const new_content = content !== undefined ? content : mem.content
    const new_tags = tags !== undefined ? j(tags) : (mem.tags || '[]')
    const new_meta = metadata !== undefined ? j(metadata) : (mem.meta || '{}')
    await transaction.begin()
    try {
        if (content !== undefined && content !== mem.content) {
            const chunks = chunk_text(new_content)
            const use_chunking = chunks.length > 1
            const classification = classify_content(new_content, metadata)
            const all_sectors = [classification.primary, ...classification.additional]
            await q.del_vec.run(id)
            const emb_res = await embedMultiSector(id, new_content, all_sectors, use_chunking ? chunks : undefined)
            for (const result of emb_res) {
                const vec_buf = vectorToBuffer(result.vector)
                await q.ins_vec.run(id, result.sector, vec_buf, result.dim)
            }
            const mean_vec = calc_mean_vec(emb_res, all_sectors)
            const mean_vec_buf = vectorToBuffer(mean_vec)
            await q.upd_mean_vec.run(id, mean_vec.length, mean_vec_buf)
            await q.upd_mem_with_sector.run(new_content, classification.primary, new_tags, new_meta, Date.now(), id)
        } else {
            await q.upd_mem.run(new_content, new_tags, new_meta, Date.now(), id)
        }
        await transaction.commit()
        return { id, updated: true }
    } catch (error) {
        await transaction.rollback()
        throw error
    }
}
