import crypto from 'node:crypto'
import { buildSearchDocument, buildFtsQuery, canonicalTokenSet } from '../utils/text'
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
        primary: primaryScore > 0 ? primary : 'semantic', // Default to semantic
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

        if (similarity >= threshold && (!bestMatch || similarity > bestMatch.similarity)) {
            bestMatch = { id: mem.id, similarity }
        }
    }

    if (bestMatch) {
        await q.ins_waypoint.run(newId, bestMatch.id, bestMatch.similarity, timestamp, timestamp)
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
export async function hsgQuery(
    queryText: string,
    k: number = 10,
    filters?: { sectors?: string[], minSalience?: number }
): Promise<HSGQueryResult[]> {
    const queryClassification = classifyContent(queryText)
    const candidateSectors = [queryClassification.primary, ...queryClassification.additional]
    const queryTokens = canonicalTokenSet(queryText)
    const lexicalScores = new Map<string, number>()
    const searchSectors = filters?.sectors?.length ?
        candidateSectors.filter(s => filters.sectors!.includes(s)) :
        candidateSectors
    if (searchSectors.length === 0) {
        searchSectors.push('semantic') // Fallback
    }
    const queryEmbeddings: Record<string, number[]> = {}
    for (const sector of searchSectors) {
        queryEmbeddings[sector] = await embedForSector(queryText, sector)
    }
    const sectorResults: Record<string, Array<{ id: string, similarity: number }>> = {}
    for (const sector of searchSectors) {
        const queryVec = queryEmbeddings[sector]
        const vectors = await q.get_vecs_by_sector.all(sector)
        const similarities: Array<{ id: string, similarity: number }> = []
        for (const vecRow of vectors) {
            const memoryVec = bufferToVector(vecRow.v)
            const similarity = cosineSimilarity(queryVec, memoryVec)
            similarities.push({ id: vecRow.id, similarity })
        }
        similarities.sort((a, b) => b.similarity - a.similarity)
        sectorResults[sector] = similarities.slice(0, k)
    }
    const allMemoryIds = new Set<string>()
    for (const results of Object.values(sectorResults)) {
        for (const result of results) {
            allMemoryIds.add(result.id)
        }
    }
    const lexicalQuery = buildFtsQuery(queryText)
    if (lexicalQuery) {
        try {
            const lexicalRows = await q.search_fts.all(lexicalQuery, Math.max(k * 4, 20))
            lexicalRows.forEach((row: any, index: number) => {
                const bm25Score = typeof row.score === 'number' ? row.score : index + 1
                const score = 5 + 1 / (1 + bm25Score)
                const previous = lexicalScores.get(row.id) ?? 0
                if (score > previous) lexicalScores.set(row.id, score)
                allMemoryIds.add(row.id)
            })
        } catch (error) {
            console.warn('[HSG] FTS search failed, continuing with embedding results:', error)
        }
    }
    const expandedResults = await expandViaWaypoints(Array.from(allMemoryIds), k * 2)
    for (const expanded of expandedResults) {
        allMemoryIds.add(expanded.id)
    }
    const finalResults: HSGQueryResult[] = []
    for (const memoryId of Array.from(allMemoryIds)) {
        const memory = await q.get_mem.get(memoryId)
        if (!memory) continue
        if (filters?.minSalience && memory.salience < filters.minSalience) continue
        let bestSimilarity = 0
        let bestSector = memory.primary_sector
        for (const [sector, results] of Object.entries(sectorResults)) {
            const match = results.find(r => r.id === memoryId)
            if (match && match.similarity > bestSimilarity) {
                bestSimilarity = match.similarity
                bestSector = sector
            }
        }
        const expandedMatch = expandedResults.find(e => e.id === memoryId)
        const waypointWeight = expandedMatch?.weight || 0
        const daysSinceLastSeen = (Date.now() - memory.last_seen_at) / (1000 * 60 * 60 * 24)
        const currentSalience = calculateDecay(memory.primary_sector, memory.salience, daysSinceLastSeen)
        const memoryTokenSet = canonicalTokenSet(memory.content)
        let overlap = 0
        if (queryTokens.size) {
            for (const token of queryTokens) {
                if (memoryTokenSet.has(token)) overlap++
            }
        }
        const overlapRatio = queryTokens.size ? overlap / queryTokens.size : 0
        const lexicalBoost = Math.max(
            lexicalScores.get(memoryId) ?? 0,
            overlapRatio > 0 ? 4 + overlapRatio * 6 : 0
        )
        let finalScore = computeRetrievalScore(
            bestSimilarity,
            currentSalience,
            memory.last_seen_at,
            waypointWeight
        )
        if (lexicalBoost > finalScore) {
            finalScore = lexicalBoost
        } else if (lexicalBoost > 0) {
            finalScore += lexicalBoost * 0.2
        }
        const memorySectors = await q.get_vecs_by_id.all(memoryId)
        const sectorList = memorySectors.map(v => v.sector)
        finalResults.push({
            id: memoryId,
            content: memory.content,
            score: finalScore,
            sectors: sectorList,
            primary_sector: memory.primary_sector,
            path: expandedMatch?.path || [memoryId],
            salience: currentSalience,
            last_seen_at: memory.last_seen_at
        })
    }
    finalResults.sort((a, b) => b.score - a.score)
    const topResults = finalResults.slice(0, k)
    for (const result of topResults) {
        const newSalience = Math.min(REINFORCEMENT.max_salience,
            result.salience + REINFORCEMENT.salience_boost)
        await q.upd_seen.run(Date.now(), newSalience, Date.now(), result.id)
        if (result.path.length > 1) {
            await reinforceWaypoints(result.path)
        }
    }
    return topResults
}
export async function runDecayProcess(): Promise<{ processed: number, decayed: number }> {
    const memories = await q.all_mem.all(10000, 0)
    let processed = 0
    let decayed = 0
    for (const memory of memories) {
        const daysSinceLastSeen = (Date.now() - memory.last_seen_at) / (1000 * 60 * 60 * 24)
        const newSalience = calculateDecay(memory.primary_sector, memory.salience, daysSinceLastSeen)
        if (newSalience !== memory.salience) {
            await q.upd_seen.run(memory.last_seen_at, newSalience, Date.now(), memory.id)
            decayed++
        }
        processed++
    }
    return { processed, decayed }
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
        await q.upd_mean_vec.run(meanVector.length, meanVectorBuffer, id)

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
