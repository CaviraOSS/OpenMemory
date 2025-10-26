const DEFAULT_URL = 'http://localhost:8080'

interface MemoryAddResponse {
    id: string
    primary_sector: string
    sectors: string[]
}

interface MemoryQueryResponse {
    query: string
    matches: Array<{
        id: string
        content: string
        score: number
        primary_sector: string
        sectors: string[]
    }>
}

const baseUrl = () => process.env.OPENMEMORY_URL?.trim() || DEFAULT_URL

async function request<T>(path: string, init: RequestInit): Promise<T> {
    const url = `${baseUrl()}${path}`
    const headers = {
        'content-type': 'application/json',
        ...(init.headers || {})
    }
    const res = await fetch(url, { ...init, headers })
    if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`OpenMemory request failed (${res.status}): ${body || res.statusText}`)
    }
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
}

async function add(content: string, tags?: string[]): Promise<MemoryAddResponse> {
    if (!content?.trim()) throw new Error('om.add() requires non-empty content')
    return request<MemoryAddResponse>('/memory/add', {
        method: 'POST',
        body: JSON.stringify({ content, tags })
    })
}

async function search(query: string, k = 8): Promise<MemoryQueryResponse> {
    if (!query?.trim()) throw new Error('om.search() requires a query string')
    return request<MemoryQueryResponse>('/memory/query', {
        method: 'POST',
        body: JSON.stringify({ query, k })
    })
}

async function remove(id: string): Promise<void> {
    if (!id) throw new Error('om.remove() requires a memory id')
    await request<void>(`/memory/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export const om = {
    add,
    search,
    remove
}

export default om
