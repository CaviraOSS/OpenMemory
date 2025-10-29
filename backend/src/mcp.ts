import type { IncomingMessage, ServerResponse } from 'http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { env } from './utils/config'
import {
    addHSGMemory,
    hsgQuery,
    reinforceMemory,
    SECTOR_CONFIGS
} from './hsg'
import { q, allAsync } from './utils/database'
import { getEmbeddingInfo } from './embedding'
import { j, p } from './utils'
import type { SectorType, MemoryRow, JsonRpcErrorCode } from './types'

const SECTOR_ENUM = z.enum(['episodic', 'semantic', 'procedural', 'emotional', 'reflective'] as const)

const truncate = (value: string, max = 200) =>
    value.length <= max ? value : `${value.slice(0, max).trimEnd()}...`

const buildMemorySnapshot = (row: MemoryRow) => ({
    id: row.id,
    primary_sector: row.primary_sector,
    salience: Number(row.salience.toFixed(3)),
    last_seen_at: row.last_seen_at,
    content_preview: truncate(row.content, 240)
})

const formatMatches = (matches: Awaited<ReturnType<typeof hsgQuery>>) =>
    matches.map((match, index) => {
        const preview = truncate(match.content.replace(/\s+/g, ' ').trim(), 200)
        return `${index + 1}. [${match.primary_sector}] score=${match.score.toFixed(3)} salience=${match.salience.toFixed(3)} id=${match.id}\n${preview}`
    }).join('\n\n')

const setCommonHeaders = (res: ServerResponse) => {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Mcp-Session-Id')
}

const sendJsonError = (res: ServerResponse, code: JsonRpcErrorCode, message: string, id: number | string | null = null, status = 400) => {
    if (!res.headersSent) {
        res.statusCode = status
        setCommonHeaders(res)
        res.end(JSON.stringify({
            jsonrpc: '2.0',
            error: { code, message },
            id
        }))
    }
}

export const createMcpServer = () => {
    const server = new McpServer(
        {
            name: 'openmemory-mcp',
            version: '2.1.0',
            protocolVersion: '2025-06-18'
        },
        {
            capabilities: {
                tools: {},
                resources: {},
                logging: {}
            }
        }
    )

    server.tool(
        'openmemory.query',
        'Run a semantic retrieval against OpenMemory',
        {
            query: z.string().min(1, 'query text is required').describe('Free-form search text'),
            k: z.number().int().min(1).max(32).default(8).describe('Maximum results to return'),
            sector: SECTOR_ENUM.optional().describe('Restrict search to a specific sector'),
            min_salience: z.number().min(0).max(1).optional().describe('Minimum salience threshold')
        },
        async ({ query, k, sector, min_salience }) => {
            const filters = {
                sectors: sector ? [sector as SectorType] : undefined,
                minSalience: min_salience
            }
            const matches = await hsgQuery(query, k ?? 8, filters)
            const summary = matches.length
                ? formatMatches(matches)
                : 'No memories matched the supplied query.'

            const payload = matches.map(match => ({
                id: match.id,
                score: Number(match.score.toFixed(4)),
                primary_sector: match.primary_sector,
                sectors: match.sectors,
                salience: Number(match.salience.toFixed(4)),
                last_seen_at: match.last_seen_at,
                path: match.path,
                content: match.content
            }))

            return {
                content: [
                    {
                        type: 'text',
                        text: summary
                    },
                    {
                        type: 'text',
                        text: JSON.stringify({ query, matches: payload }, null, 2)
                    }
                ]
            }
        }
    )

    server.tool(
        'openmemory.store',
        'Persist new content into OpenMemory',
        {
            content: z.string().min(1).describe('Raw memory text to store'),
            tags: z.array(z.string()).optional().describe('Optional tag list'),
            metadata: z.record(z.any()).optional().describe('Arbitrary metadata blob')
        },
        async ({ content, tags, metadata }) => {
            const result = await addHSGMemory(content, j(tags || []), metadata)
            const responseText =
                `Stored memory ${result.id} (primary=${result.primary_sector}) across sectors: ${result.sectors.join(', ')}`

            return {
                content: [
                    {
                        type: 'text',
                        text: responseText
                    },
                    {
                        type: 'text',
                        text: JSON.stringify({ id: result.id, primary_sector: result.primary_sector, sectors: result.sectors }, null, 2)
                    }
                ]
            }
        }
    )

    server.tool(
        'openmemory.reinforce',
        'Boost salience for an existing memory',
        {
            id: z.string().min(1).describe('Memory identifier to reinforce'),
            boost: z.number().min(0.01).max(1).default(0.1).describe('Salience boost amount (default 0.1)')
        },
        async ({ id, boost }) => {
            await reinforceMemory(id, boost)
            return {
                content: [
                    {
                        type: 'text',
                        text: `Reinforced memory ${id} by ${boost}`
                    }
                ]
            }
        }
    )

    server.tool(
        'openmemory.list',
        'List recent memories for quick inspection',
        {
            limit: z.number().int().min(1).max(50).default(10).describe('Number of memories to return'),
            sector: SECTOR_ENUM.optional().describe('Optionally limit to a sector')
        },
        async ({ limit, sector }) => {
            const rows: MemoryRow[] = sector
                ? await q.all_mem_by_sector.all(sector, limit ?? 10, 0)
                : await q.all_mem.all(limit ?? 10, 0)

            const items = rows.map(row => ({
                ...buildMemorySnapshot(row),
                tags: p(row.tags || '[]') as string[],
                metadata: p(row.meta || '{}') as Record<string, unknown>
            }))

            const lines = items.map((item, index) => {
                const tagStr = item.tags.length ? ` tags=${item.tags.join(', ')}` : ''
                return `${index + 1}. [${item.primary_sector}] salience=${item.salience} id=${item.id}${tagStr}\n${item.content_preview}`
            })

            return {
                content: [
                    {
                        type: 'text',
                        text: lines.join('\n\n') || 'No memories stored yet.'
                    },
                    {
                        type: 'text',
                        text: JSON.stringify({ items }, null, 2)
                    }
                ]
            }
        }
    )

    server.tool(
        'openmemory.get',
        'Fetch a single memory by identifier',
        {
            id: z.string().min(1).describe('Memory identifier to load'),
            include_vectors: z.boolean().default(false).describe('Include sector vector metadata')
        },
        async ({ id, include_vectors }) => {
            const memory = await q.get_mem.get(id)
            if (!memory) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Memory ${id} not found.`
                        }
                    ]
                }
            }

            const vectors = include_vectors ? await q.get_vecs_by_id.all(id) : []
            const payload = {
                id: memory.id,
                content: memory.content,
                primary_sector: memory.primary_sector,
                salience: memory.salience,
                decay_lambda: memory.decay_lambda,
                created_at: memory.created_at,
                updated_at: memory.updated_at,
                last_seen_at: memory.last_seen_at,
                tags: p(memory.tags || '[]'),
                metadata: p(memory.meta || '{}'),
                sectors: include_vectors ? vectors.map(v => v.sector) : undefined
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(payload, null, 2)
                    }
                ]
            }
        }
    )

    server.resource(
        'openmemory-config',
        'openmemory://config',
        {
            mimeType: 'application/json',
            description: 'Runtime configuration snapshot for the OpenMemory MCP server'
        },
        async () => {
            const stats = await allAsync(`
                select primary_sector as sector, count(*) as count, avg(salience) as avg_salience
                from memories
                group by primary_sector
            `)
            const payload = {
                mode: env.mode,
                sectors: SECTOR_CONFIGS,
                stats,
                embeddings: getEmbeddingInfo(),
                server: {
                    version: '2.1.0',
                    protocol: '2025-06-18'
                },
                available_tools: ['openmemory.query', 'openmemory.store', 'openmemory.reinforce', 'openmemory.list', 'openmemory.get']
            }
            return {
                contents: [
                    {
                        uri: 'openmemory://config',
                        text: JSON.stringify(payload, null, 2)
                    }
                ]
            }
        }
    )

    server.server.oninitialized = () => {
        console.log('[MCP] initialization completed with client:', server.server.getClientVersion())
    }

    return server
}

const extractPayload = async (req: IncomingMessage & { body?: any }) => {
    if (req.body !== undefined) {
        if (typeof req.body === 'string') {
            if (!req.body.trim()) return undefined
            return JSON.parse(req.body)
        }
        if (typeof req.body === 'object' && req.body !== null) {
            return req.body
        }
        return undefined
    }

    const raw = await new Promise<string>((resolve, reject) => {
        let buffer = ''
        req.on('data', chunk => { buffer += chunk })
        req.on('end', () => resolve(buffer))
        req.on('error', reject)
    })

    if (!raw.trim()) return undefined
    return JSON.parse(raw)
}

export const mcp = (app: any) => {
    const server = createMcpServer()
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
    })
    const serverReady = server.connect(transport).then(() => {
        console.log('[MCP] Server started and transport connected')
    }).catch(error => {
        console.error('[MCP] Failed to initialize transport:', error)
        throw error
    })

    const handleRequest = async (req: any, res: any) => {
        try {
            await serverReady
            const payload = await extractPayload(req)

            if (!payload || typeof payload !== 'object') {
                sendJsonError(res, -32600, 'Request body must be a JSON object')
                return
            }

            console.log('[MCP] Incoming request:', JSON.stringify(payload))
            setCommonHeaders(res)
            await transport.handleRequest(req, res, payload)
        } catch (error) {
            console.error('[MCP] Error handling request:', error)
            if (error instanceof SyntaxError) {
                sendJsonError(res, -32600, 'Invalid JSON payload')
                return
            }
            if (!res.headersSent) {
                sendJsonError(res, -32603, 'Internal server error', (error as any)?.id ?? null, 500)
            }
        }
    }

    app.post('/mcp', (req: any, res: any) => {
        void handleRequest(req, res)
    })

    app.options('/mcp', (_req: any, res: any) => {
        res.statusCode = 204
        setCommonHeaders(res)
        res.end()
    })

    const methodNotAllowed = (_req: IncomingMessage, res: ServerResponse) => {
        sendJsonError(res, -32600, 'Method not supported. Use POST  /mcp with JSON payload.', null, 405)
    }

    app.get('/mcp', methodNotAllowed)
    app.delete('/mcp', methodNotAllowed)
    app.put('/mcp', methodNotAllowed)
}

export const startMcpStdioServer = async () => {
    const server = createMcpServer()
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.log('[MCP] STDIO transport connected')
}

if (typeof require !== 'undefined' && require.main === module) {
    void startMcpStdioServer().catch(error => {
        console.error('[MCP] STDIO startup failed:', error)
        process.exitCode = 1
    })
}
