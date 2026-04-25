"use client"

import { useState, useEffect } from "react"
import { API_BASE_URL, getHeaders } from "@/lib/api"
import { useProject } from "@/lib/project-context"

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
    project_id?: string
}

const sectorColors: Record<string, string> = {
    semantic: "sky",
    episodic: "amber",
    procedural: "emerald",
    emotional: "rose",
    reflective: "purple"
}

export default function memories() {
    const { currentProject } = useProject()
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
    const limit = 1000

    useEffect(() => {
        fetchMems()
    }, [page, filt, currentProject])

    async function fetchMems() {
        setloading(true)
        seterror(null)
        try {
            const offset = (page - 1) * limit
            let url = `${API_BASE_URL}/memory/all?l=${limit}&u=${offset}`
            if (filt !== "all") url += `&sector=${filt}`
            if (currentProject) url += `&project_id=${currentProject}`
            
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
                    filters: {
                        ...(filt !== "all" ? { sector: filt } : {}),
                        ...(currentProject ? { project_id: currentProject } : {}),
                    },
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
                    project_id: m.project_id
                }))
            )
        } catch (e: any) {
            seterror(e.message)
        } finally {
            setloading(false)
        }
    }

    async function handleAddMemory(content: string, sector: string, tags: string, scope: 'project' | 'global') {
        try {
            const res = await fetch(`${API_BASE_URL}/memory/add`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    content,
                    tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
                    metadata: { primary_sector: sector },
                    project_id: scope === 'project' ? currentProject : 'system_global'
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
                <div className="flex items-center gap-3">
                    <h1 className="text-white text-2xl font-semibold tracking-tight">Memory Topology</h1>
                    {currentProject && (
                        <div className="bg-stone-900 border border-stone-800 rounded-full px-3 py-1 flex items-center gap-2">
                            <div className="size-1.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]"></div>
                            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{currentProject}</span>
                        </div>
                    )}
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="rounded-xl p-2 px-4 bg-sky-500 hover:bg-sky-600 text-white flex items-center space-x-2 shadow-lg shadow-sky-500/10 transition-all active:scale-95"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" /></svg>
                    <span className="font-medium">New Memory</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-6" suppressHydrationWarning>
                <fieldset className="space-y-2 border border-stone-900 rounded-3xl px-4 pb-4 pt-1 bg-stone-950/20 backdrop-blur-sm">
                    <legend className="px-2 text-[10px] font-bold uppercase tracking-widest text-stone-500">Sectors</legend>
                    <button
                        onClick={() => { setfilt("all"); setpage(1) }}
                        className={`w-full rounded-xl p-2 pl-4 flex items-center space-x-3 transition-all ${filt === "all" ? "bg-stone-900 text-stone-200 border border-stone-800" : "text-stone-500 hover:text-stone-300 hover:bg-stone-900/40"}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
                        <h1 className="text-sm font-medium">All</h1>
                    </button>
                    <button
                        onClick={() => { setfilt("semantic"); setpage(1) }}
                        className={`w-full rounded-xl p-2 pl-4 flex items-center space-x-3 transition-all ${filt === "semantic" ? "bg-stone-900 text-stone-200 border border-stone-800" : "text-stone-500 hover:text-stone-300 hover:bg-stone-900/40"}`}
                    >
                        <div className="size-2 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.3)]"></div>
                        <h1 className="text-sm font-medium">Semantic</h1>
                    </button>
                    <button
                        onClick={() => { setfilt("episodic"); setpage(1) }}
                        className={`w-full rounded-xl p-2 pl-4 flex items-center space-x-3 transition-all ${filt === "episodic" ? "bg-stone-900 text-stone-200 border border-stone-800" : "text-stone-500 hover:text-stone-300 hover:bg-stone-900/40"}`}
                    >
                        <div className="size-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]"></div>
                        <h1 className="text-sm font-medium">Episodic</h1>
                    </button>
                    <button
                        onClick={() => { setfilt("procedural"); setpage(1) }}
                        className={`w-full rounded-xl p-2 pl-4 flex items-center space-x-3 transition-all ${filt === "procedural" ? "bg-stone-900 text-stone-200 border border-stone-800" : "text-stone-500 hover:text-stone-300 hover:bg-stone-900/40"}`}
                    >
                        <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"></div>
                        <h1 className="text-sm font-medium">Procedural</h1>
                    </button>
                    <button
                        onClick={() => { setfilt("emotional"); setpage(1) }}
                        className={`w-full rounded-xl p-2 pl-4 flex items-center space-x-3 transition-all ${filt === "emotional" ? "bg-stone-900 text-stone-200 border border-stone-800" : "text-stone-500 hover:text-stone-300 hover:bg-stone-900/40"}`}
                    >
                        <div className="size-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]"></div>
                        <h1 className="text-sm font-medium">Emotional</h1>
                    </button>
                    <button
                        onClick={() => { setfilt("reflective"); setpage(1) }}
                        className={`w-full rounded-xl p-2 pl-4 flex items-center space-x-3 transition-all ${filt === "reflective" ? "bg-stone-900 text-stone-200 border border-stone-800" : "text-stone-500 hover:text-stone-300 hover:bg-stone-900/40"}`}
                    >
                        <div className="size-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.3)]"></div>
                        <h1 className="text-sm font-medium">Reflective</h1>
                    </button>
                </fieldset>

                <fieldset className="space-y-2 border border-stone-900 rounded-3xl px-4 pb-4 pt-1 flex justify-center items-center col-span-2 bg-stone-950/20 backdrop-blur-sm">
                    <legend className="px-2 text-[10px] font-bold uppercase tracking-widest text-stone-500">Retrieval</legend>
                    <div className="relative flex items-center text-sm w-full">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4 absolute left-3 text-stone-600"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                        <button onClick={handleSearch} className="absolute right-1 p-1 px-3 bg-stone-900 text-stone-400 rounded-lg hover:bg-stone-800 border border-stone-800 transition-colors">/</button>
                        <input
                            type="text"
                            value={srch}
                            onChange={(e) => setsrch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="w-full bg-stone-950 rounded-xl border border-stone-900 outline-none p-2 pl-10 text-stone-300 focus:border-stone-700 transition-colors"
                            placeholder="Vector search..."
                        />
                    </div>
                </fieldset>

                <fieldset className="space-y-2 border border-stone-900 rounded-3xl px-5 pb-4 pt-4 flex justify-center items-center col-span-3 bg-stone-950/20 backdrop-blur-sm">
                    <div className="grid grid-cols-5 gap-4 w-full" suppressHydrationWarning>
                        <div className={`rounded-xl border border-sky-500/15 p-3 text-sky-500 bg-sky-500/5 text-center flex flex-col items-center justify-center`} suppressHydrationWarning>
                            <div className="text-2xl font-bold tracking-tighter" suppressHydrationWarning>{sectorCounts.semantic || 0}</div>
                            <div className="text-[9px] mt-1 font-bold uppercase tracking-tighter opacity-70" suppressHydrationWarning>Semantic</div>
                        </div>
                        <div className={`rounded-xl border border-amber-500/15 p-3 text-amber-500 bg-amber-500/5 text-center flex flex-col items-center justify-center`} suppressHydrationWarning>
                            <div className="text-2xl font-bold tracking-tighter" suppressHydrationWarning>{sectorCounts.episodic || 0}</div>
                            <div className="text-[9px] mt-1 font-bold uppercase tracking-tighter opacity-70" suppressHydrationWarning>Episodic</div>
                        </div>
                        <div className={`rounded-xl border border-emerald-500/15 p-3 text-emerald-500 bg-emerald-500/5 text-center flex flex-col items-center justify-center`} suppressHydrationWarning>
                            <div className="text-2xl font-bold tracking-tighter" suppressHydrationWarning>{sectorCounts.procedural || 0}</div>
                            <div className="text-[9px] mt-1 font-bold uppercase tracking-tighter opacity-70" suppressHydrationWarning>Procedural</div>
                        </div>
                        <div className={`rounded-xl border border-rose-500/15 p-3 text-rose-500 bg-rose-500/5 text-center flex flex-col items-center justify-center`} suppressHydrationWarning>
                            <div className="text-2xl font-bold tracking-tighter" suppressHydrationWarning>{sectorCounts.emotional || 0}</div>
                            <div className="text-[9px] mt-1 font-bold uppercase tracking-tighter opacity-70" suppressHydrationWarning>Emotional</div>
                        </div>
                        <div className={`rounded-xl border border-purple-500/15 p-3 text-purple-500 bg-purple-500/5 text-center flex flex-col items-center justify-center`} suppressHydrationWarning>
                            <div className="text-2xl font-bold tracking-tighter" suppressHydrationWarning>{sectorCounts.reflective || 0}</div>
                            <div className="text-[9px] mt-1 font-bold uppercase tracking-tighter opacity-70" suppressHydrationWarning>Reflective</div>
                        </div>
                    </div>
                </fieldset>

                <div className="col-span-6 rounded-3xl border border-stone-900 p-6 bg-stone-950/10">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg text-stone-200 font-medium">Memory Stream <span className="text-stone-500 text-sm ml-2 font-normal">({filteredMems.length} entries)</span></h2>
                        <div className="flex items-center gap-2">
                             <div className="flex items-center gap-1.5 px-2 py-1 bg-stone-900/50 rounded-lg border border-stone-800">
                                <div className="size-1.5 rounded-full bg-green-500"></div>
                                <span className="text-[10px] text-stone-400 font-bold uppercase">Realtime</span>
                             </div>
                        </div>
                    </div>
                    {loading && <div className="text-stone-400 text-center py-20 flex flex-col items-center gap-4">
                        <div className="size-6 border-2 border-stone-800 border-t-sky-500 rounded-full animate-spin"></div>
                        <span className="text-sm">Synthesizing memory patterns...</span>
                    </div>}
                    {error && <div className="text-rose-400 text-center py-20 bg-rose-500/5 rounded-2xl border border-rose-500/10">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-8 mx-auto mb-2 opacity-50"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
                        Error: {error}
                    </div>}
                    {!loading && !error && (
                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-stone-800 scrollbar-track-transparent">
                            {filteredMems.length === 0 ? (
                                <div className="rounded-2xl w-full p-20 bg-stone-950/30 border border-stone-900/50 flex flex-col items-center justify-center text-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-10 text-stone-800 mb-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-2.24-1.815-4.056-4.057-4.056h-10.88c-2.242 0-4.057 1.816-4.057 4.056Z" /></svg>
                                    <span className="text-stone-500 font-medium">No memory clusters found.</span>
                                    <p className="text-stone-700 text-sm mt-1 max-w-xs">Adjust your project or sector filters to locate specific knowledge points.</p>
                                </div>
                            ) : (
                                filteredMems.map((mem) => (
                                    <div
                                        key={mem.id}
                                        className="group rounded-2xl w-full p-4 bg-stone-950/40 border border-stone-900/50 flex items-start justify-between hover:border-stone-700/50 hover:bg-stone-900/20 transition-all duration-300"
                                    >
                                        <div className="flex items-start space-x-4 flex-1">
                                            <div className={`rounded-xl border border-${sectorColors[mem.primary_sector]}-500/20 p-2.5 text-${sectorColors[mem.primary_sector]}-500 bg-${sectorColors[mem.primary_sector]}-500/5 shadow-[0_0_15px_rgba(0,0,0,0.2)]`}>
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" /></svg>
                                            </div>
                                            <div className="flex flex-col flex-1 gap-1">
                                                <h3 className="text-stone-100 font-medium leading-snug line-clamp-2 group-hover:text-white transition-colors">{mem.content}</h3>
                                                <div className="flex items-center flex-wrap gap-2 mt-1">
                                                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border border-${sectorColors[mem.primary_sector]}-500/30 text-${sectorColors[mem.primary_sector]}-500 bg-${sectorColors[mem.primary_sector]}-500/5`}>
                                                        {mem.primary_sector}
                                                    </span>
                                                    
                                                    {mem.project_id && (
                                                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border ${mem.project_id === 'system_global' ? 'border-amber-500/30 text-amber-500 bg-amber-500/5' : 'border-sky-500/30 text-sky-500 bg-sky-500/5'}`}>
                                                            {mem.project_id === 'system_global' ? 'GLOBAL' : mem.project_id}
                                                        </span>
                                                    )}

                                                    <div className="h-3 w-[1px] bg-stone-800 mx-1"></div>

                                                    <span className="text-[10px] text-stone-500 font-medium">
                                                        Salience: <span className="text-stone-400">{(mem.salience * 100).toFixed(0)}%</span>
                                                    </span>
                                                    <span className="text-[10px] text-stone-500 font-medium">
                                                        {new Date(mem.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                    </span>
                                                    
                                                    {mem.tags?.length > 0 && (
                                                        <>
                                                            <div className="h-3 w-[1px] bg-stone-800 mx-1"></div>
                                                            <div className="flex gap-1.5">
                                                                {mem.tags.map(tag => (
                                                                    <span key={tag} className="text-[9px] bg-stone-900 text-stone-500 px-1.5 py-0.5 rounded border border-stone-800/50 group-hover:text-stone-400 transition-colors">
                                                                        #{tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setEditingMem(mem); setShowEditModal(true) }}
                                                className="p-2 rounded-xl bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-400 hover:text-stone-100 transition-all"
                                                title="Edit Memory"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" /><path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" /></svg>
                                            </button>
                                            <button
                                                onClick={() => { setDeletingMemId(mem.id); setShowDeleteModal(true) }}
                                                className="p-2 rounded-xl bg-rose-500/5 border border-rose-500/20 hover:bg-rose-500/10 text-rose-500/70 hover:text-rose-500 transition-all"
                                                title="Delete Memory"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4"><path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {!loading && !error && filteredMems.length >= limit && (
                        <div className="flex justify-center items-center space-x-2 mt-6">
                            <button
                                onClick={() => setpage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="rounded-xl p-2 px-4 bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                            >
                                Previous
                            </button>
                            <span className="text-stone-500 text-xs font-bold uppercase tracking-widest mx-4">Page {page}</span>
                            <button
                                onClick={() => setpage(p => p + 1)}
                                disabled={filteredMems.length < limit}
                                className="rounded-xl p-2 px-4 bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showAddModal && <AddMemoryModal onClose={() => setShowAddModal(false)} onAdd={handleAddMemory} initialProject={currentProject} />}

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

function AddMemoryModal({ onClose, onAdd, initialProject }: { onClose: () => void; onAdd: (content: string, sector: string, tags: string, scope: 'project' | 'global') => void; initialProject: string | null }) {
    const [content, setContent] = useState('')
    const [sector, setSector] = useState('semantic')
    const [tags, setTags] = useState('')
    const [scope, setScope] = useState<'project' | 'global'>(initialProject ? 'project' : 'global')

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-stone-950 rounded-3xl p-8 max-w-2xl w-full border border-stone-900 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl text-white font-semibold tracking-tight">Add New Memory</h2>
                        <p className="text-stone-500 text-sm mt-1">Specify knowledge scope and sector for better retrieval.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-900 rounded-full text-stone-500 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => setScope('project')}
                            disabled={!initialProject}
                            className={`p-4 rounded-2xl border transition-all flex flex-col gap-1 items-start ${scope === 'project' ? 'bg-sky-500/10 border-sky-500/50 text-sky-500' : 'bg-stone-900/50 border-stone-800 text-stone-500 hover:border-stone-700 disabled:opacity-30'}`}
                        >
                            <span className="text-[10px] font-bold uppercase tracking-widest">Project Scope</span>
                            <span className="text-sm font-medium">{initialProject || "None Selected"}</span>
                        </button>
                        <button 
                            onClick={() => setScope('global')}
                            className={`p-4 rounded-2xl border transition-all flex flex-col gap-1 items-start ${scope === 'global' ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' : 'bg-stone-900/50 border-stone-800 text-stone-500 hover:border-stone-700'}`}
                        >
                            <span className="text-[10px] font-bold uppercase tracking-widest">Global Scope</span>
                            <span className="text-sm font-medium">System Global</span>
                        </button>
                    </div>

                    <div>
                        <label className="text-stone-400 text-[10px] font-bold uppercase tracking-widest mb-2 block">Knowledge Content</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full bg-stone-950 rounded-2xl border border-stone-800 outline-none p-4 text-stone-300 min-h-32 focus:border-stone-600 transition-colors"
                            placeholder="Enter the knowledge point or observation..."
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="text-stone-400 text-[10px] font-bold uppercase tracking-widest mb-2 block">Primary Sector</label>
                            <select
                                value={sector}
                                onChange={(e) => setSector(e.target.value)}
                                className="w-full bg-stone-950 rounded-xl border border-stone-800 outline-none p-3 text-stone-300 focus:border-stone-600 appearance-none"
                            >
                                <option value="semantic">Semantic (Facts)</option>
                                <option value="episodic">Episodic (Events)</option>
                                <option value="procedural">Procedural (How-to)</option>
                                <option value="emotional">Emotional (States)</option>
                                <option value="reflective">Reflective (Thoughts)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-stone-400 text-[10px] font-bold uppercase tracking-widest mb-2 block">Taxonomy Tags</label>
                            <input
                                type="text"
                                value={tags}
                                onChange={(e) => setTags(e.target.value)}
                                className="w-full bg-stone-950 rounded-xl border border-stone-800 outline-none p-3 text-stone-300 focus:border-stone-600"
                                placeholder="e.g. react, hooks, auth"
                            />
                        </div>
                    </div>
                </div>
                
                <div className="flex space-x-4 mt-10">
                    <button
                        onClick={() => onAdd(content, sector, tags, scope)}
                        disabled={!content.trim()}
                        className="flex-1 rounded-2xl p-4 bg-sky-500 hover:bg-sky-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-sky-500/20 transition-all"
                    >
                        Index Memory
                    </button>
                    <button
                        onClick={onClose}
                        className="px-8 rounded-2xl p-4 bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 font-semibold transition-all"
                    >
                        Discard
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-stone-950 rounded-3xl p-8 max-w-2xl w-full border border-stone-900 shadow-2xl">
                <h2 className="text-2xl text-white font-semibold tracking-tight mb-8">Refine Memory</h2>
                <div className="space-y-6">
                    <div>
                        <label className="text-stone-400 text-[10px] font-bold uppercase tracking-widest mb-2 block">Content</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full bg-stone-950 rounded-2xl border border-stone-800 outline-none p-4 text-stone-300 min-h-32 focus:border-stone-600 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="text-stone-400 text-[10px] font-bold uppercase tracking-widest mb-2 block">Tags</label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            className="w-full bg-stone-950 rounded-xl border border-stone-800 outline-none p-3 text-stone-300 focus:border-stone-600"
                            placeholder="tag1, tag2"
                        />
                    </div>
                </div>
                <div className="flex space-x-4 mt-10">
                    <button
                        onClick={() => onEdit(mem.id, content, tags)}
                        disabled={!content.trim()}
                        className="flex-1 rounded-2xl p-4 bg-sky-500 hover:bg-sky-600 text-white font-semibold shadow-lg shadow-sky-500/20 transition-all"
                    >
                        Update Index
                    </button>
                    <button
                        onClick={onClose}
                        className="px-8 rounded-2xl p-4 bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 font-semibold transition-all"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-stone-950 rounded-3xl p-8 max-w-md w-full border border-stone-900 shadow-2xl">
                <div className="size-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-8 text-rose-500"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                </div>
                <h2 className="text-xl text-white font-semibold text-center mb-2">Delete Knowledge Cluster?</h2>
                <p className="text-stone-500 text-center text-sm mb-10">This action will permanently purge the memory and its associated vectors. This cannot be undone.</p>
                <div className="flex space-x-3">
                    <button
                        onClick={onConfirm}
                        className="flex-1 rounded-2xl p-4 bg-rose-500 hover:bg-rose-600 text-white font-semibold shadow-lg shadow-rose-500/20 transition-all"
                    >
                        Purge Memory
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-2xl p-4 bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 font-semibold transition-all"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
}
