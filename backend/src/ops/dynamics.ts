import { all_async, run_async, get_async, q } from '../core/db'
import { now } from '../utils'
import { cosineSimilarity } from '../memory/embed'

export const ALPHA_LEARNING_RATE_FOR_RECALL_REINFORCEMENT = 0.15
export const BETA_LEARNING_RATE_FOR_EMOTIONAL_FREQUENCY = 0.20
export const GAMMA_ATTENUATION_CONSTANT_FOR_GRAPH_DISTANCE = 0.35
export const THETA_CONSOLIDATION_COEFFICIENT_FOR_LONG_TERM = 0.40
export const ETA_REINFORCEMENT_FACTOR_FOR_TRACE_LEARNING = 0.18
export const LAMBDA_ONE_FAST_DECAY_RATE = 0.015
export const LAMBDA_TWO_SLOW_DECAY_RATE = 0.002
export const TAU_ENERGY_THRESHOLD_FOR_RETRIEVAL = 0.40

export const SECTORAL_INTERDEPENDENCE_MATRIX_FOR_COGNITIVE_RESONANCE = [
    [1.0, 0.7, 0.3, 0.6, 0.6],
    [0.7, 1.0, 0.4, 0.7, 0.8],
    [0.3, 0.4, 1.0, 0.5, 0.2],
    [0.6, 0.7, 0.5, 1.0, 0.8],
    [0.6, 0.8, 0.2, 0.8, 1.0]
]

export const SECTOR_INDEX_MAPPING_FOR_MATRIX_LOOKUP = {
    episodic: 0, semantic: 1, procedural: 2, emotional: 3, reflective: 4
}

export interface DynamicSalienceWeightingParameters {
    initial_salience_value: number
    decay_constant_lambda: number
    recall_reinforcement_count: number
    emotional_frequency_metric: number
}

export interface AssociativeWaypointGraphNode {
    node_memory_id: string
    activation_energy_level: number
    connected_waypoint_edges: Array<{ target_node_id: string, link_weight_value: number, time_gap_delta_t: number }>
}

const sig = (x: number) => 1 / (1 + Math.exp(-x))
export const linkW = (sem: number, emo: number, α = 0.7, β = 0.3) => sig(α * sem + β * emo)

export async function calculateDynamicSalienceWithTimeDecay(
    i: number, λ: number, r: number, e: number, t: number
): Promise<number> {
    const d = i * Math.exp(-λ * t)
    const rc = ALPHA_LEARNING_RATE_FOR_RECALL_REINFORCEMENT * r
    const ef = BETA_LEARNING_RATE_FOR_EMOTIONAL_FREQUENCY * e
    return Math.max(0, Math.min(1, d + rc + ef))
}

export async function calculateDualPhaseDecayMemoryRetention(t: number): Promise<number> {
    const f = Math.exp(-LAMBDA_ONE_FAST_DECAY_RATE * t)
    const s = THETA_CONSOLIDATION_COEFFICIENT_FOR_LONG_TERM * Math.exp(-LAMBDA_TWO_SLOW_DECAY_RATE * t)
    return Math.max(0, Math.min(1, f + s))
}

export async function calculateAssociativeWaypointLinkWeight(
    sv: number[], tv: number[], tg: number
): Promise<number> {
    const sim = cosineSimilarity(sv, tv)
    const td = tg / 86400000
    return Math.max(0, sim / (1 + td))
}

export async function calculateSpreadingActivationEnergyForNode(
    nid: string, an: Map<string, number>, gr: Map<string, AssociativeWaypointGraphNode>
): Promise<number> {
    const nd = gr.get(nid)
    if (!nd) return 0
    let tot = 0
    for (const e of nd.connected_waypoint_edges) {
        const na = an.get(e.target_node_id) || 0
        const att = Math.exp(-GAMMA_ATTENUATION_CONSTANT_FOR_GRAPH_DISTANCE * 1)
        tot += e.link_weight_value * na * att
    }
    return tot
}

export async function applyRetrievalTraceReinforcementToMemory(mid: string, sal: number): Promise<number> {
    return Math.min(1, sal + ETA_REINFORCEMENT_FACTOR_FOR_TRACE_LEARNING * (1 - sal))
}

export async function propagateAssociativeReinforcementToLinkedNodes(
    sid: string, ssal: number, wps: Array<{ target_id: string, weight: number }>
): Promise<Array<{ node_id: string, new_salience: number }>> {
    const ups: Array<{ node_id: string, new_salience: number }> = []
    for (const wp of wps) {
        const ld = await get_async('select salience from memories where id=?', [wp.target_id]) as any
        if (ld) {
            const pr = ETA_REINFORCEMENT_FACTOR_FOR_TRACE_LEARNING * wp.weight * ssal
            ups.push({ node_id: wp.target_id, new_salience: Math.min(1, ld.salience + pr) })
        }
    }
    return ups
}

export async function calculateCrossSectorResonanceScore(ms: string, qs: string, bs: number): Promise<number> {
    const si = (SECTOR_INDEX_MAPPING_FOR_MATRIX_LOOKUP as any)[ms] ?? 1
    const ti = (SECTOR_INDEX_MAPPING_FOR_MATRIX_LOOKUP as any)[qs] ?? 1
    return bs * SECTORAL_INTERDEPENDENCE_MATRIX_FOR_COGNITIVE_RESONANCE[si][ti]
}

export async function determineEnergyBasedRetrievalThreshold(act: number, tau: number): Promise<number> {
    const nrm = Math.max(0.1, act)
    return Math.max(0.1, Math.min(0.9, tau * (1 + Math.log(nrm + 1))))
}

export async function applyDualPhaseDecayToAllMemories(): Promise<void> {
    const mems = await all_async('select id,salience,decay_lambda,last_seen_at,updated_at,created_at from memories')
    const ts = now()
    const ops = mems.map(async (m: any) => {
        const tms = Math.max(0, ts - (m.last_seen_at || m.updated_at))
        const td = tms / 86400000
        const rt = await calculateDualPhaseDecayMemoryRetention(td)
        const nsal = m.salience * rt
        await run_async('update memories set salience=?,updated_at=? where id=?', [Math.max(0, nsal), ts, m.id])
    })
    await Promise.all(ops)
    console.log(`Decay applied to ${mems.length} memories`)
}

export async function buildAssociativeWaypointGraphFromMemories(): Promise<Map<string, AssociativeWaypointGraphNode>> {
    const gr = new Map<string, AssociativeWaypointGraphNode>()
    const wps = await all_async('select src_id,dst_id,weight,created_at from waypoints') as any[]
    const ids = new Set<string>()
    for (const wp of wps) { ids.add(wp.src_id); ids.add(wp.dst_id) }
    for (const id of ids) gr.set(id, { node_memory_id: id, activation_energy_level: 0, connected_waypoint_edges: [] })
    for (const wp of wps) {
        const sn = gr.get(wp.src_id)
        if (sn) {
            const tg = Math.abs(now() - wp.created_at)
            sn.connected_waypoint_edges.push({ target_node_id: wp.dst_id, link_weight_value: wp.weight, time_gap_delta_t: tg })
        }
    }
    return gr
}

export async function performSpreadingActivationRetrieval(
    init: string[], max: number
): Promise<Map<string, number>> {
    const gr = await buildAssociativeWaypointGraphFromMemories()
    const act = new Map<string, number>()
    for (const id of init) act.set(id, 1.0)
    for (let i = 0; i < max; i++) {
        const ups = new Map<string, number>()
        for (const [nid, ca] of act) {
            const nd = gr.get(nid)
            if (!nd) continue
            for (const e of nd.connected_waypoint_edges) {
                const pe = await calculateSpreadingActivationEnergyForNode(e.target_node_id, act, gr)
                const ex = ups.get(e.target_node_id) || 0
                ups.set(e.target_node_id, ex + pe)
            }
        }
        for (const [uid, nav] of ups) {
            const cv = act.get(uid) || 0
            act.set(uid, Math.max(cv, nav))
        }
    }
    return act
}

export async function retrieveMemoriesWithEnergyThresholding(
    qv: number[], qs: string, me: number
): Promise<any[]> {
    const mems = await all_async('select id,content,primary_sector,salience,mean_vec from memories where salience>0.01') as any[]
    const sc = new Map<string, number>()
    for (const m of mems) {
        if (!m.mean_vec) continue
        const buf = Buffer.isBuffer(m.mean_vec) ? m.mean_vec : Buffer.from(m.mean_vec)
        const ev: number[] = []
        for (let i = 0; i < buf.length; i += 4) ev.push(buf.readFloatLE(i))
        const bs = cosineSimilarity(qv, ev)
        const cs = await calculateCrossSectorResonanceScore(m.primary_sector, qs, bs)
        sc.set(m.id, cs * m.salience)
    }
    const sp = await performSpreadingActivationRetrieval(Array.from(sc.keys()).slice(0, 5), 3)
    const cmb = new Map<string, number>()
    for (const m of mems) cmb.set(m.id, (sc.get(m.id) || 0) + ((sp.get(m.id) || 0) * 0.3))
    const te = Array.from(cmb.values()).reduce((s, v) => s + v, 0)
    const thr = await determineEnergyBasedRetrievalThreshold(te, me)
    return mems.filter((m: any) => (cmb.get(m.id) || 0) > thr).map((m: any) => ({ ...m, activation_energy: cmb.get(m.id) }))
}

export const apply_decay = applyDualPhaseDecayToAllMemories
