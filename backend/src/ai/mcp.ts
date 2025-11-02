import type { IncomingMessage, ServerResponse } from 'http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { env } from '../core/cfg'
import { add_hsg_memory, hsg_query, reinforce_memory, sector_configs } from '../memory/hsg'
import { q, all_async } from '../core/db'
import { getEmbeddingInfo } from '../memory/embed'
import { j, p } from '../utils'
import type { sector_type, mem_row, rpc_err_code } from '../core/types'

const sec_enum = z.enum(['episodic', 'semantic', 'procedural', 'emotional', 'reflective'] as const)

const trunc = (val: string, max = 200) => val.length <= max ? val : `${val.slice(0, max).trimEnd()}...`

const build_mem_snap = (row: mem_row) => ({ id: row.id, primary_sector: row.primary_sector, salience: Number(row.salience.toFixed(3)), last_seen_at: row.last_seen_at, content_preview: trunc(row.content, 240) })

const fmt_matches = (matches: Awaited<ReturnType<typeof hsg_query>>) => matches.map((m: any, idx: any) => {
    const prev = trunc(m.content.replace(/\s+/g, ' ').trim(), 200)
    return `${idx + 1}. [${m.primary_sector}] score=${m.score.toFixed(3)} salience=${m.salience.toFixed(3)} id=${m.id}\n${prev}`
}).join('\n\n')

const set_hdrs = (res: ServerResponse) => {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Mcp-Session-Id')
}

const send_err = (res: ServerResponse, code: rpc_err_code, msg: string, id: number | string | null = null, status = 400) => {
    if (!res.headersSent) {
        res.statusCode = status
        set_hdrs(res)
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code, message: msg }, id }))
    }
}

export const create_mcp_srv = () => {
    const srv = new McpServer({ name: 'openmemory-mcp', version: '2.1.0', protocolVersion: '2025-06-18' }, { capabilities: { tools: {}, resources: {}, logging: {} } })

    srv.tool('openmemory.query', 'Run a semantic retrieval against OpenMemory', {
        query: z.string().min(1, 'query text is required').describe('Free-form search text'),
        k: z.number().int().min(1).max(32).default(8).describe('Maximum results to return'),
        sector: sec_enum.optional().describe('Restrict search to a specific sector'),
        min_salience: z.number().min(0).max(1).optional().describe('Minimum salience threshold')
    }, async ({ query, k, sector, min_salience }) => {
        const flt = { sectors: sector ? [sector as sector_type] : undefined, minSalience: min_salience }
        const matches = await hsg_query(query, k ?? 8, flt)
        const summ = matches.length ? fmt_matches(matches) : 'No memories matched the supplied query.'
        const pay = matches.map((m: any) => ({ id: m.id, score: Number(m.score.toFixed(4)), primary_sector: m.primary_sector, sectors: m.sectors, salience: Number(m.salience.toFixed(4)), last_seen_at: m.last_seen_at, path: m.path, content: m.content }))
        return { content: [{ type: 'text', text: summ }, { type: 'text', text: JSON.stringify({ query, matches: pay }, null, 2) }] }
    })

    srv.tool('openmemory.store', 'Persist new content into OpenMemory', {
        content: z.string().min(1).describe('Raw memory text to store'),
        tags: z.array(z.string()).optional().describe('Optional tag list'),
        metadata: z.record(z.any()).optional().describe('Arbitrary metadata blob')
    }, async ({ content, tags, metadata }) => {
        const res = await add_hsg_memory(content, j(tags || []), metadata)
        const txt = `Stored memory ${res.id} (primary=${res.primary_sector}) across sectors: ${res.sectors.join(', ')}`
        return { content: [{ type: 'text', text: txt }, { type: 'text', text: JSON.stringify({ id: res.id, primary_sector: res.primary_sector, sectors: res.sectors }, null, 2) }] }
    })

    srv.tool('openmemory.reinforce', 'Boost salience for an existing memory', {
        id: z.string().min(1).describe('Memory identifier to reinforce'),
        boost: z.number().min(0.01).max(1).default(0.1).describe('Salience boost amount (default 0.1)')
    }, async ({ id, boost }) => {
        await reinforce_memory(id, boost)
        return { content: [{ type: 'text', text: `Reinforced memory ${id} by ${boost}` }] }
    })

    srv.tool('openmemory.list', 'List recent memories for quick inspection', {
        limit: z.number().int().min(1).max(50).default(10).describe('Number of memories to return'),
        sector: sec_enum.optional().describe('Optionally limit to a sector')
    }, async ({ limit, sector }) => {
        const rows: mem_row[] = sector ? await q.all_mem_by_sector.all(sector, limit ?? 10, 0) : await q.all_mem.all(limit ?? 10, 0)
        const items = rows.map(row => ({ ...build_mem_snap(row), tags: p(row.tags || '[]') as string[], metadata: p(row.meta || '{}') as Record<string, unknown> }))
        const lns = items.map((item, idx) => {
            const tag_str = item.tags.length ? ` tags=${item.tags.join(', ')}` : ''
            return `${idx + 1}. [${item.primary_sector}] salience=${item.salience} id=${item.id}${tag_str}\n${item.content_preview}`
        })
        return { content: [{ type: 'text', text: lns.join('\n\n') || 'No memories stored yet.' }, { type: 'text', text: JSON.stringify({ items }, null, 2) }] }
    })

    srv.tool('openmemory.get', 'Fetch a single memory by identifier', {
        id: z.string().min(1).describe('Memory identifier to load'),
        include_vectors: z.boolean().default(false).describe('Include sector vector metadata')
    }, async ({ id, include_vectors }) => {
        const mem = await q.get_mem.get(id)
        if (!mem) return { content: [{ type: 'text', text: `Memory ${id} not found.` }] }
        const vecs = include_vectors ? await q.get_vecs_by_id.all(id) : []
        const pay = { id: mem.id, content: mem.content, primary_sector: mem.primary_sector, salience: mem.salience, decay_lambda: mem.decay_lambda, created_at: mem.created_at, updated_at: mem.updated_at, last_seen_at: mem.last_seen_at, tags: p(mem.tags || '[]'), metadata: p(mem.meta || '{}'), sectors: include_vectors ? vecs.map(v => v.sector) : undefined }
        return { content: [{ type: 'text', text: JSON.stringify(pay, null, 2) }] }
    })

    srv.resource('openmemory-config', 'openmemory://config', { mimeType: 'application/json', description: 'Runtime configuration snapshot for the OpenMemory MCP server' }, async () => {
        const stats = await all_async(`select primary_sector as sector, count(*) as count, avg(salience) as avg_salience from memories group by primary_sector`)
        const pay = { mode: env.mode, sectors: sector_configs, stats, embeddings: getEmbeddingInfo(), server: { version: '2.1.0', protocol: '2025-06-18' }, available_tools: ['openmemory.query', 'openmemory.store', 'openmemory.reinforce', 'openmemory.list', 'openmemory.get'] }
        return { contents: [{ uri: 'openmemory://config', text: JSON.stringify(pay, null, 2) }] }
    })

    srv.server.oninitialized = () => { console.log('[MCP] initialization completed with client:', srv.server.getClientVersion()) }
    return srv
}

const extract_pay = async (req: IncomingMessage & { body?: any }) => {
    if (req.body !== undefined) {
        if (typeof req.body === 'string') {
            if (!req.body.trim()) return undefined
            return JSON.parse(req.body)
        }
        if (typeof req.body === 'object' && req.body !== null) return req.body
        return undefined
    }
    const raw = await new Promise<string>((resolve, reject) => {
        let buf = ''
        req.on('data', chunk => { buf += chunk })
        req.on('end', () => resolve(buf))
        req.on('error', reject)
    })
    if (!raw.trim()) return undefined
    return JSON.parse(raw)
}

export const mcp = (app: any) => {
    const srv = create_mcp_srv()
    const trans = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    const srv_ready = srv.connect(trans).then(() => { console.log('[MCP] Server started and transport connected') }).catch(error => { console.error('[MCP] Failed to initialize transport:', error); throw error })

    const handle_req = async (req: any, res: any) => {
        try {
            await srv_ready
            const pay = await extract_pay(req)
            if (!pay || typeof pay !== 'object') { send_err(res, -32600, 'Request body must be a JSON object'); return }
            console.log('[MCP] Incoming request:', JSON.stringify(pay))
            set_hdrs(res)
            await trans.handleRequest(req, res, pay)
        } catch (error) {
            console.error('[MCP] Error handling request:', error)
            if (error instanceof SyntaxError) { send_err(res, -32600, 'Invalid JSON payload'); return }
            if (!res.headersSent) send_err(res, -32603, 'Internal server error', (error as any)?.id ?? null, 500)
        }
    }

    app.post('/mcp', (req: any, res: any) => { void handle_req(req, res) })
    app.options('/mcp', (_req: any, res: any) => { res.statusCode = 204; set_hdrs(res); res.end() })

    const method_not_allowed = (_req: IncomingMessage, res: ServerResponse) => { send_err(res, -32600, 'Method not supported. Use POST  /mcp with JSON payload.', null, 405) }
    app.get('/mcp', method_not_allowed)
    app.delete('/mcp', method_not_allowed)
    app.put('/mcp', method_not_allowed)
}

export const start_mcp_stdio = async () => {
    const srv = create_mcp_srv()
    const trans = new StdioServerTransport()
    await srv.connect(trans)
    console.log('[MCP] STDIO transport connected')
}

if (typeof require !== 'undefined' && require.main === module) {
    void start_mcp_stdio().catch(error => { console.error('[MCP] STDIO startup failed:', error); process.exitCode = 1 })
}