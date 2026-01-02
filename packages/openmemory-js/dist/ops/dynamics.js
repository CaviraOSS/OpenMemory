"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apply_decay = exports.linkW = exports.SECTOR_INDEX_MAPPING_FOR_MATRIX_LOOKUP = exports.SECTORAL_INTERDEPENDENCE_MATRIX_FOR_COGNITIVE_RESONANCE = exports.TAU_ENERGY_THRESHOLD_FOR_RETRIEVAL = exports.LAMBDA_TWO_SLOW_DECAY_RATE = exports.LAMBDA_ONE_FAST_DECAY_RATE = exports.ETA_REINFORCEMENT_FACTOR_FOR_TRACE_LEARNING = exports.THETA_CONSOLIDATION_COEFFICIENT_FOR_LONG_TERM = exports.GAMMA_ATTENUATION_CONSTANT_FOR_GRAPH_DISTANCE = exports.BETA_LEARNING_RATE_FOR_EMOTIONAL_FREQUENCY = exports.ALPHA_LEARNING_RATE_FOR_RECALL_REINFORCEMENT = void 0;
exports.calculateDynamicSalienceWithTimeDecay = calculateDynamicSalienceWithTimeDecay;
exports.calculateDualPhaseDecayMemoryRetention = calculateDualPhaseDecayMemoryRetention;
exports.calculateAssociativeWaypointLinkWeight = calculateAssociativeWaypointLinkWeight;
exports.calculateSpreadingActivationEnergyForNode = calculateSpreadingActivationEnergyForNode;
exports.applyRetrievalTraceReinforcementToMemory = applyRetrievalTraceReinforcementToMemory;
exports.propagateAssociativeReinforcementToLinkedNodes = propagateAssociativeReinforcementToLinkedNodes;
exports.calculateCrossSectorResonanceScore = calculateCrossSectorResonanceScore;
exports.determineEnergyBasedRetrievalThreshold = determineEnergyBasedRetrievalThreshold;
exports.applyDualPhaseDecayToAllMemories = applyDualPhaseDecayToAllMemories;
exports.buildAssociativeWaypointGraphFromMemories = buildAssociativeWaypointGraphFromMemories;
exports.performSpreadingActivationRetrieval = performSpreadingActivationRetrieval;
exports.retrieveMemoriesWithEnergyThresholding = retrieveMemoriesWithEnergyThresholding;
const db_1 = require("../core/db");
const utils_1 = require("../utils");
const embed_1 = require("../memory/embed");
exports.ALPHA_LEARNING_RATE_FOR_RECALL_REINFORCEMENT = 0.15;
exports.BETA_LEARNING_RATE_FOR_EMOTIONAL_FREQUENCY = 0.2;
exports.GAMMA_ATTENUATION_CONSTANT_FOR_GRAPH_DISTANCE = 0.35;
exports.THETA_CONSOLIDATION_COEFFICIENT_FOR_LONG_TERM = 0.4;
exports.ETA_REINFORCEMENT_FACTOR_FOR_TRACE_LEARNING = 0.18;
exports.LAMBDA_ONE_FAST_DECAY_RATE = 0.015;
exports.LAMBDA_TWO_SLOW_DECAY_RATE = 0.002;
exports.TAU_ENERGY_THRESHOLD_FOR_RETRIEVAL = 0.4;
exports.SECTORAL_INTERDEPENDENCE_MATRIX_FOR_COGNITIVE_RESONANCE = [
    [1.0, 0.7, 0.3, 0.6, 0.6],
    [0.7, 1.0, 0.4, 0.7, 0.8],
    [0.3, 0.4, 1.0, 0.5, 0.2],
    [0.6, 0.7, 0.5, 1.0, 0.8],
    [0.6, 0.8, 0.2, 0.8, 1.0],
];
exports.SECTOR_INDEX_MAPPING_FOR_MATRIX_LOOKUP = {
    episodic: 0,
    semantic: 1,
    procedural: 2,
    emotional: 3,
    reflective: 4,
};
const sig = (x) => 1 / (1 + Math.exp(-x));
const linkW = (sem, emo, α = 0.7, β = 0.3) => sig(α * sem + β * emo);
exports.linkW = linkW;
async function calculateDynamicSalienceWithTimeDecay(i, λ, r, e, t) {
    const d = i * Math.exp(-λ * t);
    const rc = exports.ALPHA_LEARNING_RATE_FOR_RECALL_REINFORCEMENT * r;
    const ef = exports.BETA_LEARNING_RATE_FOR_EMOTIONAL_FREQUENCY * e;
    return Math.max(0, Math.min(1, d + rc + ef));
}
async function calculateDualPhaseDecayMemoryRetention(t) {
    const f = Math.exp(-exports.LAMBDA_ONE_FAST_DECAY_RATE * t);
    const s = exports.THETA_CONSOLIDATION_COEFFICIENT_FOR_LONG_TERM *
        Math.exp(-exports.LAMBDA_TWO_SLOW_DECAY_RATE * t);
    return Math.max(0, Math.min(1, f + s));
}
async function calculateAssociativeWaypointLinkWeight(sv, tv, tg) {
    const sim = (0, embed_1.cosineSimilarity)(sv, tv);
    const td = tg / 86400000;
    return Math.max(0, sim / (1 + td));
}
async function calculateSpreadingActivationEnergyForNode(nid, an, gr) {
    const nd = gr.get(nid);
    if (!nd)
        return 0;
    let tot = 0;
    for (const e of nd.connected_waypoint_edges) {
        const na = an.get(e.target_node_id) || 0;
        const att = Math.exp(-exports.GAMMA_ATTENUATION_CONSTANT_FOR_GRAPH_DISTANCE * 1);
        tot += e.link_weight_value * na * att;
    }
    return tot;
}
async function applyRetrievalTraceReinforcementToMemory(mid, sal) {
    return Math.min(1, sal + exports.ETA_REINFORCEMENT_FACTOR_FOR_TRACE_LEARNING * (1 - sal));
}
async function propagateAssociativeReinforcementToLinkedNodes(sid, ssal, wps) {
    const ups = [];
    for (const wp of wps) {
        const ld = (await (0, db_1.get_async)("select salience from memories where id=?", [wp.target_id]));
        if (ld) {
            const pr = exports.ETA_REINFORCEMENT_FACTOR_FOR_TRACE_LEARNING * wp.weight * ssal;
            ups.push({
                node_id: wp.target_id,
                new_salience: Math.min(1, ld.salience + pr),
            });
        }
    }
    return ups;
}
async function calculateCrossSectorResonanceScore(ms, qs, bs) {
    const si = exports.SECTOR_INDEX_MAPPING_FOR_MATRIX_LOOKUP[ms] ?? 1;
    const ti = exports.SECTOR_INDEX_MAPPING_FOR_MATRIX_LOOKUP[qs] ?? 1;
    return bs * exports.SECTORAL_INTERDEPENDENCE_MATRIX_FOR_COGNITIVE_RESONANCE[si][ti];
}
async function determineEnergyBasedRetrievalThreshold(act, tau) {
    const nrm = Math.max(0.1, act);
    return Math.max(0.1, Math.min(0.9, tau * (1 + Math.log(nrm + 1))));
}
async function applyDualPhaseDecayToAllMemories() {
    const mems = await (0, db_1.all_async)("select id,salience,decay_lambda,last_seen_at,updated_at,created_at from memories");
    const ts = (0, utils_1.now)();
    const ops = mems.map(async (m) => {
        const tms = Math.max(0, ts - (m.last_seen_at || m.updated_at));
        const td = tms / 86400000;
        const rt = await calculateDualPhaseDecayMemoryRetention(td);
        const nsal = m.salience * rt;
        await (0, db_1.run_async)(`update ${db_1.memories_table} set salience=?,updated_at=? where id=?`, [Math.max(0, nsal), ts, m.id]);
    });
    await Promise.all(ops);
    console.log(`[DECAY] Applied to ${mems.length} memories`);
}
async function buildAssociativeWaypointGraphFromMemories() {
    const gr = new Map();
    const wps = (await (0, db_1.all_async)("select src_id,dst_id,weight,created_at from waypoints"));
    const ids = new Set();
    for (const wp of wps) {
        ids.add(wp.src_id);
        ids.add(wp.dst_id);
    }
    for (const id of ids)
        gr.set(id, {
            node_memory_id: id,
            activation_energy_level: 0,
            connected_waypoint_edges: [],
        });
    for (const wp of wps) {
        const sn = gr.get(wp.src_id);
        if (sn) {
            const tg = Math.abs((0, utils_1.now)() - wp.created_at);
            sn.connected_waypoint_edges.push({
                target_node_id: wp.dst_id,
                link_weight_value: wp.weight,
                time_gap_delta_t: tg,
            });
        }
    }
    return gr;
}
async function performSpreadingActivationRetrieval(init, max) {
    const gr = await buildAssociativeWaypointGraphFromMemories();
    const act = new Map();
    for (const id of init)
        act.set(id, 1.0);
    for (let i = 0; i < max; i++) {
        const ups = new Map();
        for (const [nid, ca] of act) {
            const nd = gr.get(nid);
            if (!nd)
                continue;
            for (const e of nd.connected_waypoint_edges) {
                const pe = await calculateSpreadingActivationEnergyForNode(e.target_node_id, act, gr);
                const ex = ups.get(e.target_node_id) || 0;
                ups.set(e.target_node_id, ex + pe);
            }
        }
        for (const [uid, nav] of ups) {
            const cv = act.get(uid) || 0;
            act.set(uid, Math.max(cv, nav));
        }
    }
    return act;
}
async function retrieveMemoriesWithEnergyThresholding(qv, qs, me) {
    const mems = (await (0, db_1.all_async)("select id,content,primary_sector,salience,mean_vec from memories where salience>0.01"));
    const sc = new Map();
    for (const m of mems) {
        if (!m.mean_vec)
            continue;
        const buf = Buffer.isBuffer(m.mean_vec)
            ? m.mean_vec
            : Buffer.from(m.mean_vec);
        const ev = [];
        for (let i = 0; i < buf.length; i += 4)
            ev.push(buf.readFloatLE(i));
        const bs = (0, embed_1.cosineSimilarity)(qv, ev);
        const cs = await calculateCrossSectorResonanceScore(m.primary_sector, qs, bs);
        sc.set(m.id, cs * m.salience);
    }
    const sp = await performSpreadingActivationRetrieval(Array.from(sc.keys()).slice(0, 5), 3);
    const cmb = new Map();
    for (const m of mems)
        cmb.set(m.id, (sc.get(m.id) || 0) + (sp.get(m.id) || 0) * 0.3);
    const te = Array.from(cmb.values()).reduce((s, v) => s + v, 0);
    const thr = await determineEnergyBasedRetrievalThreshold(te, me);
    return mems
        .filter((m) => (cmb.get(m.id) || 0) > thr)
        .map((m) => ({ ...m, activation_energy: cmb.get(m.id) }));
}
exports.apply_decay = applyDualPhaseDecayToAllMemories;
