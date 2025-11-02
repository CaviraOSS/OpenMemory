import { env } from '../core/cfg'
import { add_hsg_memory, hsg_query } from '../memory/hsg'
import { q } from '../core/db'
import { now, j } from '../utils'
import type { lgm_store_req, lgm_retrieve_req, lgm_context_req, lgm_reflection_req, sector_type, mem_row } from '../core/types'

type hydrated_mem = {
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

export const node_sector_map: Record<string, sector_type> = {
    observe: 'episodic',
    plan: 'semantic',
    reflect: 'reflective',
    act: 'procedural',
    emotion: 'emotional'
}

const default_sector: sector_type = 'semantic'
const summary_line_limit = 160

const trunc = (txt: string, max = 320) => txt.length <= max ? txt : `${txt.slice(0, max).trimEnd()}...`

const safe_parse = <T>(val: string | null, fb: T): T => {
    if (!val) return fb
    try { return JSON.parse(val) as T } catch { return fb }
}

const resolve_sector = (node: string): sector_type => node_sector_map[node.toLowerCase()] ?? default_sector

const resolve_ns = (ns?: string) => ns || env.lg_namespace

const build_tags = (tags: string[] | undefined, node: string, ns: string, gid?: string) => {
    const ts = new Set<string>(tags || [])
    ts.add(`lgm:node:${node.toLowerCase()}`)
    ts.add(`lgm:namespace:${ns}`)
    if (gid) ts.add(`lgm:graph:${gid}`)
    return Array.from(ts)
}

const build_meta = (p: lgm_store_req, sec: sector_type, ns: string, ext?: Record<string, unknown>) => {
    const base = { ...(p.metadata || {}) } as Record<string, unknown>
    const ex_lgm = typeof base.lgm === 'object' && base.lgm !== null ? base.lgm as Record<string, unknown> : {}
    base.lgm = { ...ex_lgm, node: p.node.toLowerCase(), sector: sec, namespace: ns, graph_id: p.graph_id ?? null, stored_at: now(), mode: 'langgraph', ...ext }
    return base
}

const matches_ns = (meta: Record<string, unknown>, ns: string, gid?: string) => {
    const lgm = meta?.lgm as Record<string, unknown> | undefined
    if (!lgm) return false
    if (lgm.namespace !== ns) return false
    if (gid && lgm.graph_id !== gid) return false
    return true
}

const hydrate_mem_row = async (row: mem_row, meta: Record<string, unknown>, inc_meta: boolean, score?: number, path?: string[]): Promise<hydrated_mem> => {
    const tags = safe_parse<string[]>(row.tags, [])
    const vecs = await q.get_vecs_by_id.all(row.id)
    const secs = vecs.map(v => v.sector)
    const mem: hydrated_mem = {
        id: row.id,
        node: (meta?.lgm as Record<string, unknown> | undefined)?.node as string || row.primary_sector,
        content: row.content,
        primary_sector: row.primary_sector,
        sectors: secs,
        tags,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_seen_at: row.last_seen_at,
        salience: row.salience,
        decay_lambda: row.decay_lambda,
        version: row.version
    }
    if (typeof score === 'number') mem.score = score
    if (path) mem.path = path
    if (inc_meta) mem.metadata = meta
    return mem
}

const build_refl_content = (p: lgm_store_req, ns: string) => {
    const parts = [`LangGraph reflection for node "${p.node}"`, `namespace=${ns}`]
    if (p.graph_id) parts.push(`graph=${p.graph_id}`)
    return `${parts.join(' | ')}\n\n${trunc(p.content, 480)}`
}

const create_auto_refl = async (p: lgm_store_req, stored: { id: string, namespace: string, graph_id: string | null }) => {
    const refl_tags = build_tags([`lgm:auto:reflection`, `lgm:source:${stored.id}`], 'reflect', stored.namespace, stored.graph_id ?? undefined)
    const refl_meta = { lgm: { node: 'reflect', sector: 'reflective', namespace: stored.namespace, graph_id: stored.graph_id, stored_at: now(), mode: 'langgraph', source_memory: stored.id, source_node: p.node.toLowerCase() } }
    const res = await add_hsg_memory(build_refl_content(p, stored.namespace), j(refl_tags), refl_meta)
    return { id: res.id, node: 'reflect', primary_sector: res.primary_sector, sectors: res.sectors, namespace: stored.namespace, graph_id: stored.graph_id, tags: refl_tags, chunks: res.chunks ?? 1, metadata: refl_meta }
}

export async function store_node_mem(p: lgm_store_req) {
    if (!p?.node || !p?.content) throw new Error('node and content are required')
    const ns = resolve_ns(p.namespace)
    const node = p.node.toLowerCase()
    const sec = resolve_sector(node)
    const tag_list = build_tags(p.tags, node, ns, p.graph_id)
    const meta = build_meta(p, sec, ns)
    const res = await add_hsg_memory(p.content, j(tag_list), meta)
    const stored = { id: res.id, node, primary_sector: res.primary_sector, sectors: res.sectors, namespace: ns, graph_id: p.graph_id ?? null, tags: tag_list, chunks: res.chunks ?? 1, metadata: meta }
    const refl_set = p.reflective ?? env.lg_reflective
    const refl = refl_set && node !== 'reflect' ? await create_auto_refl(p, stored) : null
    return { memory: stored, reflection: refl }
}

export async function retrieve_node_mems(p: lgm_retrieve_req) {
    if (!p?.node) throw new Error('node is required')
    const ns = resolve_ns(p.namespace)
    const node = p.node.toLowerCase()
    const sec = resolve_sector(node)
    const lim = p.limit || env.lg_max_context
    const inc_meta = p.include_metadata ?? false
    const gid = p.graph_id
    const items: hydrated_mem[] = []
    if (p.query) {
        const matches = await hsg_query(p.query, Math.max(lim * 2, lim), { sectors: [sec] })
        for (const match of matches) {
            const row = await q.get_mem.get(match.id) as mem_row | undefined
            if (!row) continue
            const meta = safe_parse<Record<string, unknown>>(row.meta, {})
            if (!matches_ns(meta, ns, gid)) continue
            const hyd = await hydrate_mem_row(row, meta, inc_meta, match.score, match.path)
            items.push(hyd)
            if (items.length >= lim) break
        }
    } else {
        const raw_rows = await q.all_mem_by_sector.all(sec, lim * 4, 0) as mem_row[]
        for (const row of raw_rows) {
            const meta = safe_parse<Record<string, unknown>>(row.meta, {})
            if (!matches_ns(meta, ns, gid)) continue
            const hyd = await hydrate_mem_row(row, meta, inc_meta)
            items.push(hyd)
            if (items.length >= lim) break
        }
        items.sort((a, b) => b.last_seen_at - a.last_seen_at)
    }
    return { node, sector: sec, namespace: ns, graph_id: gid ?? null, query: p.query || null, count: items.length, items }
}

export async function get_graph_ctx(p: lgm_context_req) {
    const ns = resolve_ns(p.namespace)
    const gid = p.graph_id
    const lim = p.limit || env.lg_max_context
    const nodes = Object.keys(node_sector_map)
    const per_node_lim = Math.max(1, Math.floor(lim / nodes.length) || 1)
    const node_ctxs = []
    for (const node of nodes) {
        const res = await retrieve_node_mems({ node, namespace: ns, graph_id: gid, limit: per_node_lim, include_metadata: true })
        node_ctxs.push({ node, sector: res.sector, items: res.items })
    }
    const flat = node_ctxs.flatMap(e => e.items.map(i => ({ node: e.node, content: trunc(i.content, summary_line_limit) })))
    const summ = flat.length ? flat.slice(0, lim).map(ln => `- [${ln.node}] ${ln.content}`).join('\n') : ''
    return { namespace: ns, graph_id: gid ?? null, limit: lim, nodes: node_ctxs, summary: summ }
}

const build_ctx_refl = async (ns: string, gid?: string) => {
    const ctx = await get_graph_ctx({ namespace: ns, graph_id: gid, limit: env.lg_max_context })
    const lns = ctx.nodes.flatMap(e => e.items.map(i => ({ node: e.node, content: trunc(i.content, summary_line_limit) })))
    if (!lns.length) return null
    const hdr = `Reflection synthesized from LangGraph context (namespace=${ns}${gid ? `, graph=${gid}` : ''})`
    const body = lns.slice(0, env.lg_max_context).map((ln, idx) => `${idx + 1}. [${ln.node}] ${ln.content}`).join('\n')
    return `${hdr}\n\n${body}`
}

export async function create_refl(p: lgm_reflection_req) {
    const ns = resolve_ns(p.namespace)
    const node = (p.node || 'reflect').toLowerCase()
    const base_content = p.content || await build_ctx_refl(ns, p.graph_id)
    if (!base_content) throw new Error('reflection content could not be derived')
    const tags = [`lgm:manual:reflection`, ...(p.context_ids?.map(id => `lgm:context:${id}`) || [])]
    const meta: Record<string, unknown> = { lgm_context_ids: p.context_ids || [] }
    const res = await store_node_mem({ node, content: base_content, namespace: ns, graph_id: p.graph_id, tags, metadata: meta, reflective: false })
    return res
}

export const get_lg_cfg = () => ({ mode: env.mode, namespace_default: env.lg_namespace, max_context: env.lg_max_context, reflective: env.lg_reflective, node_sector_map })
