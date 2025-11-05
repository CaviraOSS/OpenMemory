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
    user_id?: string
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
        user_id?: string
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
    async getUserMemories(userId: string, options: {
        limit?: number
        offset?: number
    } = {}): Promise<{ user_id: string, items: Memory[] }> {
        const params = new URLSearchParams()
        if (options.limit) params.set('l', options.limit.toString())
        if (options.offset) params.set('u', options.offset.toString())
        const query = params.toString() ? `?${params}` : ''
        return this.request('GET', `/users/${userId}/memories${query}`)
    }
    async getUserSummary(userId: string): Promise<{
        user_id: string
        summary: string
        reflection_count: number
        updated_at: number
    }> {
        return this.request('GET', `/users/${userId}/summary`)
    }
    async regenerateUserSummary(userId: string): Promise<{
        ok: boolean
        user_id: string
        summary: string
        reflection_count: number
    }> {
        return this.request('POST', `/users/${userId}/summary/regenerate`)
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
    // IDE Routes
    async ideStoreEvent(event: {
        event_type: string
        file_path?: string
        content?: string
        session_id?: string
        metadata?: Record<string, unknown>
    }): Promise<{
        success: boolean
        memory_id: string
        primary_sector: SectorType
        sectors: SectorType[]
    }> {
        return this.request('POST', '/api/ide/events', event)
    }
    async ideQueryContext(query: string, options: {
        k?: number
        limit?: number
        session_id?: string
        file_path?: string
    } = {}): Promise<{
        success: boolean
        memories: Array<{
            memory_id: string
            content: string
            primary_sector: SectorType
            sectors: SectorType[]
            score: number
            salience: number
            last_seen_at: number
            path: string[]
        }>
        total: number
        query: string
    }> {
        return this.request('POST', '/api/ide/context', { query, ...options })
    }
    async ideStartSession(session: {
        user_id?: string
        project_name?: string
        ide_name?: string
    } = {}): Promise<{
        success: boolean
        session_id: string
        memory_id: string
        started_at: number
        user_id: string
        project_name: string
        ide_name: string
    }> {
        return this.request('POST', '/api/ide/session/start', session)
    }
    async ideEndSession(sessionId: string): Promise<{
        success: boolean
        session_id: string
        ended_at: number
        summary_memory_id: string
        statistics: {
            total_events: number
            sectors: Record<string, number>
            unique_files: number
            files: string[]
        }
    }> {
        return this.request('POST', '/api/ide/session/end', { session_id: sessionId })
    }
    async ideGetPatterns(sessionId: string): Promise<{
        success: boolean
        session_id: string
        pattern_count: number
        patterns: Array<{
            pattern_id: string
            description: string
            salience: number
            detected_at: number
            last_reinforced: number
        }>
    }> {
        return this.request('GET', `/api/ide/patterns/${sessionId}`)
    }
    // Compression Routes
    async compress(text: string, algorithm?: 'semantic' | 'syntactic' | 'aggressive'): Promise<{
        ok: boolean
        comp: string
        m: Record<string, unknown>
        hash: string
    }> {
        return this.request('POST', '/api/compression/compress', { text, algorithm })
    }
    async compressBatch(texts: string[], algorithm: 'semantic' | 'syntactic' | 'aggressive' = 'semantic'): Promise<{
        ok: boolean
        results: Array<{ comp: string; m: Record<string, unknown>; hash: string }>
        total: number
    }> {
        return this.request('POST', '/api/compression/batch', { texts, algorithm })
    }
    async analyzeCompression(text: string): Promise<{
        ok: boolean
        analysis: Record<string, unknown>
        rec: { algo: string; save: string; lat: string }
    }> {
        return this.request('POST', '/api/compression/analyze', { text })
    }
    async getCompressionStats(): Promise<{
        ok: boolean
        stats: Record<string, unknown>
    }> {
        return this.request('GET', '/api/compression/stats')
    }
    // LangGraph Memory Routes
    async lgmStore(data: {
        node_id: string
        namespace?: string
        content: string
        metadata?: Record<string, unknown>
    }): Promise<Record<string, unknown>> {
        return this.request('POST', '/lgm/store', data)
    }
    async lgmRetrieve(data: {
        node_id: string
        namespace?: string
        query: string
        k?: number
    }): Promise<Record<string, unknown>> {
        return this.request('POST', '/lgm/retrieve', data)
    }
    async lgmGetContext(data: {
        node_id: string
        namespace?: string
    }): Promise<Record<string, unknown>> {
        return this.request('POST', '/lgm/context', data)
    }
    async lgmCreateReflection(data: {
        node_id: string
        namespace?: string
        content: string
    }): Promise<Record<string, unknown>> {
        return this.request('POST', '/lgm/reflection', data)
    }
    async lgmGetConfig(): Promise<Record<string, unknown>> {
        return this.request('GET', '/lgm/config')
    }
}
export default OpenMemory