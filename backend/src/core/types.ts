export type add_req = { content: string, tags?: string[], metadata?: Record<string, unknown>, salience?: number, decay_lambda?: number, user_id?: string }
export type q_req = { query: string, k?: number, filters?: { tags?: string[], min_score?: number, sector?: string, user_id?: string } }
export type sector_type = 'episodic' | 'semantic' | 'procedural' | 'emotional' | 'reflective'

export type mem_row = {
    id: string
    content: string
    primary_sector: string
    tags: string | null
    meta: string | null
    user_id: string | null
    created_at: number
    updated_at: number
    last_seen_at: number
    salience: number
    decay_lambda: number
    version: number
}

export type rpc_err_code = -32600 | -32603

export type ingest_req = {
    source: 'file' | 'link' | 'connector'
    content_type: 'pdf' | 'docx' | 'html' | 'md' | 'txt' | 'audio'
    data: string
    metadata?: Record<string, unknown>
    config?: { force_root?: boolean, sec_sz?: number, lg_thresh?: number }
}

export type ingest_url_req = {
    url: string
    metadata?: Record<string, unknown>
    config?: { force_root?: boolean, sec_sz?: number, lg_thresh?: number }
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

export type lgm_context_req = { graph_id?: string, namespace?: string, limit?: number }

export type lgm_reflection_req = {
    node?: string
    graph_id?: string
    namespace?: string
    content?: string
    context_ids?: string[]
}

export type ide_event_req = {
    event: 'edit' | 'open' | 'close' | 'save' | 'refactor' | 'comment' | 'pattern_detected' | 'api_call' | 'definition' | 'reflection'
    file?: string
    snippet?: string
    comment?: string
    metadata: { project?: string, lang?: string, user?: string, timestamp?: number, [key: string]: unknown }
    session_id?: string
}

export type ide_context_query_req = {
    query: string
    k?: number
    session_id?: string
    file_filter?: string
    include_patterns?: boolean
    include_knowledge?: boolean
}

export type ide_session_req = { user?: string, project?: string, ide?: string }
