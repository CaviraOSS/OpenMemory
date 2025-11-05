"use client"

import { useState, useEffect } from "react"
import { API_BASE_URL, getHeaders } from "@/lib/api"

interface mem {
    id: string
    content: string
    primary_sector: string
    tags: string[]
    metadata?: any
    created_at: number
    updated_at?: number
    last_seen_at?: number
    salience: number
    decay_lambda?: number
    version?: number
}

const sectorColors: Record<string, string> = {
    semantic: "sky",
    episodic: "amber",
    procedural: "emerald",
    emotional: "rose",
    reflective: "purple"
}

export default function memories() {
    const [mems, setmems] = useState<mem[]>([])
    const [srch, setsrch] = useState("")
    const [filt, setfilt] = useState("all")
    const [loading, setloading] = useState(false)
    const [error, seterror] = useState<string | null>(null)
    const [page, setpage] = useState(1)
    const [showAddModal, setShowAddModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [editingMem, setEditingMem] = useState<mem | null>(null)
    const [deletingMemId, setDeletingMemId] = useState<string | null>(null)
    const [apiKey, setApiKey] = useState<string>('')

    const limit = 1000

    useEffect(() => {
        const key = process.env.NEXT_PUBLIC_API_KEY
        if (key) {
            setApiKey(key)
        }
    }, [])

    useEffect(() => {
        if (apiKey) {
            fetchMems()
        }
    }, [page, filt, apiKey])

    async function fetchMems() {
        setloading(true)
        seterror(null)
        try {
            const offset = (page - 1) * limit
            const url = filt !== "all"
                ? `${API_BASE_URL}/memory/all?l=${limit}&u=${offset}&sector=${filt}`
                : `${API_BASE_URL}/memory/all?l=${limit}&u=${offset}`
            const res = await fetch(url, { headers: getHeaders() })
            if (!res.ok) throw new Error('failed to fetch memories')
            const data = await res.json()
            setmems(data.items || [])
        } catch (e: any) {
            seterror(e.message)
        } finally {
            setloading(false)
        }
    }

    async function handleSearch() {
        if (!srch.trim()) {
            fetchMems()
            return
        }
        setloading(true)
        seterror(null)
        try {
            const res = await fetch(`${API_BASE_URL}/memory/query`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    query: srch,
                    k: 1000,
                    filters: filt !== "all" ? { sector: filt } : undefined,
                }),
            })
            if (!res.ok) throw new Error('search failed')
            const data = await res.json()
            setmems(
                (data.matches || []).map((m: any) => ({
                    id: m.id,
                    content: m.content,
                    primary_sector: m.primary_sector,
                    tags: [],
                    created_at: m.last_seen_at || Date.now(),
                    salience: m.salience,
                }))
            )
        } catch (e: any) {
            seterror(e.message)
        } finally {
            setloading(false)
        }
    }

    async function handleAddMemory(content: string, sector: string, tags: string) {
        try {
            const res = await fetch(`${API_BASE_URL}/memory/add`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    content,
                    tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
                    metadata: { primary_sector: sector },
                }),
            })
            if (!res.ok) throw new Error('failed to add memory')
            setShowAddModal(false)
            fetchMems()
        } catch (e: any) {
            alert(`Error: ${e.message}`)
        }
    }

    async function handleEditMemory(id: string, content: string, tags: string) {
        try {
            const res = await fetch(`${API_BASE_URL}/memory/${id}`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({
                    content,
                    tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
                }),
            })
            if (!res.ok) throw new Error('failed to update memory')
            setShowEditModal(false)
            setEditingMem(null)
            fetchMems()
        } catch (e: any) {
            alert(`Error: ${e.message}`)
        }
    }

    async function handleDeleteMemory(id: string) {
        try {
            const res = await fetch(`${API_BASE_URL}/memory/${id}`, {
                method: 'DELETE',
                headers: getHeaders(),
            })
            if (!res.ok) throw new Error('failed to delete memory')
            setShowDeleteModal(false)
            setDeletingMemId(null)
            fetchMems()
        } catch (e: any) {
            alert(`Error: ${e.message}`)
        }
    }

    const filteredMems = mems.filter(m => {
        const matchesSearch = !srch || m.content.toLowerCase().includes(srch.toLowerCase())
        return matchesSearch
    })

    const sectorCounts = mems.reduce((acc, m) => {
        acc[m.primary_sector] = (acc[m.primary_sector] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    return (
        <div className="min-h-screen" suppressHydrationWarning>
            <div className="flex items-center justify-between mb-6" suppressHydrationWarning>
                <h1 className="text-white text-2xl">Memory Topology</h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    disabled={!apiKey}
                    className="rounded-xl p-2 px-4 bg-sky-500 hover:bg-sky-600 text-white flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" /></svg>
                    <span>New Memory</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-6" suppressHydrationWarning>
                <fieldset className="space-y-2 border border-stone-900 rounded-3xl px-4 pb-4 pt-1">
                    <legend className="px-2 text-stone-400">Filters</legend>
                    <button
                        onClick={() => { setfilt("all"); setpage(1) }}
                        className={`w-full rounded-xl p-2 pl-4 flex items-center space-x-2 ${filt === "all" ? "bg-stone-900 text-stone-200" : "hover:bg-stone-900/50 hover:text-stone-300"}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
                        <h1 className="text-md">All</h1>
                    </button>
                    <button
                        onClick={() => { setfilt("semantic"); setpage(1) }}
                        className={`w-full rounded-xl p-2 pl-4 flex items-center space-x-2 ${filt === "semantic" ? "bg-stone-900 text-stone-200" : "hover:bg-stone-900/50 hover:text-stone-300"}`}
                    >
                        <div className="size-3 rounded-full bg-sky-500"></div>
                        <h1 className="text-md">Semantic</h1>
                    </button>
                    <button
                        onClick={() => { setfilt("episodic"); setpage(1) }}
                        className={`w-full rounded-xl p-2 pl-4 flex items-center space-x-2 ${filt === "episodic" ? "bg-stone-900 text-stone-200" : "hover:bg-stone-900/50 hover:text-stone-300"}`}
                    >
                        <div className="size-3 rounded-full bg-amber-500"></div>
                        <h1 className="text-md">Episodic</h1>
                    </button>
                    <button
                        onClick={() => { setfilt("procedural"); setpage(1) }}
                        className={`w-full rounded-xl p-2 pl-4 flex items-center space-x-2 ${filt === "procedural" ? "bg-stone-900 text-stone-200" : "hover:bg-stone-900/50 hover:text-stone-300"}`}
                    >
                        <div className="size-3 rounded-full bg-emerald-500"></div>
                        <h1 className="text-md">Procedural</h1>
                    </button>
                    <button
                        onClick={() => { setfilt("emotional"); setpage(1) }}
                        className={`w-full rounded-xl p-2 pl-4 flex items-center space-x-2 ${filt === "emotional" ? "bg-stone-900 text-stone-200" : "hover:bg-stone-900/50 hover:text-stone-300"}`}
                    >
                        <div className="size-3 rounded-full bg-rose-500"></div>
                        <h1 className="text-md">Emotional</h1>
                    </button>
                    <button
                        onClick={() => { setfilt("reflective"); setpage(1) }}
                        className={`w-full rounded-xl p-2 pl-4 flex items-center space-x-2 ${filt === "reflective" ? "bg-stone-900 text-stone-200" : "hover:bg-stone-900/50 hover:text-stone-300"}`}
                    >
                        <div className="size-3 rounded-full bg-purple-500"></div>
                        <h1 className="text-md">Reflective</h1>
                    </button>
                </fieldset>

                <fieldset className="space-y-2 border border-stone-900 rounded-3xl px-4 pb-4 pt-1 flex justify-center items-center col-span-2">
                    <legend className="px-2 text-stone-400">Search</legend>
                    <div className="relative flex items-center text-sm w-full">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4 absolute left-3"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                        <button onClick={handleSearch} className="absolute right-1 p-1 px-3 bg-stone-900 rounded-lg hover:bg-stone-800">/</button>
                        <input
                            type="text"
                            value={srch}
                            onChange={(e) => setsrch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="w-full bg-stone-950 rounded-xl border border-stone-900 outline-none p-2 pl-10 text-stone-300"
                            placeholder="Search memories..."
                        />
                    </div>
                </fieldset>

                <fieldset className="space-y-2 border border-stone-900 rounded-3xl px-5 pb-4 pt-4 flex justify-center items-center col-span-3">
                    <div className="grid grid-cols-5 gap-4 w-full" suppressHydrationWarning>
                        <div className={`rounded-xl border border-sky-500/15 p-3 text-sky-500 bg-sky-500/10 text-center`} suppressHydrationWarning>
                            <div className="text-2xl font-bold" suppressHydrationWarning>{sectorCounts.semantic || 0}</div>
                            <div className="text-xs mt-1" suppressHydrationWarning>Semantic</div>
                        </div>
                        <div className={`rounded-xl border border-amber-500/15 p-3 text-amber-500 bg-amber-500/10 text-center`} suppressHydrationWarning>
                            <div className="text-2xl font-bold" suppressHydrationWarning>{sectorCounts.episodic || 0}</div>
                            <div className="text-xs mt-1" suppressHydrationWarning>Episodic</div>
                        </div>
                        <div className={`rounded-xl border border-emerald-500/15 p-3 text-emerald-500 bg-emerald-500/10 text-center`} suppressHydrationWarning>
                            <div className="text-2xl font-bold" suppressHydrationWarning>{sectorCounts.procedural || 0}</div>
                            <div className="text-xs mt-1" suppressHydrationWarning>Procedural</div>
                        </div>
                        <div className={`rounded-xl border border-rose-500/15 p-3 text-rose-500 bg-rose-500/10 text-center`} suppressHydrationWarning>
                            <div className="text-2xl font-bold" suppressHydrationWarning>{sectorCounts.emotional || 0}</div>
                            <div className="text-xs mt-1" suppressHydrationWarning>Emotional</div>
                        </div>
                        <div className={`rounded-xl border border-purple-500/15 p-3 text-purple-500 bg-purple-500/10 text-center`} suppressHydrationWarning>
                            <div className="text-2xl font-bold" suppressHydrationWarning>{sectorCounts.reflective || 0}</div>
                            <div className="text-xs mt-1" suppressHydrationWarning>Reflective</div>
                        </div>
                    </div>
                </fieldset>

                <div className="col-span-6 rounded-xl border border-stone-900 p-4">
                    <h2 className="text-xl text-white mb-4">Memories ({filteredMems.length})</h2>
                    {loading && <div className="text-stone-400 text-center py-8">Loading...</div>}
                    {error && <div className="text-rose-400 text-center py-8">Error: {error}</div>}
                    {!loading && !error && (
                        <div className="space-y-2 max-h-[600px] overflow-y-auto">
                            {filteredMems.length === 0 ? (
                                <div className="rounded-xl w-full p-8 py-16 bg-stone-950/50 border border-stone-900 flex items-center justify-center">
                                    <span className="text-stone-400 text-center">No memories found.<br />Try adjusting your filters.</span>
                                </div>
                            ) : (
                                filteredMems.map((mem) => (
                                    <div
                                        key={mem.id}
                                        className="rounded-xl w-full p-3 bg-stone-950/50 border border-stone-900 flex items-start justify-between hover:border-stone-700 transition-colors"
                                    >
                                        <div className="flex items-start space-x-3 flex-1">
                                            <div className={`rounded-xl border border-${sectorColors[mem.primary_sector]}-500/15 p-2 text-${sectorColors[mem.primary_sector]}-500 bg-${sectorColors[mem.primary_sector]}-500/10`}>
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" /></svg>
                                            </div>
                                            <div className="flex flex-col flex-1">
                                                <h3 className="font-semibold text-stone-200">{mem.content}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="bg-stone-900 rounded-lg p-0.5 px-1.5 text-xs border border-stone-700/50 text-stone-400">
                                                        {mem.primary_sector}
                                                    </span>
                                                    <span className="text-xs text-stone-500">
                                                        Salience: {(mem.salience * 100).toFixed(0)}%
                                                    </span>
                                                    <span className="text-xs text-stone-500">
                                                        {new Date(mem.created_at).toLocaleDateString()}
                                                    </span>
                                                    {mem.tags?.map(tag => (
                                                        <span key={tag} className="bg-stone-800 rounded px-2 py-0.5 text-xs text-stone-400">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => { setEditingMem(mem); setShowEditModal(true) }}
                                                className="p-2 rounded-xl bg-stone-900 border border-stone-800 hover:bg-stone-800"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" /><path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" /></svg>
                                            </button>
                                            <button
                                                onClick={() => { setDeletingMemId(mem.id); setShowDeleteModal(true) }}
                                                className="p-2 rounded-xl bg-rose-900/20 border border-rose-800/50 hover:bg-rose-900/40"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4 text-rose-500"><path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {!loading && !error && filteredMems.length >= limit && (
                        <div className="flex justify-center items-center space-x-2 mt-4">
                            <button
                                onClick={() => setpage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="rounded-xl p-2 px-4 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="text-stone-400">Page {page}</span>
                            <button
                                onClick={() => setpage(p => p + 1)}
                                disabled={filteredMems.length < limit}
                                className="rounded-xl p-2 px-4 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showAddModal && <AddMemoryModal onClose={() => setShowAddModal(false)} onAdd={handleAddMemory} />}

            {showEditModal && editingMem && (
                <EditMemoryModal
                    mem={editingMem}
                    onClose={() => { setShowEditModal(false); setEditingMem(null) }}
                    onEdit={handleEditMemory}
                />
            )}

            {showDeleteModal && deletingMemId && (
                <DeleteConfirmModal
                    onClose={() => { setShowDeleteModal(false); setDeletingMemId(null) }}
                    onConfirm={() => handleDeleteMemory(deletingMemId)}
                />
            )}
        </div>
    )
}

function AddMemoryModal({ onClose, onAdd }: { onClose: () => void; onAdd: (content: string, sector: string, tags: string) => void }) {
    const [content, setContent] = useState('')
    const [sector, setSector] = useState('semantic')
    const [tags, setTags] = useState('')

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-black rounded-xl p-6 max-w-2xl w-full mx-4 border border-stone-800">
                <h2 className="text-xl text-white mb-4">Add New Memory</h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-stone-400 text-sm mb-2 block">Content</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full bg-stone-950 rounded-xl border border-stone-800 outline-none p-3 text-stone-300 min-h-32"
                            placeholder="Enter memory content..."
                        />
                    </div>
                    <div>
                        <label className="text-stone-400 text-sm mb-2 block">Sector</label>
                        <select
                            value={sector}
                            onChange={(e) => setSector(e.target.value)}
                            className="w-full bg-stone-950 rounded-xl border border-stone-800 outline-none p-3 text-stone-300"
                        >
                            <option value="semantic">Semantic</option>
                            <option value="episodic">Episodic</option>
                            <option value="procedural">Procedural</option>
                            <option value="emotional">Emotional</option>
                            <option value="reflective">Reflective</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-stone-400 text-sm mb-2 block">Tags (comma-separated)</label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            className="w-full bg-stone-950 rounded-xl border border-stone-800 outline-none p-3 text-stone-300"
                            placeholder="tag1, tag2, tag3"
                        />
                    </div>
                </div>
                <div className="flex space-x-3 mt-6">
                    <button
                        onClick={() => onAdd(content, sector, tags)}
                        disabled={!content.trim()}
                        className="flex-1 rounded-xl p-2 bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Add Memory
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-xl p-2 bg-stone-800 hover:bg-stone-700 text-white"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
}

function EditMemoryModal({ mem, onClose, onEdit }: { mem: mem; onClose: () => void; onEdit: (id: string, content: string, tags: string) => void }) {
    const [content, setContent] = useState(mem.content)
    const [tags, setTags] = useState(mem.tags?.join(', ') || '')

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-black rounded-xl p-6 max-w-2xl w-full mx-4 border border-stone-800">
                <h2 className="text-xl text-white mb-4">Edit Memory</h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-stone-400 text-sm mb-2 block">Content</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full bg-stone-950 rounded-xl border border-stone-800 outline-none p-3 text-stone-300 min-h-32"
                        />
                    </div>
                    <div>
                        <label className="text-stone-400 text-sm mb-2 block">Tags (comma-separated)</label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            className="w-full bg-stone-950 rounded-xl border border-stone-800 outline-none p-3 text-stone-300"
                            placeholder="tag1, tag2, tag3"
                        />
                    </div>
                </div>
                <div className="flex space-x-3 mt-6">
                    <button
                        onClick={() => onEdit(mem.id, content, tags)}
                        disabled={!content.trim()}
                        className="flex-1 rounded-xl p-2 bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save Changes
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-xl p-2 bg-stone-800 hover:bg-stone-700 text-white"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
}

function DeleteConfirmModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-black rounded-xl p-6 max-w-md w-full mx-4 border border-stone-800">
                <h2 className="text-xl text-white mb-4">Delete Memory</h2>
                <p className="text-stone-400 mb-6">Are you sure you want to delete this memory? This action cannot be undone.</p>
                <div className="flex space-x-3">
                    <button
                        onClick={onConfirm}
                        className="flex-1 rounded-xl p-2 bg-rose-500 hover:bg-rose-600 text-white"
                    >
                        Delete
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-xl p-2 bg-stone-800 hover:bg-stone-700 text-white"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
}
