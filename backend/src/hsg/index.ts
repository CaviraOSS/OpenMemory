import crypto from 'node:crypto'
import { buildSearchDocument, buildFtsQuery, canonicalTokenSet } from '../utils/text'
import { incQ, decQ } from '../decay'
export interface SectorConfig {
    model: string
    decay_lambda: number
    weight: number
    patterns: RegExp[]
}
export interface SectorClassification {
    primary: string
    additional: string[]
    confidence: number
}
export interface HSGMemory {
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
export interface WayPoint {
    src_id: string
    dst_id: string
    weight: number
    created_at: number
    updated_at: number
}
export interface HSGQueryResult {
    id: string
    content: string
    score: number
    sectors: string[]
    primary_sector: string
    path: string[]
    salience: number
    last_seen_at: number
}
export const SECTOR_CONFIGS: Record<string, SectorConfig> = {
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
export const SECTORS = Object.keys(SECTOR_CONFIGS)
export const SCORING_WEIGHTS = {
    similarity: 0.6,
    salience: 0.2,
    recency: 0.1,
    waypoint: 0.1
}
export const REINFORCEMENT = {
    salience_boost: 0.1,
    waypoint_boost: 0.05,
    max_salience: 1.0,
    max_waypoint_weight: 1.0,
    prune_threshold: 0.05
}
export function classifyContent(content: string, metadata?: any): SectorClassification {
    if (metadata?.sector && SECTORS.includes(metadata.sector)) {
        return {
            primary: metadata.sector,
            additional: [],
            confidence: 1.0
        }
    }
    const scores: Record<string, number> = {}
    for (const [sector, config] of Object.entries(SECTOR_CONFIGS)) {
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
export function calculateDecay(sector: string, initialSalience: number, daysSinceLastSeen: number): number {
    const config = SECTOR_CONFIGS[sector]
    if (!config) return initialSalience
    const decayed = initialSalience * Math.exp(-config.decay_lambda * daysSinceLastSeen)
    return Math.max(0, decayed)
}
export function calculateRecencyScore(lastSeenAt: number): number {
    const now = Date.now()
    const daysSince = (now - lastSeenAt) / (1000 * 60 * 60 * 24)
    return Math.exp(-daysSince / 30)
}
export function computeRetrievalScore(
    similarity: number,
    salience: number,
    lastSeenAt: number,
    waypointWeight: number = 0
): number {
    const recencyScore = calculateRecencyScore(lastSeenAt)
    return (
        SCORING_WEIGHTS.similarity * similarity +
        SCORING_WEIGHTS.salience * salience +
        SCORING_WEIGHTS.recency * recencyScore +
        SCORING_WEIGHTS.waypoint * waypointWeight
    )
}
import { q, transaction } from '../database'
export async function createCrossSectorWaypoints(
    primaryId: string,
    primarySector: string,
    additionalSectors: string[]
): Promise<void> {
    const now = Date.now()
    const weight = 0.5
    for (const sector of additionalSectors) {
        await q.ins_waypoint.run(primaryId, `${primaryId}:${sector}`, weight, now, now)
        await q.ins_waypoint.run(`${primaryId}:${sector}`, primaryId, weight, now, now)
    }
}

export function calculateMeanVector(embeddingResults: EmbeddingResult[], sectors: string[]): number[] {
    const dim = embeddingResults[0].vector.length
    const meanVector = new Array(dim).fill(0)
    let totalWeight = 0

    for (const result of embeddingResults) {
        const sectorWeight = SECTOR_CONFIGS[result.sector]?.weight || 1.0
        totalWeight += sectorWeight

        for (let i = 0; i < dim; i++) {
            meanVector[i] += result.vector[i] * sectorWeight
        }
    }

    for (let i = 0; i < dim; i++) {
        meanVector[i] /= totalWeight
    }

    return meanVector
}

export async function createSingleWaypoint(
    newId: string,
    newMeanVector: number[],
    timestamp: number
): Promise<void> {
    const threshold = 0.75
    const memories = await q.all_mem.all(1000, 0)

    let bestMatch: { id: string, similarity: number } | null = null

    for (const mem of memories) {
        if (mem.id === newId || !mem.mean_vec) continue

        const existingMean = bufferToVector(mem.mean_vec)
        const similarity = cosineSimilarity(newMeanVector, existingMean)

        if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { id: mem.id, similarity }
        }
    }

    if (bestMatch) {
        await q.ins_waypoint.run(newId, bestMatch.id, bestMatch.similarity, timestamp, timestamp)
    } else {
        await q.ins_waypoint.run(newId, newId, 1.0, timestamp, timestamp)
    }
}

export async function createInterMemoryWaypoints(
    newId: string,
    primarySector: string,
    newVector: number[],
    timestamp: number
): Promise<void> {
    const threshold = 0.75
    const weight = 0.5
    const vectors = await q.get_vecs_by_sector.all(primarySector)

    for (const vecRow of vectors) {
        if (vecRow.id === newId) continue

        const existingVector = bufferToVector(vecRow.v)
        const similarity = cosineSimilarity(newVector, existingVector)

        if (similarity >= threshold) {
            await q.ins_waypoint.run(newId, vecRow.id, weight, timestamp, timestamp)
            await q.ins_waypoint.run(vecRow.id, newId, weight, timestamp, timestamp)
        }
    }
}
export async function createContextualWaypoints(
    memoryId: string,
    relatedMemoryIds: string[],
    baseWeight: number = 0.3
): Promise<void> {
    const now = Date.now()
    for (const relatedId of relatedMemoryIds) {
        if (memoryId === relatedId) continue
        const existing = await q.get_waypoint.get(memoryId, relatedId)
        if (existing) {
            const newWeight = Math.min(1.0, existing.weight + 0.1)
            await q.upd_waypoint.run(newWeight, now, memoryId, relatedId)
        } else {
            await q.ins_waypoint.run(memoryId, relatedId, baseWeight, now, now)
        }
    }
}
export async function expandViaWaypoints(
    initialResults: string[],
    maxExpansions: number = 10
): Promise<Array<{ id: string, weight: number, path: string[] }>> {
    const expanded: Array<{ id: string, weight: number, path: string[] }> = []
    const visited = new Set<string>()
    for (const id of initialResults) {
        expanded.push({ id, weight: 1.0, path: [id] })
        visited.add(id)
    }
    const queue = [...expanded]
    let expansionCount = 0
    while (queue.length > 0 && expansionCount < maxExpansions) {
        const current = queue.shift()!
        const neighbors = await q.get_neighbors.all(current.id)
        for (const neighbor of neighbors) {
            if (visited.has(neighbor.dst_id)) continue
            const expandedWeight = current.weight * neighbor.weight * 0.8
            if (expandedWeight < 0.1) continue
            const expandedItem = {
                id: neighbor.dst_id,
                weight: expandedWeight,
                path: [...current.path, neighbor.dst_id]
            }
            expanded.push(expandedItem)
            visited.add(neighbor.dst_id)
            queue.push(expandedItem)
            expansionCount++
        }
    }
    return expanded
}
export async function reinforceWaypoints(traversedPath: string[]): Promise<void> {
    const now = Date.now()
    for (let i = 0; i < traversedPath.length - 1; i++) {
        const srcId = traversedPath[i]
        const dstId = traversedPath[i + 1]
        const waypoint = await q.get_waypoint.get(srcId, dstId)
        if (waypoint) {
            const newWeight = Math.min(REINFORCEMENT.max_waypoint_weight,
                waypoint.weight + REINFORCEMENT.waypoint_boost)
            await q.upd_waypoint.run(newWeight, now, srcId, dstId)
        }
    }
}
export async function pruneWeakWaypoints(): Promise<number> {
    await q.prune_waypoints.run(REINFORCEMENT.prune_threshold)
    return 0
}
import { embedForSector, embedMultiSector, cosineSimilarity, bufferToVector, vectorToBuffer, EmbeddingResult } from '../embedding'
import { chunkText } from '../utils/chunking'
import { j } from '../utils'
import {
    calculateCrossSectorResonanceScore,
    applyRetrievalTraceReinforcementToMemory,
    propagateAssociativeReinforcementToLinkedNodes,
    ALPHA_LEARNING_RATE_FOR_RECALL_REINFORCEMENT,
    BETA_LEARNING_RATE_FOR_EMOTIONAL_FREQUENCY
} from '../memory-dynamics'

export interface MultiVectorEmbeddingFusionWeights {
    semantic_dimension_weight: number
    emotional_dimension_weight: number
    procedural_dimension_weight: number
    temporal_dimension_weight: number
    reflective_dimension_weight: number
}

export async function calculateMultiVectorFusionScore(
    mid: string,
    qe: Record<string, number[]>,
    w: MultiVectorEmbeddingFusionWeights
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

const cache = new Map<string, { r: HSGQueryResult[], t: number }>()
const salCache = new Map<string, { s: number, t: number }>()
const coactBuf: Array<[string, string]> = []
const TTL = 60000

setInterval(async () => {
    if (!coactBuf.length) return
    const pairs = coactBuf.splice(0, 50) // Limit batch size
    const n = Date.now()
    for (const [a, b] of pairs) {
        try {
            const wp = await q.get_waypoint.get(a, b)
            const w = wp ? Math.min(1, wp.weight + 0.05) : 0.05
            await q.ins_waypoint.run(a, b, w, wp?.created_at || n, n)
        } catch (e) {
        }
    }
}, 1000)

const getSal = async (id: string, defSal: number): Promise<number> => {
    const c = salCache.get(id)
    if (c && Date.now() - c.t < TTL) return c.s
    const m = await q.get_mem.get(id)
    const s = m?.salience ?? defSal
    salCache.set(id, { s, t: Date.now() })
    return s
}

export async function hsgQuery(qt: string, k = 10, f?: { sectors?: string[], minSalience?: number }): Promise<HSGQueryResult[]> {
    incQ()
    try {
        const h = `${qt}:${k}:${JSON.stringify(f || {})}`
        const cached = cache.get(h)
        if (cached && Date.now() - cached.t < TTL) return cached.r

        const qc = classifyContent(qt)
        const cs = [qc.primary, ...qc.additional]
        const qtk = canonicalTokenSet(qt)
        const lex = new Map<string, number>()
        const ss = f?.sectors?.length ? cs.filter(s => f.sectors!.includes(s)) : cs
        if (!ss.length) ss.push('semantic')

        const qe: Record<string, number[]> = {}
        for (const s of ss) qe[s] = await embedForSector(qt, s)

        const w: MultiVectorEmbeddingFusionWeights = {
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
                const mv = bufferToVector(vr.v)
                const sim = cosineSimilarity(qv, mv)
                sims.push({ id: vr.id, similarity: sim })
            }
            sims.sort((a, b) => b.similarity - a.similarity)
            sr[s] = sims.slice(0, k)
        }

        const ids = new Set<string>()
        for (const r of Object.values(sr)) for (const x of r) ids.add(x.id)

        const lq = buildFtsQuery(qt)
        if (lq) {
            try {
                const lr = await q.search_fts.all(lq, Math.max(k * 4, 20))
                lr.forEach((row: any, i: number) => {
                    const bm = typeof row.score === 'number' ? row.score : i + 1
                    const sc = 5 + 1 / (1 + bm)
                    const p = lex.get(row.id) ?? 0
                    if (sc > p) lex.set(row.id, sc)
                    ids.add(row.id)
                })
            } catch { }
        }

        const exp = await expandViaWaypoints(Array.from(ids), k * 2)
        for (const e of exp) ids.add(e.id)

        const res: HSGQueryResult[] = []
        for (const mid of Array.from(ids)) {
            const m = await q.get_mem.get(mid)
            if (!m || (f?.minSalience && m.salience < f.minSalience)) continue

            const mvf = await calculateMultiVectorFusionScore(mid, qe, w)
            const csr = await calculateCrossSectorResonanceScore(m.primary_sector, qc.primary, mvf)

            let bs = csr, bsec = m.primary_sector
            for (const [sec, rr] of Object.entries(sr)) {
                const mat = rr.find(r => r.id === mid)
                if (mat && mat.similarity > bs) { bs = mat.similarity; bsec = sec }
            }

            const em = exp.find(e => e.id === mid)
            const ww = em?.weight || 0
            const ds = (Date.now() - m.last_seen_at) / 86400000
            const sal = calculateDecay(m.primary_sector, m.salience, ds)
            const mtk = canonicalTokenSet(m.content)
            let ovlap = 0
            if (qtk.size) for (const t of qtk) if (mtk.has(t)) ovlap++
            const ovr = qtk.size ? ovlap / qtk.size : 0
            const lb = Math.max(lex.get(mid) ?? 0, ovr > 0 ? 4 + ovr * 6 : 0)

            let fs = computeRetrievalScore(bs, sal, m.last_seen_at, ww)
            if (lb > fs) fs = lb
            else if (lb > 0) fs += lb * 0.2

            const msec = await q.get_vecs_by_id.all(mid)
            const sl = msec.map(v => v.sector)
            res.push({ id: mid, content: m.content, score: fs, sectors: sl, primary_sector: m.primary_sector, path: em?.path || [mid], salience: sal, last_seen_at: m.last_seen_at })
        }

        res.sort((a, b) => b.score - a.score)
        const top = res.slice(0, k)

        const tids = top.map(r => r.id)
        for (let i = 0; i < tids.length; i++) {
            for (let j = i + 1; j < tids.length; j++) {
                const [a, b] = [tids[i], tids[j]].sort()
                coactBuf.push([a, b])
            }
        }

        for (const r of top) {
            const rsal = await applyRetrievalTraceReinforcementToMemory(r.id, r.salience)
            await q.upd_seen.run(r.id, Date.now(), rsal, Date.now())
            if (r.path.length > 1) {
                await reinforceWaypoints(r.path)
                const wps = await q.get_waypoints_by_src.all(r.id)
                const lns = wps.map((wp: any) => ({ target_id: wp.dst_id, weight: wp.weight }))
                const pru = await propagateAssociativeReinforcementToLinkedNodes(r.id, rsal, lns)
                for (const u of pru) await q.upd_seen.run(u.node_id, Date.now(), u.new_salience, Date.now())
            }
        }

        cache.set(h, { r: top, t: Date.now() })
        return top
    } finally {
        decQ()
    }
}

export async function runDecayProcess(): Promise<{ processed: number, decayed: number }> {
    const mems = await q.all_mem.all(10000, 0)
    let p = 0, d = 0
    for (const m of mems) {
        const ds = (Date.now() - m.last_seen_at) / 86400000
        const ns = calculateDecay(m.primary_sector, m.salience, ds)
        if (ns !== m.salience) { await q.upd_seen.run(m.id, m.last_seen_at, ns, Date.now()); d++ }
        p++
    }
    return { processed: p, decayed: d }
}

export async function addHSGMemory(
    content: string,
    tags?: string,
    metadata?: any
): Promise<{ id: string, primary_sector: string, sectors: string[], chunks?: number }> {
    const id = crypto.randomUUID()
    const now = Date.now()

    const chunks = chunkText(content)
    const useChunking = chunks.length > 1

    const classification = classifyContent(content, metadata)
    const allSectors = [classification.primary, ...classification.additional]

    await transaction.begin()

    try {

        const sectorConfig = SECTOR_CONFIGS[classification.primary]
        const initialSalience = Math.max(0, Math.min(1, 0.4 + 0.1 * classification.additional.length))
        await q.ins_mem.run(
            id,
            content,
            classification.primary,
            tags || null,
            JSON.stringify(metadata || {}),
            now,
            now,
            now,
            initialSalience,
            sectorConfig.decay_lambda,
            1,
            null,
            null
        )
        await q.del_fts.run(id)
        await q.ins_fts.run(id, buildSearchDocument(content))

        const embeddingResults = await embedMultiSector(id, content, allSectors, useChunking ? chunks : undefined)
        for (const result of embeddingResults) {
            const vectorBuffer = vectorToBuffer(result.vector)
            await q.ins_vec.run(id, result.sector, vectorBuffer, result.dim)
        }

        const meanVector = calculateMeanVector(embeddingResults, allSectors)
        const meanVectorBuffer = vectorToBuffer(meanVector)
        await q.upd_mean_vec.run(id, meanVector.length, meanVectorBuffer)

        await createSingleWaypoint(id, meanVector, now)

        await transaction.commit()

        return {
            id,
            primary_sector: classification.primary,
            sectors: allSectors,
            chunks: chunks.length
        }
    } catch (error) {

        await transaction.rollback()
        throw error
    }
}
export async function reinforceMemory(id: string, boost: number = 0.1): Promise<void> {
    const memory = await q.get_mem.get(id)
    if (!memory) throw new Error(`Memory ${id} not found`)
    const newSalience = Math.min(REINFORCEMENT.max_salience, memory.salience + boost)
    await q.upd_seen.run(Date.now(), newSalience, Date.now(), id)
}

export async function updateMemory(
    id: string,
    content?: string,
    tags?: string[],
    metadata?: any
): Promise<{ id: string, updated: boolean }> {
    const memory = await q.get_mem.get(id)
    if (!memory) throw new Error(`Memory ${id} not found`)

    const newContent = content !== undefined ? content : memory.content
    const newTags = tags !== undefined ? j(tags) : (memory.tags || '[]')
    const newMetadata = metadata !== undefined ? j(metadata) : (memory.meta || '{}')

    await transaction.begin()

    try {
        if (content !== undefined && content !== memory.content) {
            const chunks = chunkText(newContent)
            const useChunking = chunks.length > 1
            const classification = classifyContent(newContent, metadata)
            const allSectors = [classification.primary, ...classification.additional]

            await q.del_vec.run(id)

            const embeddingResults = await embedMultiSector(id, newContent, allSectors, useChunking ? chunks : undefined)
            for (const result of embeddingResults) {
                const vectorBuffer = vectorToBuffer(result.vector)
                await q.ins_vec.run(id, result.sector, vectorBuffer, result.dim)
            }

            const meanVector = calculateMeanVector(embeddingResults, allSectors)
            const meanVectorBuffer = vectorToBuffer(meanVector)
            await q.upd_mean_vec.run(id, meanVector.length, meanVectorBuffer)

            await q.upd_mem_with_sector.run(newContent, classification.primary, newTags, newMetadata, Date.now(), id)
        } else {
            await q.upd_mem.run(newContent, newTags, newMetadata, Date.now(), id)
        }

        await transaction.commit()
        return { id, updated: true }
    } catch (error) {
        await transaction.rollback()
        throw error
    }
}
