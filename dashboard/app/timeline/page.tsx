"use client"

import { useState, useEffect } from "react"
import { API_BASE_URL, getHeaders } from "@/lib/api"

interface event {
    id: string
    time: number
    type: "create" | "update" | "decay" | "reflect"
    title: string
    desc: string
    sector: string
    salience?: number
}

export default function timeline() {
    const [filter, setfilter] = useState("all")
    const [events, setevents] = useState<event[]>([])
    const [loading, setloading] = useState(true)
    const [error, seterror] = useState<string | null>(null)
    const [limit, setlimit] = useState(50)

    useEffect(() => {
        fetchactivity()
    }, [limit])

    async function fetchactivity() {
        setloading(true)
        seterror(null)
        try {
            const res = await fetch(`${API_BASE_URL}/dashboard/activity?limit=${limit}`, { headers: getHeaders() })
            if (!res.ok) throw new Error('failed to fetch activity')
            const data = await res.json()

            const mapped = (data.activities || []).map((a: any) => ({
                id: a.id,
                time: a.timestamp,
                type: determineType(a),
                title: getTitle(a),
                desc: a.content || 'No description',
                sector: a.sector,
                salience: a.salience
            }))
            setevents(mapped)
        } catch (e: any) {
            seterror(e.message)
        } finally {
            setloading(false)
        }
    }

    function determineType(activity: any): "create" | "update" | "decay" | "reflect" {
        if (activity.salience < 0.3) return "decay"
        if (activity.sector === "reflective") return "reflect"
        if (activity.type === 'memory_updated') return "update"
        return "create"
    }

    function getTitle(activity: any): string {
        if (activity.salience < 0.3) return "salience decay"
        if (activity.sector === "reflective") return "reflection generated"
        if (activity.type === 'memory_updated') return "memory updated"
        return "memory created"
    }

    const filtered = filter === "all" ? events : events.filter(e => e.type === filter)

    const typecolors: Record<string, string> = {
        create: "emerald",
        update: "sky",
        decay: "amber",
        reflect: "purple"
    }

    const formattime = (ts: number) => {
        const diff = Date.now() - ts
        const hours = Math.floor(diff / 3600000)
        const mins = Math.floor((diff % 3600000) / 60000)
        return hours > 0 ? `${hours}h ${mins}m ago` : `${mins}m ago`
    }

    return (
        <div className="min-h-screen" suppressHydrationWarning>
            <div className="flex items-center justify-between mb-6" suppressHydrationWarning>
                <h1 className="text-white text-2xl">Global Logs</h1>
                <div className="flex items-center gap-2" suppressHydrationWarning>
                    <select
                        value={limit}
                        onChange={(e) => setlimit(parseInt(e.target.value))}
                        className="bg-stone-950 rounded-xl border border-stone-900 outline-none p-2 px-3 text-stone-300"
                    >
                        <option value={25}>25 events</option>
                        <option value={50}>50 events</option>
                        <option value={100}>100 events</option>
                        <option value={200}>200 events</option>
                    </select>
                    <button
                        onClick={fetchactivity}
                        className="rounded-xl p-2 px-4 bg-sky-500 hover:bg-sky-600 text-white flex items-center space-x-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm15.408 3.352a.75.75 0 0 0-.919.53 7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.984a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 15.059-4.035.75.75 0 0 0-.53-.918Z" clipRule="evenodd" /></svg>
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-6" suppressHydrationWarning>
                { }
                <fieldset className="space-y-2 border border-stone-900 rounded-3xl px-4 pb-4 pt-1">
                    <legend className="px-2 text-stone-400">Event Type</legend>
                    <button
                        onClick={() => setfilter("all")}
                        className={`w-full rounded-xl p-2 pl-4 flex items-center space-x-2 ${filter === "all" ? "bg-stone-900 text-stone-200" : "hover:bg-stone-900/50 hover:text-stone-300"}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
                        <h1 className="text-md">All Events</h1>
                    </button>
                    <button
                        onClick={() => setfilter("create")}
                        className={`w-full rounded-xl p-2 pl-4 flex items-center space-x-2 ${filter === "create" ? "bg-stone-900 text-stone-200" : "hover:bg-stone-900/50 hover:text-stone-300"}`}
                    >
                        <div className="size-3 rounded-full bg-emerald-500" suppressHydrationWarning></div>
                        <h1 className="text-md">Created</h1>
                    </button>
                    <button
                        onClick={() => setfilter("update")}
                        className={`w-full rounded-xl p-2 pl-4 flex items-center space-x-2 ${filter === "update" ? "bg-stone-900 text-stone-200" : "hover:bg-stone-900/50 hover:text-stone-300"}`}
                    >
                        <div className="size-3 rounded-full bg-sky-500" suppressHydrationWarning></div>
                        <h1 className="text-md">Updated</h1>
                    </button>
                    <button
                        onClick={() => setfilter("decay")}
                        className={`w-full rounded-xl p-2 pl-4 flex items-center space-x-2 ${filter === "decay" ? "bg-stone-900 text-stone-200" : "hover:bg-stone-900/50 hover:text-stone-300"}`}
                    >
                        <div className="size-3 rounded-full bg-amber-500" suppressHydrationWarning></div>
                        <h1 className="text-md">Decay</h1>
                    </button>
                    <button
                        onClick={() => setfilter("reflect")}
                        className={`w-full rounded-xl p-2 pl-4 flex items-center space-x-2 ${filter === "reflect" ? "bg-stone-900 text-stone-200" : "hover:bg-stone-900/50 hover:text-stone-300"}`}
                    >
                        <div className="size-3 rounded-full bg-purple-500" suppressHydrationWarning></div>
                        <h1 className="text-md">Reflections</h1>
                    </button>
                </fieldset>

                { }
                <fieldset className="space-y-2 border border-stone-900 rounded-3xl px-5 pb-4 pt-4 flex justify-center items-center col-span-2">
                    <div className="grid grid-cols-4 gap-4 w-full" suppressHydrationWarning>
                        <div className="rounded-xl border border-emerald-500/15 p-2 text-emerald-500 bg-emerald-500/10 text-center" suppressHydrationWarning>
                            <div className="text-xl font-bold" suppressHydrationWarning>{events.filter(e => e.type === "create").length}</div>
                            <div className="text-xs mt-1" suppressHydrationWarning>Created</div>
                        </div>
                        <div className="rounded-xl border border-sky-500/15 p-2 text-sky-500 bg-sky-500/10 text-center" suppressHydrationWarning>
                            <div className="text-xl font-bold" suppressHydrationWarning>{events.filter(e => e.type === "update").length}</div>
                            <div className="text-xs mt-1" suppressHydrationWarning>Updated</div>
                        </div>
                        <div className="rounded-xl border border-amber-500/15 p-2 text-amber-500 bg-amber-500/10 text-center" suppressHydrationWarning>
                            <div className="text-xl font-bold" suppressHydrationWarning>{events.filter(e => e.type === "decay").length}</div>
                            <div className="text-xs mt-1" suppressHydrationWarning>Decay</div>
                        </div>
                        <div className="rounded-xl border border-purple-500/15 p-2 text-purple-500 bg-purple-500/10 text-center" suppressHydrationWarning>
                            <div className="text-xl font-bold" suppressHydrationWarning>{events.filter(e => e.type === "reflect").length}</div>
                            <div className="text-xs mt-1" suppressHydrationWarning>Reflect</div>
                        </div>
                    </div>
                </fieldset>

                { }
                <div className="col-span-3 rounded-xl border border-stone-900 p-2 h-fit" suppressHydrationWarning>
                    <h2 className="text-xl p-2 text-white">System Status</h2>
                    <div className="rounded-xl w-full p-3 bg-stone-950/50 border border-stone-900 flex items-start justify-between mt-2 space-x-2" suppressHydrationWarning>
                        <div className="flex items-start space-x-3" suppressHydrationWarning>
                            <div className="rounded-xl border border-emerald-500/15 p-2 text-emerald-500 bg-emerald-500/10" suppressHydrationWarning>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" /></svg>
                            </div>
                            <div className="flex flex-col" suppressHydrationWarning>
                                <h3 className="font-semibold text-emerald-500">All systems operational</h3>
                                <span className="text-stone-300">Memory system running smoothly. No issues detected.</span>
                            </div>
                        </div>
                        <button className="p-2 rounded-xl bg-stone-950 border border-stone-900 hover:bg-stone-900">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                </div>

                { }
                <div className="col-span-6 rounded-xl border border-stone-900 p-4" suppressHydrationWarning>
                    <h2 className="text-xl text-white mb-4">Event Timeline ({filtered.length})</h2>
                    {loading && <div className="text-stone-400 text-center py-8" suppressHydrationWarning>Loading...</div>}
                    {error && <div className="text-rose-400 text-center py-8" suppressHydrationWarning>Error: {error}</div>}
                    {!loading && !error && filtered.length === 0 && (
                        <div className="rounded-xl w-full p-8 py-16 bg-stone-950/50 border border-stone-900 flex items-center justify-center">
                            <span className="text-stone-400 text-center">No events found.<br />Try adjusting your filters.</span>
                        </div>
                    )}
                    {!loading && !error && filtered.length > 0 && (
                        <div className="relative">
                            { }
                            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-stone-800" />

                            { }
                            <div className="space-y-4">
                                {filtered.map((evt) => (
                                    <div key={evt.id} className="relative pl-16">
                                        { }
                                        <div className={`absolute left-4 top-2 w-4 h-4 rounded-full bg-${typecolors[evt.type]}-500 border-4 border-black`} />

                                        { }
                                        <div className="bg-stone-950/50 border border-stone-900 hover:border-stone-700 rounded-xl p-4 transition-colors cursor-pointer group">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className={`text-xs px-2 py-1 rounded-lg bg-${typecolors[evt.type]}-500/10 text-${typecolors[evt.type]}-500 border border-${typecolors[evt.type]}-500/20 capitalize`}>
                                                            {evt.type}
                                                        </span>
                                                        <span className="text-xs px-2 py-1 rounded-lg bg-stone-900 text-stone-400 border border-stone-800">
                                                            {evt.sector}
                                                        </span>
                                                        <span className="text-xs text-stone-500 ml-auto">{formattime(evt.time)}</span>
                                                    </div>
                                                    <h3 className="font-semibold text-stone-200">{evt.title}</h3>
                                                    <p className="text-sm text-stone-400 mt-1">{evt.desc}</p>
                                                    {evt.salience !== undefined && (
                                                        <span className="text-xs text-stone-500 mt-1 inline-block">
                                                            Salience: {(evt.salience * 100).toFixed(0)}%
                                                        </span>
                                                    )}
                                                </div>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 text-stone-600 group-hover:text-stone-400 transition-colors ml-4"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}