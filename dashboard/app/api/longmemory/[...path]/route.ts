/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : dashboard/app/api/longmemory/[...path]/route.ts
 *  usage : supports the LongMemory dashboard route
 */


import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const backend = (process.env.LONGMEMORY_API_URL || 'http://127.0.0.1:7331').replace(/\/+$/, '')
const apiKey = process.env.LONGMEMORY_API_KEY || process.env.OM_API_KEY || ''

type json = Record<string, any>

const headers = (content = true) => ({
    ...(content ? { 'content-type': 'application/json' } : {}),
    ...(apiKey ? { 'x-api-key': apiKey } : {}),
})

async function call(path: string, init: RequestInit = {}): Promise<any> {
    const response = await fetch(`${backend}${path}`, {
        ...init,
        headers: { ...headers(init.body !== undefined), ...(init.headers ?? {}) },
        cache: 'no-store',
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
        const message = payload?.error?.message || payload?.message || `${response.status} ${response.statusText}`
        throw Object.assign(new Error(message), { status: response.status, payload })
    }
    return payload?.data ?? payload
}

const primaryFacet = (node: json) => Object.entries(node.facets ?? {}).find(([, value]) => value !== null)?.[0] ?? 'semantic'

const legacyMemory = (node: json, score?: number) => ({
    id: node.id,
    content: node.content?.raw ?? '',
    summary: node.content?.summary ?? '',
    primary_sector: primaryFacet(node),
    tags: Array.isArray(node.content?.tags) ? node.content.tags : [],
    metadata: node.metadata ?? {},
    created_at: node.temporal?.observed_at ?? node.temporal?.recorded_at ?? Date.now(),
    updated_at: node.temporal?.recorded_at ?? Date.now(),
    last_seen_at: node.temporal?.recorded_at ?? Date.now(),
    salience: node.state?.salience ?? score ?? 0,
    confidence: node.state?.confidence ?? 0,
    status: node.state?.status ?? 'active',
    grounding_score: node.grounding?.grounding_score ?? 0,
    world_id: node.world?.world_id ?? null,
    project_id: node.metadata?.project_id ?? null,
    score: score ?? null,
})

async function historical(projectId?: string | null) {
    const recalled = await call('/v1/timeline')
    const entries = recalled.timeline?.entries ?? []
    return projectId ? entries.filter((entry: json) => entry.node?.metadata?.project_id === projectId) : entries
}

const sectorTimeline = (entries: json[]) => {
    const groups = new Map<string, { hour: string; sort_key: string; primary_sector: string; count: number }>()
    for (const entry of entries) {
        const date = new Date(entry.node?.temporal?.recorded_at ?? Date.now())
        const sortKey = date.toISOString().slice(0, 13)
        const sector = primaryFacet(entry.node)
        const key = `${sortKey}:${sector}`
        const existing = groups.get(key)
        if (existing) existing.count++
        else groups.set(key, { hour: `${date.toISOString().slice(5, 10)} ${date.toISOString().slice(11, 13)}:00`, sort_key: sortKey, primary_sector: sector, count: 1 })
    }
    return [...groups.values()].sort((left, right) => left.sort_key.localeCompare(right.sort_key))
}

async function compatibility(req: NextRequest, path: string): Promise<Response | null> {
    const projectId = req.nextUrl.searchParams.get('project_id')

    if (req.method === 'GET' && path === 'dashboard/projects') {
        const worlds = await call('/v1/worlds?limit=10000')
        const projects = worlds.filter((world: json) => world.metadata?.hierarchy === 'project').map((world: json) => ({ id: world.metadata.project_id, name: world.name, description: world.metadata.description ?? '', root_world_id: world.id }))
        return NextResponse.json({ projects })
    }

    if (req.method === 'GET' && path === 'dashboard/health') {
        const health = await call('/health')
        return NextResponse.json({ ...health, memory: {}, uptime: { seconds: 0, hours: 0, days: 0 } })
    }

    if (req.method === 'GET' && path === 'dashboard/stats') {
        const [stats, entries] = await Promise.all([call('/v1/stats'), historical(projectId)])
        const memories = entries.map((entry: json) => legacyMemory(entry.node))
        const average = memories.length ? memories.reduce((sum: number, item: json) => sum + item.salience, 0) / memories.length : 0
        return NextResponse.json({ totalMemories: projectId ? memories.length : stats.nodes, recentMemories: memories.filter((item: json) => item.created_at > Date.now() - 86400000).length, avgSalience: average, requests: { total: 0, errors: 0, errorRate: '0.0' }, qps: { peak: 0, average: 0, cacheHitRate: 0 }, config: { cacheSegments: 0, maxActive: stats.working_memory ?? 0 }, hydrograph: stats })
    }

    if (req.method === 'GET' && path === 'dashboard/activity') {
        const limit = Number(req.nextUrl.searchParams.get('limit') ?? 20)
        const entries = (await historical(projectId)).slice(-limit).reverse()
        return NextResponse.json({ activities: entries.map((entry: json) => ({ id: entry.node.id, timestamp: entry.node.temporal.recorded_at, type: entry.node.metadata?.project_event_kind ?? 'memory', content: entry.node.content?.raw ?? entry.node.content?.summary ?? '', sector: primaryFacet(entry.node), salience: entry.node.state.salience, memory_id: entry.node.id })) })
    }

    if (req.method === 'GET' && path === 'dashboard/sectors/timeline') {
        return NextResponse.json({ timeline: sectorTimeline(await historical(projectId)) })
    }

    if (req.method === 'GET' && path === 'dashboard/top-memories') {
        const limit = Number(req.nextUrl.searchParams.get('limit') ?? 10)
        const items = (await historical(projectId)).map((entry: json) => legacyMemory(entry.node)).sort((left: json, right: json) => right.salience - left.salience).slice(0, limit)
        return NextResponse.json({ items })
    }

    if (req.method === 'GET' && path === 'dashboard/maintenance') {
        return NextResponse.json({ operations: [], totals: { cycles: 0, reflections: 0, consolidations: 0, efficiency: 0 } })
    }

    if (req.method === 'GET' && path === 'memory/all') {
        const limit = Number(req.nextUrl.searchParams.get('l') ?? 100)
        const offset = Number(req.nextUrl.searchParams.get('u') ?? 0)
        const sector = req.nextUrl.searchParams.get('sector')
        let items = (await historical(projectId)).map((entry: json) => legacyMemory(entry.node))
        if (sector && sector !== 'all') items = items.filter((item: json) => item.primary_sector === sector)
        return NextResponse.json({ items: items.slice(offset, offset + limit), total: items.length })
    }

    if (req.method === 'POST' && path === 'memory/query') {
        const input = await req.json()
        const mode = input.mode ?? 'strict'
        const recalled = await call('/v1/recall', { method: 'POST', body: JSON.stringify({ text: input.query ?? input.text ?? '', mode, k: input.k ?? 20, token_budget: input.token_budget ?? 4096 }) })
        const values = recalled.items ?? recalled.timeline?.entries ?? []
        const requestedProject = input.filters?.project_id ?? projectId
        const requestedSector = input.filters?.sector
        const matches = values.map((value: json) => legacyMemory(value.node, value.score ?? value.grounding_score))
            .filter((item: json) => (!requestedProject || item.project_id === requestedProject) && (!requestedSector || item.primary_sector === requestedSector))
        return NextResponse.json({ matches, context: recalled.context ?? recalled.timeline ?? null, trace: recalled.trace ?? null })
    }

    if (req.method === 'POST' && path === 'memory/add') {
        const input = await req.json()
        const text = input.content ?? input.text
        if (!text) return NextResponse.json({ error: 'validation_error', message: 'content is required' }, { status: 400 })
        const ingested = await call('/v1/ingest', { method: 'POST', body: JSON.stringify({ user_id: input.user_id ?? 'dashboard', text, tags: input.tags ?? [], facet_hint: input.metadata?.primary_sector, metadata: { ...(input.metadata ?? {}), project_id: input.project_id === 'system_global' ? undefined : input.project_id ?? projectId, source_type: 'dashboard' } }) })
        return NextResponse.json({ id: ingested.node.id, memory: legacyMemory(ingested.node) }, { status: 201 })
    }

    if (req.method === 'POST' && path === 'memory/reinforce') {
        return NextResponse.json({ ok: false, immutable: true, message: 'Hydrograph reinforcement is evidence-driven and cannot be manually mutated.' }, { status: 409 })
    }

    const memoryMatch = path.match(/^memory\/([^/]+)$/)
    if (memoryMatch && req.method === 'GET') {
        const explanation = await call(`/v1/explain/${encodeURIComponent(memoryMatch[1])}`)
        return NextResponse.json({ ...legacyMemory(explanation.node), explanation })
    }
    if (memoryMatch && ['PATCH', 'DELETE'].includes(req.method)) {
        return NextResponse.json({ error: 'immutable_memory', message: 'Hydrograph memories are immutable. Ingest a superseding observation instead.' }, { status: 405 })
    }

    if (req.method === 'GET' && path === 'api/temporal/timeline') {
        const params = new URLSearchParams(req.nextUrl.searchParams)
        const timeline = await call(`/v1/timeline?${params}`)
        return NextResponse.json(timeline)
    }

    if (req.method === 'GET' && path === 'health') return NextResponse.json(await call('/health'))
    return null
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
    const { path: parts = [] } = await ctx.params
    const path = parts.join('/')
    try {
        const adapted = await compatibility(req, path)
        if (adapted) return adapted
        const target = new URL(`${backend}/${parts.map(encodeURIComponent).join('/')}`)
        req.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value))
        const init: RequestInit = { method: req.method, headers: headers(!['GET', 'HEAD'].includes(req.method)), cache: 'no-store' }
        if (!['GET', 'HEAD'].includes(req.method)) init.body = await req.arrayBuffer()
        const response = await fetch(target, init)
        return new Response(response.body, { status: response.status, headers: { 'content-type': response.headers.get('content-type') ?? 'application/json', 'cache-control': 'no-store' } })
    } catch (error: any) {
        return NextResponse.json({ error: 'backend_error', message: error.message, details: error.payload ?? null }, { status: error.status ?? 502 })
    }
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
export const OPTIONS = proxy
