import crypto from "node:crypto";
import { canonical_token_set } from "../utils/text";
import { inc_q, dec_q, on_query_hit } from "./decay";
import { env, tier } from "../core/cfg";
import { cos_sim, buf_to_vec, vec_to_buf } from "../utils/index";
export interface sector_cfg {
    model: string;
    decay_lambda: number;
    weight: number;
    patterns: RegExp[];
}
export interface sector_class {
    primary: string;
    additional: string[];
    confidence: number;
}
export interface hsg_mem {
    id: string;
    content: string;
    primary_sector: string;
    sectors: string[];
    tags?: string;
    meta?: any;
    created_at: number;
    updated_at: number;
    last_seen_at: number;
    salience: number;
    decay_lambda: number;
    version: number;
}
export interface waypoint {
    src_id: string;
    dst_id: string;
    weight: number;
    created_at: number;
    updated_at: number;
}
export interface hsg_q_result {
    id: string;
    content: string;
    score: number;
    sectors: string[];
    primary_sector: string;
    path: string[];
    salience: number;
    last_seen_at: number;
    tags?: string[];
    meta?: any;
}
export const sector_configs: Record<string, sector_cfg> = {
    episodic: {
        model: "episodic-optimized",
        decay_lambda: 0.015,
        weight: 1.2,
        patterns: [
            /\b(today|yesterday|tomorrow|last\s+(week|month|year)|next\s+(week|month|year))\b/i,
            /\b(remember\s+when|recall|that\s+time|when\s+I|I\s+was|we\s+were)\b/i,
            /\b(went|saw|met|felt|heard|visited|attended|participated)\b/i,
            /\b(at\s+\d{1,2}:\d{2}|on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
            /\b(event|moment|experience|incident|occurrence|happened)\b/i,
            /\bI\s+'?m\s+going\s+to\b/i,
        ],
    },
    semantic: {
        model: "semantic-optimized",
        decay_lambda: 0.005,
        weight: 1.0,
        patterns: [
            /\b(is\s+a|represents|means|stands\s+for|defined\s+as)\b/i,
            /\b(concept|theory|principle|law|hypothesis|theorem|axiom)\b/i,
            /\b(fact|statistic|data|evidence|proof|research|study|report)\b/i,
            /\b(capital|population|distance|weight|height|width|depth)\b/i,
            /\b(history|science|geography|math|physics|biology|chemistry)\b/i,
            /\b(know|understand|learn|read|write|speak)\b/i,
        ],
    },
    procedural: {
        model: "procedural-optimized",
        decay_lambda: 0.008,
        weight: 1.1,
        patterns: [
            /\b(how\s+to|step\s+by\s+step|guide|tutorial|manual|instructions)\b/i,
            /\b(first|second|then|next|finally|afterwards|lastly)\b/i,
            /\b(install|run|execute|compile|build|deploy|configure|setup)\b/i,
            /\b(click|press|type|enter|select|drag|drop|scroll)\b/i,
            /\b(method|function|class|algorithm|routine|recipie)\b/i,
            /\b(to\s+do|to\s+make|to\s+build|to\s+create)\b/i,
        ],
    },
    emotional: {
        model: "emotional-optimized",
        decay_lambda: 0.02,
        weight: 1.3,
        patterns: [
            /\b(feel|feeling|felt|emotions?|mood|vibe)\b/i,
            /\b(happy|sad|angry|mad|excited|scared|anxious|nervous|depressed)\b/i,
            /\b(love|hate|like|dislike|adore|detest|enjoy|loathe)\b/i,
            /\b(amazing|terrible|awesome|awful|wonderful|horrible|great|bad)\b/i,
            /\b(frustrated|confused|overwhelmed|stressed|relaxed|calm)\b/i,
            /\b(wow|omg|yay|nooo|ugh|sigh)\b/i,
            /[!]{2,}/,
        ],
    },
    reflective: {
        model: "reflective-optimized",
        decay_lambda: 0.001,
        weight: 0.8,
        patterns: [
            /\b(realize|realized|realization|insight|epiphany)\b/i,
            /\b(think|thought|thinking|ponder|contemplate|reflect)\b/i,
            /\b(understand|understood|understanding|grasp|comprehend)\b/i,
            /\b(pattern|trend|connection|link|relationship|correlation)\b/i,
            /\b(lesson|moral|takeaway|conclusion|summary|implication)\b/i,
            /\b(feedback|review|analysis|evaluation|assessment)\b/i,
            /\b(improve|grow|change|adapt|evolve)\b/i,
        ],
    },
};
export const sectors = Object.keys(sector_configs);
export const scoring_weights = {
    similarity: 0.35,
    overlap: 0.20,
    waypoint: 0.15,
    recency: 0.10,
    tag_match: 0.20,
};
export const hybrid_params = {
    tau: 3,
    beta: 2,
    eta: 0.1,
    gamma: 0.2,
    alpha_reinforce: 0.08,
    t_days: 7,
    t_max_days: 60,
    tau_hours: 1,
    epsilon: 1e-8,
};
export const reinforcement = {
    salience_boost: 0.1,
    waypoint_boost: 0.05,
    max_salience: 1.0,
    max_waypoint_weight: 1.0,
    prune_threshold: 0.05,
};



export const sector_relationships: Record<string, Record<string, number>> = {
    semantic: { procedural: 0.8, episodic: 0.6, reflective: 0.7, emotional: 0.4 },
    procedural: { semantic: 0.8, episodic: 0.6, reflective: 0.6, emotional: 0.3 },
    episodic: { reflective: 0.8, semantic: 0.6, procedural: 0.6, emotional: 0.7 },
    reflective: { episodic: 0.8, semantic: 0.7, procedural: 0.6, emotional: 0.6 },
    emotional: { episodic: 0.7, reflective: 0.6, semantic: 0.4, procedural: 0.3 },
};


function has_temporal_markers(text: string): boolean {
    const temporal_patterns = [
        /\b(today|yesterday|tomorrow|this\s+week|last\s+week|this\s+morning)\b/i,
        /\b\d{4}-\d{2}-\d{2}\b/,
        /\b20\d{2}[/-]?(0[1-9]|1[0-2])[/-]?(0[1-9]|[12]\d|3[01])\b/,
        /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i,
        /\bwhat\s+(did|have)\s+(i|we)\s+(do|done)\b/i,
    ];
    return temporal_patterns.some(p => p.test(text));
}


async function compute_tag_match_score(memory_id: string, query_tokens: Set<string>): Promise<number> {
    const mem = await q.get_mem.get(memory_id);
    if (!mem?.tags) return 0;

    try {
        const tags = JSON.parse(mem.tags);
        if (!Array.isArray(tags)) return 0;

        let matches = 0;
        for (const tag of tags) {
            const tag_lower = String(tag).toLowerCase();

            if (query_tokens.has(tag_lower)) {
                matches += 2;
            } else {

                for (const token of query_tokens) {
                    if (tag_lower.includes(token) || token.includes(tag_lower)) {
                        matches += 1;
                    }
                }
            }
        }
        return Math.min(1.0, matches / Math.max(1, tags.length * 2));
    } catch {
        return 0;
    }
}

const compress_vec_for_storage = (
    vec: number[],
    target_dim: number,
): number[] => {
    if (vec.length <= target_dim) return vec;
    const compressed = new Float32Array(target_dim);
    const bucket_sz = vec.length / target_dim;
    for (let i = 0; i < target_dim; i++) {
        const start = Math.floor(i * bucket_sz);
        const end = Math.floor((i + 1) * bucket_sz);
        let sum = 0,
            count = 0;
        for (let j = start; j < end && j < vec.length; j++) {
            sum += vec[j];
            count++;
        }
        compressed[i] = count > 0 ? sum / count : 0;
    }
    let norm = 0;
    for (let i = 0; i < target_dim; i++) norm += compressed[i] * compressed[i];
    norm = Math.sqrt(norm);
    if (norm > 0) for (let i = 0; i < target_dim; i++) compressed[i] /= norm;
    return Array.from(compressed);
};

export function classify_content(
    content: string,
    metadata?: any,
): sector_class {
    if (metadata?.sector && sectors.includes(metadata.sector)) {
        return {
            primary: metadata.sector,
            additional: [],
            confidence: 1.0,
        };
    }
    const scores: Record<string, number> = {};
    for (const [sector, config] of Object.entries(sector_configs)) {
        let score = 0;
        for (const pattern of config.patterns) {
            const matches = content.match(pattern);
            if (matches) {
                score += matches.length * config.weight;
            }
        }
        scores[sector] = score;
    }
    const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a);
    const primary = sortedScores[0][0];
    const primaryScore = sortedScores[0][1];
    const threshold = Math.max(1, primaryScore * 0.3);
    const additional = sortedScores
        .slice(1)
        .filter(([, score]) => score > 0 && score >= threshold)
        .map(([sector]) => sector);
    const confidence =
        primaryScore > 0
            ? Math.min(
                1.0,
                primaryScore /
                (primaryScore + (sortedScores[1]?.[1] || 0) + 1),
            )
            : 0.2;
    return {
        primary: primaryScore > 0 ? primary : "semantic",
        additional,
        confidence,
    };
}
export function calc_decay(
    sec: string,
    init_sal: number,
    days_since: number,
    seg_idx?: number,
    max_seg?: number,
): number {
    const cfg = sector_configs[sec];
    if (!cfg) return init_sal;
    let lambda = cfg.decay_lambda;
    if (seg_idx !== undefined && max_seg !== undefined && max_seg > 0) {
        const seg_ratio = Math.sqrt(seg_idx / max_seg);
        lambda = lambda * (1 - seg_ratio);
    }
    const decayed = init_sal * Math.exp(-lambda * days_since);
    const reinf =
        hybrid_params.alpha_reinforce * (1 - Math.exp(-lambda * days_since));
    return Math.max(0, Math.min(1, decayed + reinf));
}
export function calc_recency_score(last_seen: number): number {
    const now = Date.now();
    const days_since = (now - last_seen) / (1000 * 60 * 60 * 24);
    const t = hybrid_params.t_days;
    const tmax = hybrid_params.t_max_days;
    return Math.exp(-days_since / t) * (1 - days_since / tmax);
}
export function boosted_sim(s: number): number {
    return 1 - Math.exp(-hybrid_params.tau * s);
}
export function compute_simhash(text: string): string {
    const tokens = canonical_token_set(text);
    const hashes = Array.from(tokens).map((t) => {
        let h = 0;
        for (let i = 0; i < t.length; i++) {
            h = (h << 5) - h + t.charCodeAt(i);
            h = h & h;
        }
        return h;
    });
    const vec = new Array(64).fill(0);
    for (const h of hashes) {
        for (let i = 0; i < 64; i++) {
            if (h & (1 << i)) vec[i]++;
            else vec[i]--;
        }
    }
    let hash = "";
    for (let i = 0; i < 64; i += 4) {
        const nibble =
            (vec[i] > 0 ? 8 : 0) +
            (vec[i + 1] > 0 ? 4 : 0) +
            (vec[i + 2] > 0 ? 2 : 0) +
            (vec[i + 3] > 0 ? 1 : 0);
        hash += nibble.toString(16);
    }
    return hash;
}
export function hamming_dist(hash1: string, hash2: string): number {
    let dist = 0;
    for (let i = 0; i < hash1.length; i++) {
        const xor = parseInt(hash1[i], 16) ^ parseInt(hash2[i], 16);
        dist +=
            (xor & 8 ? 1 : 0) +
            (xor & 4 ? 1 : 0) +
            (xor & 2 ? 1 : 0) +
            (xor & 1 ? 1 : 0);
    }
    return dist;
}
export function sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
}
export function extract_essence(
    raw: string,
    sec: string,
    max_len: number,
): string {
    if (!env.use_summary_only || raw.length <= max_len) return raw;

    const sents = raw
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);
    if (sents.length === 0) return raw.slice(0, max_len);
    const score_sent = (s: string, idx: number): number => {
        let sc = 0;

        if (idx === 0) sc += 10;

        if (idx === 1) sc += 5;

        if (/^#+\s/.test(s) || /^[A-Z][A-Z\s]+:/.test(s)) sc += 8;

        if (/^[A-Z][a-z]+:/i.test(s)) sc += 6;

        if (/\d{4}-\d{2}-\d{2}/.test(s)) sc += 7;
        if (
            /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d+/i.test(
                s,
            )
        )
            sc += 5;
        if (/\$\d+|\d+\s*(miles|dollars|years|months|km)/.test(s)) sc += 4;
        if (/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(s)) sc += 3;
        if (
            /\b(bought|purchased|serviced|visited|went|got|received|paid|earned|learned|discovered|found|saw|met|completed|finished|fixed|implemented|created|updated|added|removed|resolved)\b/i.test(
                s,
            )
        )
            sc += 4;
        if (/\b(who|what|when|where|why|how)\b/i.test(s)) sc += 2;
        if (s.length < 80) sc += 2;
        if (/\b(I|my|me)\b/.test(s)) sc += 1;
        return sc;
    };
    const scored = sents.map((s, idx) => ({ text: s, score: score_sent(s, idx), idx }));

    scored.sort((a, b) => b.score - a.score);


    const selected: typeof scored = [];
    let current_len = 0;


    const firstSent = scored.find(s => s.idx === 0);
    if (firstSent && firstSent.text.length < max_len) {
        selected.push(firstSent);
        current_len += firstSent.text.length;
    }

    for (const item of scored) {
        if (item.idx === 0) continue;
        if (current_len + item.text.length + 2 <= max_len) {
            selected.push(item);
            current_len += item.text.length + 2;
        }
    }


    selected.sort((a, b) => a.idx - b.idx);

    return selected.map(s => s.text).join(" ");
}
export function compute_token_overlap(
    q_toks: Set<string>,
    mem_toks: Set<string>,
): number {
    if (q_toks.size === 0) return 0;
    let ov = 0;
    for (const t of q_toks) {
        if (mem_toks.has(t)) ov++;
    }
    return ov / q_toks.size;
}
export function compute_hybrid_score(
    sim: number,
    tok_ov: number,
    wp_wt: number,
    rec_sc: number,
    keyword_score: number = 0,
    tag_match: number = 0,
): number {
    const s_p = boosted_sim(sim);
    const raw =
        scoring_weights.similarity * s_p +
        scoring_weights.overlap * tok_ov +
        scoring_weights.waypoint * wp_wt +
        scoring_weights.recency * rec_sc +
        scoring_weights.tag_match * tag_match +
        keyword_score;
    return sigmoid(raw);
}
import {
    q,
    vector_store,
    get_async,
    all_async,
    run_async,
    transaction,
    log_maint_op,
} from "../core/db";
export async function create_cross_sector_waypoints(
    prim_id: string,
    prim_sec: string,
    add_secs: string[],
    user_id?: string | null,
): Promise<void> {
    const now = Date.now();
    const wt = 0.5;
    for (const sec of add_secs) {
        await q.ins_waypoint.run(
            prim_id,
            `${prim_id}:${sec}`,
            user_id || "anonymous",
            wt,
            now,
            now,
        );
        await q.ins_waypoint.run(
            `${prim_id}:${sec}`,
            prim_id,
            user_id || "anonymous",
            wt,
            now,
            now,
        );
    }
}
export function calc_mean_vec(
    emb_res: EmbeddingResult[],
    secs: string[],
): number[] {
    const dim = emb_res[0].vector.length;
    const wsum = new Array(dim).fill(0);
    const sec_scores = emb_res.map((r) => ({
        vector: r.vector,
        confidence: sector_configs[r.sector]?.weight || 1.0,
    }));
    const beta = hybrid_params.beta;
    const exp_sum = sec_scores.reduce(
        (sum, s) => sum + Math.exp(beta * s.confidence),
        0,
    );
    for (const result of emb_res) {
        const sec_wt = sector_configs[result.sector]?.weight || 1.0;
        const sm_wt = Math.exp(beta * sec_wt) / exp_sum;
        for (let i = 0; i < dim; i++) {
            wsum[i] += result.vector[i] * sm_wt;
        }
    }
    const norm =
        Math.sqrt(wsum.reduce((sum, v) => sum + v * v, 0)) +
        hybrid_params.epsilon;
    return wsum.map((v) => v / norm);
}
export async function create_single_waypoint(
    new_id: string,
    new_mean: number[],
    ts: number,
    user_id?: string | null,
): Promise<void> {
    const thresh = 0.75;
    const mems = user_id
        ? await q.all_mem_by_user.all(user_id, 1000, 0)
        : await q.all_mem.all(1000, 0);
    let best: { id: string; similarity: number } | null = null;
    for (const mem of mems) {
        if (mem.id === new_id || !mem.mean_vec) continue;
        const ex_mean = buf_to_vec(mem.mean_vec);
        const sim = cos_sim(new Float32Array(new_mean), ex_mean);
        if (!best || sim > best.similarity) {
            best = { id: mem.id, similarity: sim };
        }
    }
    if (best) {
        await q.ins_waypoint.run(
            new_id,
            best.id,
            user_id || "anonymous",
            best.similarity,
            ts,
            ts,
        );
    } else {
        await q.ins_waypoint.run(new_id, new_id, user_id || "anonymous", 1.0, ts, ts);
    }
}
export async function create_inter_mem_waypoints(
    new_id: string,
    prim_sec: string,
    new_vec: number[],
    ts: number,
    user_id?: string | null,
): Promise<void> {
    const thresh = 0.75;
    const wt = 0.5;
    const vecs = await vector_store.getVectorsBySector(prim_sec);
    for (const vr of vecs) {
        if (vr.id === new_id) continue;
        const ex_vec = vr.vector;
        const sim = cos_sim(new Float32Array(new_vec), new Float32Array(ex_vec));
        if (sim >= thresh) {
            await q.ins_waypoint.run(
                new_id,
                vr.id,
                user_id || "anonymous",
                wt,
                ts,
                ts,
            );
            await q.ins_waypoint.run(
                vr.id,
                new_id,
                user_id || "anonymous",
                wt,
                ts,
                ts,
            );
        }
    }
}
export async function create_contextual_waypoints(
    mem_id: string,
    rel_ids: string[],
    base_wt: number = 0.3,
    user_id?: string | null,
): Promise<void> {
    const now = Date.now();
    for (const rel_id of rel_ids) {
        if (mem_id === rel_id) continue;
        const existing = await q.get_waypoint.get(mem_id, rel_id);
        if (existing) {
            const new_wt = Math.min(1.0, existing.weight + 0.1);
            await q.upd_waypoint.run(mem_id, new_wt, now, rel_id);
        } else {
            await q.ins_waypoint.run(
                mem_id,
                rel_id,
                user_id || "anonymous",
                base_wt,
                now,
                now,
            );
        }
    }
}
export async function expand_via_waypoints(
    init_res: string[],
    max_exp: number = 10,
): Promise<Array<{ id: string; weight: number; path: string[] }>> {
    const exp: Array<{ id: string; weight: number; path: string[] }> = [];
    const vis = new Set<string>();
    for (const id of init_res) {
        exp.push({ id, weight: 1.0, path: [id] });
        vis.add(id);
    }
    const q_arr = [...exp];
    let exp_cnt = 0;
    while (q_arr.length > 0 && exp_cnt < max_exp) {
        const cur = q_arr.shift()!;
        const neighs = await q.get_neighbors.all(cur.id);
        for (const neigh of neighs) {
            if (vis.has(neigh.dst_id)) continue;

            const neigh_wt = Math.min(1.0, Math.max(0, neigh.weight || 0));
            const exp_wt = cur.weight * neigh_wt * 0.8;
            if (exp_wt < 0.1) continue;
            const exp_item = {
                id: neigh.dst_id,
                weight: exp_wt,
                path: [...cur.path, neigh.dst_id],
            };
            exp.push(exp_item);
            vis.add(neigh.dst_id);
            q_arr.push(exp_item);
            exp_cnt++;
        }
    }
    return exp;
}
export async function reinforce_waypoints(trav_path: string[]): Promise<void> {
    const now = Date.now();
    for (let i = 0; i < trav_path.length - 1; i++) {
        const src_id = trav_path[i];
        const dst_id = trav_path[i + 1];
        const wp = await q.get_waypoint.get(src_id, dst_id);
        if (wp) {
            const new_wt = Math.min(
                reinforcement.max_waypoint_weight,
                wp.weight + reinforcement.waypoint_boost,
            );
            await q.upd_waypoint.run(src_id, new_wt, now, dst_id);
        }
    }
}
export async function prune_weak_waypoints(): Promise<number> {
    await q.prune_waypoints.run(reinforcement.prune_threshold);
    return 0;
}
import {
    embedForSector,
    embedQueryForAllSectors,
    embedMultiSector,
    cosineSimilarity,
    bufferToVector,
    vectorToBuffer,
    EmbeddingResult,
} from "./embed";
import { chunk_text } from "../utils/chunking";
import { j } from "../utils";
import { keyword_filter_memories, extract_keywords } from "../utils/keyword";
import {
    calculateCrossSectorResonanceScore,
    applyRetrievalTraceReinforcementToMemory,
    propagateAssociativeReinforcementToLinkedNodes,
    ALPHA_LEARNING_RATE_FOR_RECALL_REINFORCEMENT,
    BETA_LEARNING_RATE_FOR_EMOTIONAL_FREQUENCY,
} from "../ops/dynamics";
export interface multi_vec_fusion_weights {
    semantic_dimension_weight: number;
    emotional_dimension_weight: number;
    procedural_dimension_weight: number;
    temporal_dimension_weight: number;
    reflective_dimension_weight: number;
}
export async function calc_multi_vec_fusion_score(
    mid: string,
    qe: Record<string, number[]>,
    w: multi_vec_fusion_weights,
): Promise<number> {
    const vecs = await vector_store.getVectorsById(mid);
    let sum = 0,
        tot = 0;
    const wm: Record<string, number> = {
        semantic: w.semantic_dimension_weight,
        emotional: w.emotional_dimension_weight,
        procedural: w.procedural_dimension_weight,
        episodic: w.temporal_dimension_weight,
        reflective: w.reflective_dimension_weight,
    };
    for (const v of vecs) {
        const qv = qe[v.sector];
        if (!qv) continue;
        const mv = v.vector;
        const sim = cosineSimilarity(qv, mv);
        const wgt = wm[v.sector] || 0.5;
        sum += sim * wgt;
        tot += wgt;
    }
    return tot > 0 ? sum / tot : 0;
}
const cache = new Map<string, { r: hsg_q_result[]; t: number }>();
const sal_cache = new Map<string, { s: number; t: number }>();

const seg_cache = new Map<number, any[]>();
const coact_buf: Array<[string, string]> = [];
const TTL = 60000;
const VEC_CACHE_MAX = 1000;
let active_queries = 0;

const get_segment = async (seg: number): Promise<any[]> => {
    if (seg_cache.has(seg)) return seg_cache.get(seg)!;
    const rows = await q.get_mem_by_segment.all(seg);
    seg_cache.set(seg, rows);
    if (seg_cache.size > env.cache_segments) {
        const first = seg_cache.keys().next().value;
        if (first !== undefined) seg_cache.delete(first);
    }
    return rows;
};
setInterval(async () => {
    if (!coact_buf.length) return;
    const pairs = coact_buf.splice(0, 50);
    const now = Date.now();
    const tau_ms = hybrid_params.tau_hours * 3600000;
    for (const [a, b] of pairs) {
        try {
            const [memA, memB] = await Promise.all([
                q.get_mem.get(a),
                q.get_mem.get(b),
            ]);
            if (!memA || !memB) continue;
            const time_diff = Math.abs(memA.last_seen_at - memB.last_seen_at);
            const temp_fact = Math.exp(-time_diff / tau_ms);
            const wp = await q.get_waypoint.get(a, b);
            const cur_wt = wp?.weight || 0;
            const new_wt = Math.min(
                1,
                cur_wt + hybrid_params.eta * (1 - cur_wt) * temp_fact,
            );
            const user_id = wp?.user_id || memA?.user_id || memB?.user_id || "anonymous";
            await q.ins_waypoint.run(a, b, user_id, new_wt, wp?.created_at || now, now);
        } catch (e) { }
    }
}, 1000);
const get_sal = async (id: string, def_sal: number): Promise<number> => {
    const c = sal_cache.get(id);
    if (c && Date.now() - c.t < TTL) return c.s;
    const m = await q.get_mem.get(id);
    const s = m?.salience ?? def_sal;
    sal_cache.set(id, { s, t: Date.now() });
    return s;
};
export async function hsg_query(
    qt: string,
    k = 10,
    f?: { sectors?: string[]; minSalience?: number; user_id?: string; startTime?: number; endTime?: number },
): Promise<hsg_q_result[]> {




    if (active_queries >= env.max_active) {
        throw new Error(
            `Rate limit: ${active_queries} active queries (max ${env.max_active})`,
        );
    }
    active_queries++;
    inc_q();
    try {
        const h = `${qt}:${k}:${JSON.stringify(f || {})}`;
        const cached = cache.get(h);
        if (cached && Date.now() - cached.t < TTL) return cached.r;
        const qc = classify_content(qt);
        const is_temporal = has_temporal_markers(qt);
        const qtk = canonical_token_set(qt);

        const primary_sectors = [qc.primary, ...qc.additional];

        let ss: string[];
        if (f?.sectors?.length) {

            ss = f.sectors;
        } else {


            ss = [...sectors];
        }
        if (!ss.length) ss.push("semantic");

        const qe = await embedQueryForAllSectors(qt, ss);
        const w: multi_vec_fusion_weights = {
            semantic_dimension_weight: qc.primary === "semantic" ? 1.2 : 0.8,
            emotional_dimension_weight: qc.primary === "emotional" ? 1.5 : 0.6,
            procedural_dimension_weight:
                qc.primary === "procedural" ? 1.3 : 0.7,
            temporal_dimension_weight: qc.primary === "episodic" ? 1.4 : 0.7,
            reflective_dimension_weight:
                qc.primary === "reflective" ? 1.1 : 0.5,
        };
        const sr: Record<
            string,
            Array<{ id: string; similarity: number }>
        > = {};
        for (const s of ss) {
            const qv = qe[s];
            const results = await vector_store.searchSimilar(s, qv, k * 3);
            sr[s] = results.map(r => ({ id: r.id, similarity: r.score }));
        }
        const all_sims = Object.values(sr).flatMap((r) =>
            r.slice(0, 8).map((x) => x.similarity),
        );
        const avg_top = all_sims.length
            ? all_sims.reduce((a, b) => a + b, 0) / all_sims.length
            : 0;
        const adapt_exp = Math.ceil(0.3 * k * (1 - avg_top));
        const eff_k = k + adapt_exp;
        const high_conf = avg_top >= 0.55;
        const ids = new Set<string>();
        for (const r of Object.values(sr)) for (const x of r) ids.add(x.id);
        const exp = high_conf
            ? []
            : await expand_via_waypoints(Array.from(ids), k * 2);
        for (const e of exp) ids.add(e.id);

        let keyword_scores = new Map<string, number>();
        if (tier === "hybrid") {
            const all_mems = await Promise.all(
                Array.from(ids).map(async (id) => {
                    const m = await q.get_mem.get(id);
                    return m ? { id, content: m.content } : null;
                }),
            );
            const valid_mems = all_mems.filter((m) => m !== null) as Array<{
                id: string;
                content: string;
            }>;
            keyword_scores = await keyword_filter_memories(
                qt,
                valid_mems,
                0.05,
            );
        }

        const res: hsg_q_result[] = [];
        for (const mid of Array.from(ids)) {
            const m = await q.get_mem.get(mid);
            if (!m || (f?.minSalience && m.salience < f.minSalience)) continue;
            if (f?.user_id && m.user_id !== f.user_id) continue;
            if (f?.startTime && m.created_at < f.startTime) continue;
            if (f?.endTime && m.created_at > f.endTime) continue;
            const mvf = await calc_multi_vec_fusion_score(mid, qe, w);
            const csr = await calculateCrossSectorResonanceScore(
                m.primary_sector,
                qc.primary,
                mvf,
            );
            let bs = csr,
                bsec = m.primary_sector;
            for (const [sec, rr] of Object.entries(sr)) {
                const mat = rr.find((r) => r.id === mid);
                if (mat && mat.similarity > bs) {
                    bs = mat.similarity;
                    bsec = sec;
                }
            }


            const mem_sector = m.primary_sector;
            const query_sector = qc.primary;
            let sector_penalty = 1.0;
            if (mem_sector !== query_sector && !primary_sectors.includes(mem_sector)) {

                sector_penalty = sector_relationships[query_sector]?.[mem_sector] || 0.3;
            }
            const adjusted_sim = bs * sector_penalty;

            const em = exp.find((e: { id: string }) => e.id === mid);

            const ww = Math.min(1.0, Math.max(0, em?.weight || 0));
            const ds = (Date.now() - m.last_seen_at) / 86400000;
            const sal = calc_decay(m.primary_sector, m.salience, ds);
            const mtk = canonical_token_set(m.content);
            const tok_ov = compute_token_overlap(qtk, mtk);
            const rec_sc = calc_recency_score(m.last_seen_at);


            const tag_match = await compute_tag_match_score(mid, qtk);

            const keyword_boost =
                tier === "hybrid"
                    ? (keyword_scores.get(mid) || 0) * env.keyword_boost
                    : 0;
            const fs = compute_hybrid_score(
                adjusted_sim,
                tok_ov,
                ww,
                rec_sc,
                keyword_boost,
                tag_match,
            );
            const msec = await vector_store.getVectorsById(mid);
            const sl = msec.map((v) => v.sector);
            res.push({
                id: mid,
                content: m.content,
                score: fs,
                sectors: sl,
                primary_sector: m.primary_sector,
                path: em?.path || [mid],
                salience: sal,
                last_seen_at: m.last_seen_at,
                tags: typeof m.tags === 'string' ? JSON.parse(m.tags) : (m.tags || []),
                meta: typeof m.meta === 'string' ? JSON.parse(m.meta) : (m.meta || {}),
            });
        }
        res.sort((a, b) => b.score - a.score);
        const top_cands = res.slice(0, eff_k);
        if (top_cands.length > 0) {
            const scores = top_cands.map((r) => r.score);
            const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
            const variance =
                scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) /
                scores.length;
            const stdDev = Math.sqrt(variance);
            for (const r of top_cands) {
                r.score = (r.score - mean) / (stdDev + hybrid_params.epsilon);
            }
            top_cands.sort((a, b) => b.score - a.score);
        }
        const top = top_cands.slice(0, k);
        const tids = top.map((r) => r.id);


        for (const r of top) {
            const cur_fb = (await q.get_mem.get(r.id))?.feedback_score || 0;
            const new_fb = cur_fb * 0.9 + r.score * 0.1;
            await q.upd_feedback.run(r.id, new_fb);
        }

        for (let i = 0; i < tids.length; i++) {
            for (let j = i + 1; j < tids.length; j++) {
                const [a, b] = [tids[i], tids[j]].sort();
                coact_buf.push([a, b]);
            }
        }
        for (const r of top) {
            const rsal = await applyRetrievalTraceReinforcementToMemory(
                r.id,
                r.salience,
            );
            await q.upd_seen.run(r.id, Date.now(), rsal, Date.now());
            if (r.path.length > 1) {
                await reinforce_waypoints(r.path);
                const wps = await q.get_waypoints_by_src.all(r.id);
                const lns = wps.map((wp: any) => ({
                    target_id: wp.dst_id,
                    weight: wp.weight,
                }));
                const pru =
                    await propagateAssociativeReinforcementToLinkedNodes(
                        r.id,
                        rsal,
                        lns,
                    );
                for (const u of pru) {
                    const linked_mem = await q.get_mem.get(u.node_id);
                    if (linked_mem) {
                        const time_diff =
                            (Date.now() - linked_mem.last_seen_at) / 86400000;
                        const decay_fact = Math.exp(-0.02 * time_diff);
                        const ctx_boost =
                            hybrid_params.gamma *
                            (rsal - linked_mem.salience) *
                            decay_fact;
                        const new_sal = Math.max(
                            0,
                            Math.min(1, linked_mem.salience + ctx_boost),
                        );
                        await q.upd_seen.run(
                            u.node_id,
                            Date.now(),
                            new_sal,
                            Date.now(),
                        );
                    }
                }
            }
        }

        for (const r of top) {
            on_query_hit(r.id, r.primary_sector, (text) =>
                embedForSector(text, r.primary_sector),
            ).catch(() => { });
        }

        cache.set(h, { r: top, t: Date.now() });
        return top;
    } finally {
        active_queries--;
        dec_q();
    }
}
export async function run_decay_process(): Promise<{
    processed: number;
    decayed: number;
}> {
    const mems = await q.all_mem.all(10000, 0);
    let p = 0,
        d = 0;
    for (const m of mems) {
        const ds = (Date.now() - m.last_seen_at) / 86400000;
        const ns = calc_decay(m.primary_sector, m.salience, ds);
        if (ns !== m.salience) {
            await q.upd_seen.run(m.id, m.last_seen_at, ns, Date.now());
            d++;
        }
        p++;
    }
    if (d > 0) await log_maint_op("decay", d);
    return { processed: p, decayed: d };
}


async function ensure_user_exists(user_id: string): Promise<void> {
    try {
        const existing = await q.get_user.get(user_id);
        if (!existing) {
            await q.ins_user.run(
                user_id,
                "User profile initializing...",
                0,
                Date.now(),
                Date.now()
            );
        }
    } catch (error) {
        console.error(`[HSG] Failed to ensure user ${user_id} exists:`, error);

    }
}

export async function add_hsg_memory(
    content: string,
    tags?: string,
    metadata?: any,
    user_id?: string,
): Promise<{
    id: string;
    primary_sector: string;
    sectors: string[];
    chunks?: number;
    deduplicated?: boolean;
}> {
    const simhash = compute_simhash(content);
    const existing = await q.get_mem_by_simhash.get(simhash);
    if (existing && hamming_dist(simhash, existing.simhash) <= 3) {
        const now = Date.now();
        const boosted_sal = Math.min(1, existing.salience + 0.15);
        await q.upd_seen.run(existing.id, now, boosted_sal, now);
        return {
            id: existing.id,
            primary_sector: existing.primary_sector,
            sectors: [existing.primary_sector],
            deduplicated: true,
        };
    }
    const id = crypto.randomUUID();
    const now = Date.now();


    if (user_id) {
        await ensure_user_exists(user_id);
    }

    const chunks = chunk_text(content);
    const use_chunking = chunks.length > 1;
    const classification = classify_content(content, metadata);
    const all_sectors = [classification.primary, ...classification.additional];
    await transaction.begin();
    try {
        const max_seg_res = await q.get_max_segment.get();
        let cur_seg = max_seg_res?.max_seg ?? 0;
        const seg_cnt_res = await q.get_segment_count.get(cur_seg);
        const seg_cnt = seg_cnt_res?.c ?? 0;
        if (seg_cnt >= env.seg_size) {
            cur_seg++;

            console.error(
                `[HSG] Rotated to segment ${cur_seg} (previous segment full: ${seg_cnt} memories)`,
            );
        }
        const stored_content = extract_essence(
            content,
            classification.primary,
            env.summary_max_length,
        );
        const sec_cfg = sector_configs[classification.primary];
        const init_sal = Math.max(
            0,
            Math.min(1, 0.4 + 0.1 * classification.additional.length),
        );
        await q.ins_mem.run(
            id,
            user_id || "anonymous",
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
            null,
            0,
        );
        const emb_res = await embedMultiSector(
            id,
            content,
            all_sectors,
            use_chunking ? chunks : undefined,
        );
        for (const result of emb_res) {
            await vector_store.storeVector(
                id,
                result.sector,
                result.vector,
                result.dim,
                user_id || "anonymous",
            );
        }
        const mean_vec = calc_mean_vec(emb_res, all_sectors);
        const mean_vec_buf = vectorToBuffer(mean_vec);
        await q.upd_mean_vec.run(id, mean_vec.length, mean_vec_buf);


        if (tier === "smart" && mean_vec.length > 128) {
            const comp = compress_vec_for_storage(mean_vec, 128);
            const comp_buf = vectorToBuffer(comp);
            await q.upd_compressed_vec.run(comp_buf, id);
        }

        await create_single_waypoint(id, mean_vec, now, user_id);
        await transaction.commit();
        return {
            id,
            primary_sector: classification.primary,
            sectors: all_sectors,
            chunks: chunks.length,
        };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}
export async function delete_memory(id: string): Promise<boolean> {
    const mem = await q.get_mem.get(id);
    if (!mem) return false;
    await transaction.begin();
    try {
        await q.del_mem.run(id);
        await q.del_waypoints.run(id, id);
        await vector_store.deleteVectors(id);
        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}
export async function reinforce_memory(
    id: string,
    boost: number = 0.1,
): Promise<void> {
    const mem = await q.get_mem.get(id);
    if (!mem) throw new Error(`Memory ${id} not found`);
    const new_sal = Math.min(reinforcement.max_salience, mem.salience + boost);
    await q.upd_seen.run(id, Date.now(), new_sal, Date.now());
    if (new_sal > 0.8) await log_maint_op("consolidate", 1);
}
export async function update_memory(
    id: string,
    content?: string,
    tags?: string[],
    metadata?: any,
): Promise<{ id: string; updated: boolean }> {
    const mem = await q.get_mem.get(id);
    if (!mem) throw new Error(`Memory ${id} not found`);
    const new_content = content !== undefined ? content : mem.content;
    const new_tags = tags !== undefined ? j(tags) : mem.tags || "[]";
    const new_meta = metadata !== undefined ? j(metadata) : mem.meta || "{}";
    await transaction.begin();
    try {
        if (content !== undefined && content !== mem.content) {
            const chunks = chunk_text(new_content);
            const use_chunking = chunks.length > 1;
            const classification = classify_content(new_content, metadata);
            const all_sectors = [
                classification.primary,
                ...classification.additional,
            ];
            await vector_store.deleteVectors(id);
            const emb_res = await embedMultiSector(
                id,
                new_content,
                all_sectors,
                use_chunking ? chunks : undefined,
            );
            for (const result of emb_res) {
                await vector_store.storeVector(
                    id,
                    result.sector,
                    result.vector,
                    result.dim,
                    mem.user_id || "anonymous",
                );
            }
            const mean_vec = calc_mean_vec(emb_res, all_sectors);
            const mean_vec_buf = vectorToBuffer(mean_vec);
            await q.upd_mean_vec.run(id, mean_vec.length, mean_vec_buf);
            await q.upd_mem_with_sector.run(
                new_content,
                classification.primary,
                new_tags,
                new_meta,
                Date.now(),
                id,
            );
        } else {
            await q.upd_mem.run(
                new_content,
                new_tags,
                new_meta,
                Date.now(),
                id,
            );
        }
        await transaction.commit();
        return { id, updated: true };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}
