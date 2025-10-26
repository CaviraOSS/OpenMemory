const DEFAULT_URL = 'http://localhost:8080'

type MemoryAddResponse = {
    id: string
    primary_sector: string
    sectors: string[]
}

type MemoryMatch = {
    id: string
    content: string
    score: number
    sectors: string[]
    primary_sector: string
}

type MemoryQueryResponse = {
    query: string
    matches: MemoryMatch[]
}

const baseUrl = () => process.env.OPENMEMORY_URL?.trim() || DEFAULT_URL

async function request<T>(path: string, init: RequestInit): Promise<T> {
    const url = `${baseUrl()}${path}`
    const headers = {
        'content-type': 'application/json',
        ...(init.headers || {})
    }
    const response = await fetch(url, { ...init, headers })
    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`OpenMemory request failed (${response.status}): ${text || response.statusText}`)
    }
    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
}

export async function remember(content: string, tags?: string[]): Promise<MemoryAddResponse> {
    if (!content || !content.trim()) {
        throw new Error('remember() requires non-empty content')
    }
    return request<MemoryAddResponse>('/memory/add', {
        method: 'POST',
        body: JSON.stringify({ content, tags })
    })
}

export async function recall(query: string, k = 8): Promise<MemoryQueryResponse> {
    if (!query || !query.trim()) {
        throw new Error('recall() requires a query string')
    }
    return request<MemoryQueryResponse>('/memory/query', {
        method: 'POST',
        body: JSON.stringify({ query, k })
    })
}

export async function forget(id: string): Promise<void> {
    if (!id) throw new Error('forget() requires a memory id')
    await request<void>(`/memory/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export default { remember, recall, forget }
