export type add_req = { content: string, tags?: string[], metadata?: Record<string, unknown>, salience?: number, decay_lambda?: number }
export type q_req = { query: string, k?: number, filters?: { tags?: string[], min_score?: number, sector?: string } }
export type SectorType = 'episodic' | 'semantic' | 'procedural' | 'emotional' | 'reflective'

export type MemoryRow = {
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

export type JsonRpcErrorCode = -32600 | -32603

export type ingest_req = {
    source: 'file' | 'link' | 'connector'
    content_type: 'pdf' | 'docx' | 'html' | 'md' | 'txt' | 'audio'
    data: string
    metadata?: Record<string, unknown>
    config?: {
        forceRootChild?: boolean
        sectionSize?: number
        largeDocThreshold?: number
    }
}

export type ingest_url_req = {
    url: string
    metadata?: Record<string, unknown>
    config?: {
        forceRootChild?: boolean
        sectionSize?: number
        largeDocThreshold?: number
    }
}

export type lgm_store_req = {
    node: string
    content: string
    tags?: string[]
    metadata?: Record<string, unknown>
    namespace?: string
    graph_id?: string
    reflective?: boolean
}

export type lgm_retrieve_req = {
    node: string
    query?: string
    namespace?: string
    graph_id?: string
    limit?: number
    include_metadata?: boolean
}

export type lgm_context_req = {
    graph_id?: string
    namespace?: string
    limit?: number
}

export type lgm_reflection_req = {
    node?: string
    graph_id?: string
    namespace?: string
    content?: string
    context_ids?: string[]
}
