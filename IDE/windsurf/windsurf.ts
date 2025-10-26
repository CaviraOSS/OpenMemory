const DEFAULT_URL = 'http://localhost:8080'

type MemoryRecord = {
    id: string
    content: string
    score?: number
    primary_sector?: string
    sectors?: string[]
}

type RecallResult = {
    query: string
    matches: MemoryRecord[]
}

interface WindsurfMemoryClient {
    remember(content: string, tags?: string[]): Promise<MemoryRecord>
    recall(query: string, k?: number): Promise<RecallResult>
    forget(id: string): Promise<void>
}

const baseUrl = () => process.env.OPENMEMORY_URL?.trim() || DEFAULT_URL

async function send<T>(path: string, init: RequestInit): Promise<T> {
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

export async function integrateWithWindsurf(): Promise<WindsurfMemoryClient> {
    const remember = async (content: string, tags?: string[]) => {
        if (!content?.trim()) throw new Error('remember() requires non-empty content')
        return send<MemoryRecord>('/memory/add', {
            method: 'POST',
            body: JSON.stringify({ content, tags })
        })
    }

    const recall = async (query: string, k = 8) => {
        if (!query?.trim()) throw new Error('recall() requires a query string')
        return send<RecallResult>('/memory/query', {
            method: 'POST',
            body: JSON.stringify({ query, k })
        })
    }

    const forget = async (id: string) => {
        if (!id) throw new Error('forget() requires a memory id')
        await send<void>(`/memory/${encodeURIComponent(id)}`, { method: 'DELETE' })
    }

    return { remember, recall, forget }
}

export default integrateWithWindsurf
