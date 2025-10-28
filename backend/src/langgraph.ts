import { env } from './utils/config'
import { addHSGMemory, hsgQuery } from './hsg'
import { q } from './utils/database'
import { now, j } from './utils'
import type {
    lgm_store_req,
    lgm_retrieve_req,
    lgm_context_req,
    lgm_reflection_req,
    SectorType
} from './types'

type MemoryRow = {
    id: string
    content: string
    primary_sector: string
    tags: string | null
    meta: string | null
    created_at: number
    updated_at: number
    last_seen_at: number
    salience: number
    decay_lambda: number
    version: number
}

type HydratedMemory = {
    id: string
    node: string
    content: string
    primary_sector: string
    sectors: string[]
    tags: string[]
    created_at: number
    updated_at: number
    last_seen_at: number
    salience: number
    decay_lambda: number
    version: number
    score?: number
    path?: string[]
    metadata?: Record<string, unknown>
}

export const NODE_SECTOR_MAP: Record<string, SectorType> = {
    observe: 'episodic',
    plan: 'semantic',
    reflect: 'reflective',
    act: 'procedural',
    emotion: 'emotional'
}

const DEFAULT_SECTOR: SectorType = 'semantic'
const SUMMARY_LINE_LIMIT = 160

const truncate = (text: string, max = 320) => text.length <= max
    ? text
    : `${text.slice(0, max).trimEnd()}...`

const safeParse = <T>(value: string | null, fallback: T): T => {
    if (!value) return fallback
    try {
        return JSON.parse(value) as T
    } catch {
        return fallback
    }
}

const resolveSector = (node: string): SectorType =>
    NODE_SECTOR_MAP[node.toLowerCase()] ?? DEFAULT_SECTOR

const resolveNamespace = (namespace?: string) => namespace || env.lg_namespace

const buildTags = (tags: string[] | undefined, node: string, namespace: string, graphId?: string) => {
    const tagSet = new Set<string>(tags || [])
    tagSet.add(`lgm:node:${node.toLowerCase()}`)
    tagSet.add(`lgm:namespace:${namespace}`)
    if (graphId) tagSet.add(`lgm:graph:${graphId}`)
    return Array.from(tagSet)
}

const buildMetadata = (
    payload: lgm_store_req,
    sector: SectorType,
    namespace: string,
    extras?: Record<string, unknown>
) => {
    const baseMeta = { ...(payload.metadata || {}) } as Record<string, unknown>
    const existingLgm = typeof baseMeta.lgm === 'object' && baseMeta.lgm !== null
        ? baseMeta.lgm as Record<string, unknown>
        : {}
    baseMeta.lgm = {
        ...existingLgm,
        node: payload.node.toLowerCase(),
        sector,
        namespace,
        graph_id: payload.graph_id ?? null,
        stored_at: now(),
        mode: 'langgraph',
        ...extras
    }
    return baseMeta
}

const matchesNamespace = (
    metadata: Record<string, unknown>,
    namespace: string,
    graphId?: string
) => {
    const lgm = metadata?.lgm as Record<string, unknown> | undefined
    if (!lgm) return false
    if (lgm.namespace !== namespace) return false
    if (graphId && lgm.graph_id !== graphId) return false
    return true
}

const hydrateMemoryRow = async (
    row: MemoryRow,
    metadata: Record<string, unknown>,
    includeMetadata: boolean,
    score?: number,
    path?: string[]
): Promise<HydratedMemory> => {
    const tags = safeParse<string[]>(row.tags, [])
    const vectors = await q.get_vecs_by_id.all(row.id)
    const sectors = vectors.map(v => v.sector)
    const memory: HydratedMemory = {
        id: row.id,
        node: (metadata?.lgm as Record<string, unknown> | undefined)?.node as string || row.primary_sector,
        content: row.content,
        primary_sector: row.primary_sector,
        sectors,
        tags,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_seen_at: row.last_seen_at,
        salience: row.salience,
        decay_lambda: row.decay_lambda,
        version: row.version
    }
    if (typeof score === 'number') memory.score = score
    if (path) memory.path = path
    if (includeMetadata) memory.metadata = metadata
    return memory
}

const buildReflectionContent = (
    payload: lgm_store_req,
    namespace: string
) => {
    const parts = [
        `LangGraph reflection for node "${payload.node}"`,
        `namespace=${namespace}`
    ]
    if (payload.graph_id) parts.push(`graph=${payload.graph_id}`)
    return `${parts.join(' | ')}\n\n${truncate(payload.content, 480)}`
}

const createAutoReflection = async (
    payload: lgm_store_req,
    stored: {
        id: string
        namespace: string
        graph_id: string | null
    }
) => {
    const reflectionTags = buildTags(
        [`lgm:auto:reflection`, `lgm:source:${stored.id}`],
        'reflect',
        stored.namespace,
        stored.graph_id ?? undefined
    )
    const reflectionMetadata = {
        lgm: {
            node: 'reflect',
            sector: 'reflective',
            namespace: stored.namespace,
            graph_id: stored.graph_id,
            stored_at: now(),
            mode: 'langgraph',
            source_memory: stored.id,
            source_node: payload.node.toLowerCase()
        }
    }
    const result = await addHSGMemory(
        buildReflectionContent(payload, stored.namespace),
        j(reflectionTags),
        reflectionMetadata
    )
    return {
        id: result.id,
        node: 'reflect',
        primary_sector: result.primary_sector,
        sectors: result.sectors,
        namespace: stored.namespace,
        graph_id: stored.graph_id,
        tags: reflectionTags,
        chunks: result.chunks ?? 1,
        metadata: reflectionMetadata
    }
}

export async function storeNodeMemory(payload: lgm_store_req) {
    if (!payload?.node || !payload?.content) {
        throw new Error('node and content are required')
    }
    const namespace = resolveNamespace(payload.namespace)
    const node = payload.node.toLowerCase()
    const sector = resolveSector(node)
    const tagList = buildTags(payload.tags, node, namespace, payload.graph_id)
    const metadata = buildMetadata(payload, sector, namespace)

    const result = await addHSGMemory(payload.content, j(tagList), metadata)

    const stored = {
        id: result.id,
        node,
        primary_sector: result.primary_sector,
        sectors: result.sectors,
        namespace,
        graph_id: payload.graph_id ?? null,
        tags: tagList,
        chunks: result.chunks ?? 1,
        metadata
    }

    const reflectiveSetting = payload.reflective ?? env.lg_reflective
    const reflection = reflectiveSetting && node !== 'reflect'
        ? await createAutoReflection(payload, stored)
        : null

    return {
        memory: stored,
        reflection
    }
}

export async function retrieveNodeMemories(payload: lgm_retrieve_req) {
    if (!payload?.node) {
        throw new Error('node is required')
    }
    const namespace = resolveNamespace(payload.namespace)
    const node = payload.node.toLowerCase()
    const sector = resolveSector(node)
    const limit = payload.limit || env.lg_max_context
    const includeMetadata = payload.include_metadata ?? false
    const graphId = payload.graph_id

    const items: HydratedMemory[] = []

    if (payload.query) {
        const matches = await hsgQuery(payload.query, Math.max(limit * 2, limit), {
            sectors: [sector]
        })
        for (const match of matches) {
            const row = await q.get_mem.get(match.id) as MemoryRow | undefined
            if (!row) continue
            const metadata = safeParse<Record<string, unknown>>(row.meta, {})
            if (!matchesNamespace(metadata, namespace, graphId)) continue
            const hydrated = await hydrateMemoryRow(row, metadata, includeMetadata, match.score, match.path)
            items.push(hydrated)
            if (items.length >= limit) break
        }
    } else {
        const rawRows = await q.all_mem_by_sector.all(sector, limit * 4, 0) as MemoryRow[]
        for (const row of rawRows) {
            const metadata = safeParse<Record<string, unknown>>(row.meta, {})
            if (!matchesNamespace(metadata, namespace, graphId)) continue
            const hydrated = await hydrateMemoryRow(row, metadata, includeMetadata)
            items.push(hydrated)
            if (items.length >= limit) break
        }
        items.sort((a, b) => b.last_seen_at - a.last_seen_at)
    }

    return {
        node,
        sector,
        namespace,
        graph_id: graphId ?? null,
        query: payload.query || null,
        count: items.length,
        items
    }
}

export async function getGraphContext(payload: lgm_context_req) {
    const namespace = resolveNamespace(payload.namespace)
    const graphId = payload.graph_id
    const limit = payload.limit || env.lg_max_context
    const nodes = Object.keys(NODE_SECTOR_MAP)
    const perNodeLimit = Math.max(1, Math.floor(limit / nodes.length) || 1)

    const nodeContexts = []
    for (const node of nodes) {
        const result = await retrieveNodeMemories({
            node,
            namespace,
            graph_id: graphId,
            limit: perNodeLimit,
            include_metadata: true
        })
        nodeContexts.push({
            node,
            sector: result.sector,
            items: result.items
        })
    }

    const flattened = nodeContexts.flatMap(entry =>
        entry.items.map(item => ({
            node: entry.node,
            content: truncate(item.content, SUMMARY_LINE_LIMIT)
        }))
    )

    const summary = flattened.length
        ? flattened.slice(0, limit).map(line => `- [${line.node}] ${line.content}`).join('\n')
        : ''

    return {
        namespace,
        graph_id: graphId ?? null,
        limit,
        nodes: nodeContexts,
        summary
    }
}

const buildContextReflection = async (namespace: string, graphId?: string) => {
    const context = await getGraphContext({
        namespace,
        graph_id: graphId,
        limit: env.lg_max_context
    })
    const lines = context.nodes.flatMap(entry =>
        entry.items.map(item => ({
            node: entry.node,
            content: truncate(item.content, SUMMARY_LINE_LIMIT)
        }))
    )
    if (!lines.length) return null
    const header = `Reflection synthesized from LangGraph context (namespace=${namespace}${graphId ? `, graph=${graphId}` : ''})`
    const body = lines
        .slice(0, env.lg_max_context)
        .map((line, idx) => `${idx + 1}. [${line.node}] ${line.content}`)
        .join('\n')
    return `${header}\n\n${body}`
}

export async function createReflection(payload: lgm_reflection_req) {
    const namespace = resolveNamespace(payload.namespace)
    const node = (payload.node || 'reflect').toLowerCase()
    const baseContent = payload.content || await buildContextReflection(namespace, payload.graph_id)
    if (!baseContent) {
        throw new Error('reflection content could not be derived')
    }

    const tags = [`lgm:manual:reflection`, ...(payload.context_ids?.map(id => `lgm:context:${id}`) || [])]
    const metadata: Record<string, unknown> = {
        lgm_context_ids: payload.context_ids || []
    }

    const result = await storeNodeMemory({
        node,
        content: baseContent,
        namespace,
        graph_id: payload.graph_id,
        tags,
        metadata,
        reflective: false
    })

    return result
}

export const getLangGraphConfig = () => ({
    mode: env.mode,
    namespace_default: env.lg_namespace,
    max_context: env.lg_max_context,
    reflective: env.lg_reflective,
    node_sector_map: NODE_SECTOR_MAP
})

export const registerLangGraphEndpoints = (app: any) => {
    app.get('/lgm/config', (_req: any, res: any) => {
        res.json(getLangGraphConfig())
    })

    app.post('/lgm/store', async (req: any, res: any) => {
        try {
            const result = await storeNodeMemory(req.body as lgm_store_req)
            res.json(result)
        } catch (error) {
            console.error('[LGM] store error:', error)
            res.status(400).json({ err: 'lgm_store_failed', message: (error as Error).message })
        }
    })

    app.post('/lgm/retrieve', async (req: any, res: any) => {
        try {
            const result = await retrieveNodeMemories(req.body as lgm_retrieve_req)
            res.json(result)
        } catch (error) {
            console.error('[LGM] retrieve error:', error)
            res.status(400).json({ err: 'lgm_retrieve_failed', message: (error as Error).message })
        }
    })

    app.post('/lgm/context', async (req: any, res: any) => {
        try {
            const result = await getGraphContext(req.body as lgm_context_req)
            res.json(result)
        } catch (error) {
            console.error('[LGM] context error:', error)
            res.status(400).json({ err: 'lgm_context_failed', message: (error as Error).message })
        }
    })

    app.post('/lgm/reflection', async (req: any, res: any) => {
        try {
            const result = await createReflection(req.body as lgm_reflection_req)
            res.json(result)
        } catch (error) {
            console.error('[LGM] reflection error:', error)
            res.status(400).json({ err: 'lgm_reflection_failed', message: (error as Error).message })
        }
    })
}
