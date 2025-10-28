export interface Memory {
    id: string
    content: string
    primary_sector: SectorType
    sectors: SectorType[]
    tags?: string
    metadata?: Record<string, unknown>
    created_at: number
    updated_at: number
    last_seen_at: number
    salience: number
    decay_lambda: number
    version: number
}
export interface QueryMatch extends Memory {
    score: number
    path: string[]
}
export interface AddMemoryRequest {
    content: string
    tags?: string[]
    metadata?: Record<string, unknown>
}
export interface AddMemoryResponse {
    id: string
    primary_sector: SectorType
    sectors: SectorType[]
}
export interface QueryRequest {
    query: string
    k?: number
    filters?: {
        tags?: string[]
        min_score?: number
        sector?: SectorType
        sectors?: SectorType[]
        min_salience?: number
    }
}
export type SectorType = 'episodic' | 'semantic' | 'procedural' | 'emotional' | 'reflective'
export interface SectorInfo {
    name: SectorType
    description: string
    model: string
    decay_lambda: number
    table_suffix: string
}
export interface SectorStats {
    sector: SectorType
    count: number
    avg_salience: number
}
export interface ApiResponse<T = unknown> {
    [key: string]: T
}
export interface QueryResponse {
    query: string
    matches: QueryMatch[]
}
export interface AddResponse {
    id: string
    primary_sector: SectorType
    sectors: SectorType[]
}
export interface SectorsResponse {
    sectors: Record<SectorType, SectorInfo>
    stats: SectorStats[]
}
export const SECTORS: Record<SectorType, SectorInfo> = {
    episodic: {
        name: 'episodic',
        description: 'Event memories - temporal data',
        model: 'E5-large',
        decay_lambda: 0.015,
        table_suffix: '_episodic'
    },
    semantic: {
        name: 'semantic',
        description: 'Facts & preferences - factual data',
        model: 'OpenAI Ada',
        decay_lambda: 0.005,
        table_suffix: '_semantic'
    },
    procedural: {
        name: 'procedural',
        description: 'Habits, triggers - action patterns',
        model: 'BGE-small',
        decay_lambda: 0.008,
        table_suffix: '_procedural'
    },
    emotional: {
        name: 'emotional',
        description: 'Sentiment states - tone analysis',
        model: 'Sentiment-BERT',
        decay_lambda: 0.02,
        table_suffix: '_emotional'
    },
    reflective: {
        name: 'reflective',
        description: 'Meta memory & logs - audit trail',
        model: 'Local summarizer',
        decay_lambda: 0.001,
        table_suffix: '_reflective'
    }
}
export class OpenMemory {
    private baseUrl: string
    private apiKey: string
    private timeout: number
    constructor(options: {
        apiKey?: string
        baseUrl?: string
        timeout?: number
    } = {}) {
        this.baseUrl = options.baseUrl?.replace(/\/$/, '') || 'http://localhost:8080'
        this.apiKey = options.apiKey || ''
        this.timeout = options.timeout || 60000
    }
    private async request<T>(
        method: string,
        path: string,
        body?: unknown
    ): Promise<T> {
        const url = `${this.baseUrl}${path}`
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        }
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`
        }
        const config: RequestInit = {
            method,
            headers,
            signal: AbortSignal.timeout(this.timeout)
        }
        if (body) {
            config.body = JSON.stringify(body)
        }
        const response = await fetch(url, config)
        if (!response.ok) {
            throw new Error(`OpenMemory API error: ${response.status} ${response.statusText}`)
        }
        return response.json()
    }
    async health(): Promise<{ ok: boolean }> {
        return this.request('GET', '/health')
    }
    async getSectors(): Promise<SectorsResponse> {
        return this.request('GET', '/sectors')
    }
    async add(content: string, options: Omit<AddMemoryRequest, 'content'> = {}): Promise<AddResponse> {
        const request: AddMemoryRequest = {
            content,
            ...options
        }
        return this.request('POST', '/memory/add', request)
    }
    async query(query: string, options: Omit<QueryRequest, 'query'> = {}): Promise<QueryResponse> {
        const request: QueryRequest = {
            query,
            ...options
        }
        return this.request('POST', '/memory/query', request)
    }
    async querySector(query: string, sector: SectorType, k = 8): Promise<QueryResponse> {
        return this.query(query, {
            k,
            filters: { sector }
        })
    }
    async reinforce(id: string, boost = 0.2): Promise<{ ok: boolean }> {
        return this.request('POST', '/memory/reinforce', { id, boost })
    }
    async getAll(options: {
        limit?: number
        offset?: number
        sector?: SectorType
    } = {}): Promise<{ items: Memory[] }> {
        const params = new URLSearchParams()
        if (options.limit) params.set('l', options.limit.toString())
        if (options.offset) params.set('u', options.offset.toString())
        if (options.sector) params.set('sector', options.sector)
        const query = params.toString() ? `?${params}` : ''
        return this.request('GET', `/memory/all${query}`)
    }
    async getBySector(sector: SectorType, limit = 100, offset = 0): Promise<{ items: Memory[] }> {
        return this.getAll({ sector, limit, offset })
    }
    async delete(id: string): Promise<{ ok: boolean }> {
        return this.request('DELETE', `/memory/${id}`)
    }
    async update(id: string, options: {
        content?: string
        tags?: string[]
        metadata?: Record<string, unknown>
    }): Promise<{ id: string, updated: boolean }> {
        return this.request('PATCH', `/memory/${id}`, options)
    }
    async getStats(): Promise<SectorsResponse> {
        return this.getSectors()
    }
}
export default OpenMemory