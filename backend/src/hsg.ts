import crypto from 'node:crypto'
import { buildSearchDocument, buildFtsQuery, canonicalTokenSet } from './utils/text'
import { embedForSector, embedMultiSector, cosineSimilarity, bufferToVector, vectorToBuffer, EmbeddingResult } from './embedding'
import { chunkText } from './utils/chunking'
import { j } from './utils'
import { q, transaction } from './utils/database'
import {
    calculateCrossSectorResonanceScore,
    applyRetrievalTraceReinforcementToMemory,
    propagateAssociativeReinforcementToLinkedNodes,
    ALPHA_LEARNING_RATE_FOR_RECALL_REINFORCEMENT,
    BETA_LEARNING_RATE_FOR_EMOTIONAL_FREQUENCY
} from './memoryDynamics'

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

export interface MultiVectorEmbeddingFusionWeights {
    semantic_dimension_weight: number
    emotional_dimension_weight: number
    procedural_dimension_weight: number
    temporal_dimension_weight: number
    reflective_dimension_weight: number
}

export async function calculateMultiVectorFusionScore(
    memory_id_for_scoring: string,
    query_embeddings_by_sector: Record<string, number[]>,
    context_adaptive_weights: MultiVectorEmbeddingFusionWeights
): Promise<number> {
    const all_vector_embeddings_for_memory = await q.get_vecs_by_id.all(memory_id_for_scoring)

    let accumulated_weighted_similarity_score = 0
    let total_weight_normalization_factor = 0

    const sector_to_weight_mapping: Record<string, number> = {
        'semantic': context_adaptive_weights.semantic_dimension_weight,
        'emotional': context_adaptive_weights.emotional_dimension_weight,
        'procedural': context_adaptive_weights.procedural_dimension_weight,
        'episodic': context_adaptive_weights.temporal_dimension_weight,
        'reflective': context_adaptive_weights.reflective_dimension_weight
    }

    for (const vector_embedding_record of all_vector_embeddings_for_memory) {
        const sector_type_of_embedding = vector_embedding_record.sector
        const query_embedding_for_sector = query_embeddings_by_sector[sector_type_of_embedding]

        if (!query_embedding_for_sector) continue

        const memory_vector_buffer = bufferToVector(vector_embedding_record.v)
        const cosine_similarity_for_this_sector = cosineSimilarity(query_embedding_for_sector, memory_vector_buffer)

        const weight_for_this_cognitive_dimension = sector_to_weight_mapping[sector_type_of_embedding] || 0.5

        accumulated_weighted_similarity_score += cosine_similarity_for_this_sector * weight_for_this_cognitive_dimension
        total_weight_normalization_factor += weight_for_this_cognitive_dimension
    }

    const normalized_multi_vector_fusion_score = total_weight_normalization_factor > 0
        ? accumulated_weighted_similarity_score / total_weight_normalization_factor
        : 0

    return normalized_multi_vector_fusion_score
}

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
        searchSectors.push('semantic')
    }
    const queryEmbeddings: Record<string, number[]> = {}
    for (const sector of searchSectors) {
        queryEmbeddings[sector] = await embedForSector(queryText, sector)
    }

    const context_based_fusion_weights: MultiVectorEmbeddingFusionWeights = {
        semantic_dimension_weight: queryClassification.primary === 'semantic' ? 1.2 : 0.8,
        emotional_dimension_weight: queryClassification.primary === 'emotional' ? 1.5 : 0.6,
        procedural_dimension_weight: queryClassification.primary === 'procedural' ? 1.3 : 0.7,
        temporal_dimension_weight: queryClassification.primary === 'episodic' ? 1.4 : 0.7,
        reflective_dimension_weight: queryClassification.primary === 'reflective' ? 1.1 : 0.5
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

        const multi_vector_fusion_similarity_score = await calculateMultiVectorFusionScore(
            memoryId,
            queryEmbeddings,
            context_based_fusion_weights
        )

        const cross_sector_resonance_modulated_score = await calculateCrossSectorResonanceScore(
            memory.primary_sector,
            queryClassification.primary,
            multi_vector_fusion_similarity_score
        )

        let bestSimilarity = cross_sector_resonance_modulated_score
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
        const reinforced_salience_after_retrieval = await applyRetrievalTraceReinforcementToMemory(
            result.id,
            result.salience
        )

        await q.upd_seen.run(result.id, Date.now(), reinforced_salience_after_retrieval, Date.now())

        if (result.path.length > 1) {
            await reinforceWaypoints(result.path)

            const waypoints_for_propagation = await q.get_waypoints_by_src.all(result.id)
            const linked_nodes_with_weights = waypoints_for_propagation.map((wp: any) => ({
                target_id: wp.dst_id,
                weight: wp.weight
            }))

            const propagated_reinforcement_updates = await propagateAssociativeReinforcementToLinkedNodes(
                result.id,
                reinforced_salience_after_retrieval,
                linked_nodes_with_weights
            )

            for (const reinforcement_update of propagated_reinforcement_updates) {
                await q.upd_seen.run(
                    reinforcement_update.node_id,
                    Date.now(),
                    reinforcement_update.new_salience,
                    Date.now()
                )
            }
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
            await q.upd_seen.run(memory.id, memory.last_seen_at, newSalience, Date.now())
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

    // Use existing values if not provided, and ensure consistent JSON stringification
    const newContent = content !== undefined ? content : memory.content
    const newTags = tags !== undefined ? j(tags) : (memory.tags || '[]')
    const newMetadata = metadata !== undefined ? j(metadata) : (memory.meta || '{}')

    await transaction.begin()

    try {
        // If content changed, we need to update embeddings and potentially the primary sector
        if (content !== undefined && content !== memory.content) {
            const chunks = chunkText(newContent)
            const useChunking = chunks.length > 1
            const classification = classifyContent(newContent, metadata)
            const allSectors = [classification.primary, ...classification.additional]

            // Delete old vectors
            await q.del_vec.run(id)

            // Create new embeddings
            const embeddingResults = await embedMultiSector(id, newContent, allSectors, useChunking ? chunks : undefined)
            for (const result of embeddingResults) {
                const vectorBuffer = vectorToBuffer(result.vector)
                await q.ins_vec.run(id, result.sector, vectorBuffer, result.dim)
            }

            // Update mean vector
            const meanVector = calculateMeanVector(embeddingResults, allSectors)
            const meanVectorBuffer = vectorToBuffer(meanVector)
            await q.upd_mean_vec.run(id, meanVector.length, meanVectorBuffer)

            await q.upd_mem_with_sector.run(newContent, classification.primary, newTags, newMetadata, Date.now(), id)
        } else {
            // Just update the memory record without changing embeddings
            await q.upd_mem.run(newContent, newTags, newMetadata, Date.now(), id)
        }

        await transaction.commit()
        return { id, updated: true }
    } catch (error) {
        await transaction.rollback()
        throw error
    }
}
