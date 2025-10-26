const DEFAULT_URL = 'http://localhost:8080'

const baseUrl = () => (process.env.OPENMEMORY_URL || DEFAULT_URL).trim()

async function http(path, init) {
  const url = `${baseUrl()}${path}`
  const headers = { 'content-type': 'application/json', ...(init.headers || {}) }
  const res = await fetch(url, { ...init, headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenMemory request failed (${res.status}): ${body || res.statusText}`)
  }
  if (res.status === 204) return undefined
  return res.json()
}

export async function memoryAdd(content, tags) {
  if (!content || !content.trim()) {
    throw new Error('memoryAdd() requires non-empty content')
  }
  return http('/memory/add', {
    method: 'POST',
    body: JSON.stringify({ content, tags })
  })
}

export async function memoryQuery(query, k = 8) {
  if (!query || !query.trim()) {
    throw new Error('memoryQuery() requires a query string')
  }
  return http('/memory/query', {
    method: 'POST',
    body: JSON.stringify({ query, k })
  })
}

export async function memoryDelete(id) {
  if (!id) throw new Error('memoryDelete() requires a memory id')
  await http(`/memory/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export default { memoryAdd, memoryQuery, memoryDelete }
