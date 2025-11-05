"use client"

import { useState, useEffect, useRef } from "react"
import { Chart, registerables } from "chart.js"
import { API_BASE_URL, getHeaders } from "@/lib/api"

Chart.register(...registerables)

interface decaystats {
    sector: string
    avgdecay: number
    atriskrisk: number
    stable: number
    avgSalience: number
    memories: memory[]
}

interface memory {
    id: string
    content: string
    sector: string
    salience: number
}

export default function decay() {
    const chartref = useRef<HTMLCanvasElement>(null)
    const chartInstance = useRef<Chart | null>(null)
    const [stats, setstats] = useState<decaystats[]>([])
    const [riskmems, setriskmems] = useState<memory[]>([])
    const [loading, setloading] = useState(true)
    const [error, seterror] = useState<string | null>(null)
    const [dashstats, setdashstats] = useState<any>(null)

    useEffect(() => {
        fetchdata()
        const interval = setInterval(fetchdata, 60000)
        return () => clearInterval(interval)
    }, [])

    async function fetchdata() {
        setloading(true)
        seterror(null)
        try {
            const [statsres, memsres] = await Promise.all([
                fetch(`${API_BASE_URL}/dashboard/stats`, { headers: getHeaders() }),
                fetch(`${API_BASE_URL}/memory/all?l=100&u=0`, { headers: getHeaders() })
            ])

            if (!statsres.ok || !memsres.ok) throw new Error('failed to fetch data')

            const statsdata = await statsres.json()
            const memsdata = await memsres.json()

            setdashstats(statsdata)

            const sectors = ['semantic', 'episodic', 'procedural', 'emotional', 'reflective']
            const sectorstats = sectors.map(sector => {
                const sectormems = (memsdata.items || []).filter((m: any) => m.primary_sector === sector)
                const atrisk = sectormems.filter((m: any) => m.salience < 0.3).length
                const stable = sectormems.filter((m: any) => m.salience >= 0.3).length
                const avgdecay = sectormems.length > 0
                    ? sectormems.reduce((sum: number, m: any) => sum + (m.decay_lambda || 0.01), 0) / sectormems.length
                    : 0.01
                const avgSalience = sectormems.length > 0
                    ? sectormems.reduce((sum: number, m: any) => sum + m.salience, 0) / sectormems.length
                    : 1.0

                return {
                    sector,
                    avgdecay,
                    atriskrisk: atrisk,
                    stable,
                    avgSalience,
                    memories: sectormems.map((m: any) => ({
                        id: m.id,
                        content: m.content,
                        sector: m.primary_sector,
                        salience: m.salience
                    }))
                }
            })

            setstats(sectorstats)

            const atriskmems = (memsdata.items || [])
                .filter((m: any) => m.salience < 0.3)
                .slice(0, 10)
                .map((m: any) => ({
                    id: m.id,
                    content: m.content,
                    sector: m.primary_sector,
                    salience: m.salience
                }))

            setriskmems(atriskmems)

        } catch (e: any) {
            seterror(e.message)
        } finally {
            setloading(false)
        }
    }

    async function boostmemory(id: string) {
        try {
            const res = await fetch(`${API_BASE_URL}/memory/${id}`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ salience: 0.8 })
            })
            if (!res.ok) throw new Error('failed to boost memory')
            fetchdata()
        } catch (e: any) {
            alert(`Error: ${e.message}`)
        }
    }

    useEffect(() => {
        if (!chartref.current || stats.length === 0) return

        const ctx = chartref.current.getContext("2d")
        if (!ctx) return

        if (chartInstance.current) {
            chartInstance.current.destroy()
        }

        chartInstance.current = new Chart(ctx, {
            type: "line",
            data: {
                labels: Array.from({ length: 30 }, (_, i) => `day ${i + 1}`),
                datasets: [
                    {
                        label: "semantic",
                        data: Array.from({ length: 30 }, (_, i) => {
                            const sectorData = stats.find(s => s.sector === 'semantic')
                            const avgSalience = sectorData?.avgSalience || 1.0
                            const avgDecay = sectorData?.avgdecay || 0.012
                            return Math.max(0, avgSalience - (i * avgDecay))
                        }),
                        borderColor: "rgba(96, 165, 250, 1)",
                        backgroundColor: "rgba(96, 165, 250, 0.1)",
                        tension: 0.4
                    },
                    {
                        label: "episodic",
                        data: Array.from({ length: 30 }, (_, i) => {
                            const sectorData = stats.find(s => s.sector === 'episodic')
                            const avgSalience = sectorData?.avgSalience || 1.0
                            const avgDecay = sectorData?.avgdecay || 0.018
                            return Math.max(0, avgSalience - (i * avgDecay))
                        }),
                        borderColor: "rgba(251, 191, 36, 1)",
                        backgroundColor: "rgba(251, 191, 36, 0.1)",
                        tension: 0.4
                    },
                    {
                        label: "procedural",
                        data: Array.from({ length: 30 }, (_, i) => {
                            const sectorData = stats.find(s => s.sector === 'procedural')
                            const avgSalience = sectorData?.avgSalience || 1.0
                            const avgDecay = sectorData?.avgdecay || 0.008
                            return Math.max(0, avgSalience - (i * avgDecay))
                        }),
                        borderColor: "rgba(52, 211, 153, 1)",
                        backgroundColor: "rgba(52, 211, 153, 0.1)",
                        tension: 0.4
                    },
                    {
                        label: "emotional",
                        data: Array.from({ length: 30 }, (_, i) => {
                            const sectorData = stats.find(s => s.sector === 'emotional')
                            const avgSalience = sectorData?.avgSalience || 1.0
                            const avgDecay = sectorData?.avgdecay || 0.022
                            return Math.max(0, avgSalience - (i * avgDecay))
                        }),
                        borderColor: "rgba(244, 114, 182, 1)",
                        backgroundColor: "rgba(244, 114, 182, 0.1)",
                        tension: 0.4
                    },
                    {
                        label: "reflective",
                        data: Array.from({ length: 30 }, (_, i) => {
                            const sectorData = stats.find(s => s.sector === 'reflective')
                            const avgSalience = sectorData?.avgSalience || 1.0
                            const avgDecay = sectorData?.avgdecay || 0.015
                            return Math.max(0, avgSalience - (i * avgDecay))
                        }),
                        borderColor: "rgba(167, 139, 250, 1)",
                        backgroundColor: "rgba(167, 139, 250, 0.1)",
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: "index",
                        intersect: false,
                        backgroundColor: "rgba(0, 0, 0, 0.9)",
                        borderColor: "rgba(63, 63, 70, 1)",
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        min: 0,
                        max: 1,
                        grid: {
                            color: "rgba(39, 39, 42, 0.3)"
                        },
                        ticks: {
                            color: "#8a8a8a"
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: "#8a8a8a",
                            maxTicksLimit: 10
                        }
                    }
                }
            }
        })

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy()
                chartInstance.current = null
            }
        }
    }, [stats])

    const getdecaycolor = (rate: number) => {
        if (rate < 0.1) return "text-green-500"
        if (rate < 0.2) return "text-yellow-500"
        return "text-red-500"
    }

    return (
        <div className="min-h-screen" suppressHydrationWarning>
            <div className="flex items-center justify-between mb-6" suppressHydrationWarning>
                <h1 className="text-white text-2xl">Decay Monitor</h1>
                <button
                    onClick={fetchdata}
                    className="rounded-xl p-2 px-4 bg-sky-500 hover:bg-sky-600 text-white flex items-center space-x-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm15.408 3.352a.75.75 0 0 0-.919.53 7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.984a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 15.059-4.035.75.75 0 0 0-.53-.918Z" clipRule="evenodd" /></svg>
                    <span>Refresh</span>
                </button>
            </div>

            {loading && <div className="text-stone-400 text-center py-8" suppressHydrationWarning>Loading decay data...</div>}
            {error && <div className="text-rose-400 text-center py-8" suppressHydrationWarning>Error: {error}</div>}

            {!loading && !error && (
                <div className="space-y-6" suppressHydrationWarning>

                    { }
                    <fieldset className="rounded-3xl border border-stone-900 bg-stone-950 p-6">
                        <legend className="text-white font-semibold px-2 flex items-center gap-2">
                            Salience Decay Trends
                            <span className="text-xs font-normal text-stone-500">(30-day projection)</span>
                        </legend>
                        <div className="flex gap-3 mb-4 flex-wrap">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-sky-500" />
                                <span className="text-sm text-stone-400">Semantic</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                <span className="text-sm text-stone-400">Episodic</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-purple-500" />
                                <span className="text-sm text-stone-400">Procedural</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-rose-500" />
                                <span className="text-sm text-stone-400">Emotional</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-amber-500" />
                                <span className="text-sm text-stone-400">Reflective</span>
                            </div>
                        </div>
                        <div style={{ height: "400px" }}>
                            <canvas ref={chartref} />
                        </div>
                    </fieldset>

                    { }
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {stats.map(s => (
                            <div key={s.sector} className="rounded-xl border border-stone-900 bg-stone-950 p-4">
                                <h3 className="text-sm font-medium text-stone-400 mb-3 capitalize">{s.sector}</h3>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs text-stone-500 mb-1">Avg Decay Rate</p>
                                        <p className={`text-2xl font-bold ${getdecaycolor(s.avgdecay)}`}>
                                            {(s.avgdecay * 100).toFixed(1)}%/day
                                        </p>
                                    </div>
                                    <div className="pt-3 border-t border-stone-800">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-stone-500">At Risk</span>
                                            <span className="text-sm font-medium text-red-400">{s.atriskrisk}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-stone-500">Stable</span>
                                            <span className="text-sm font-medium text-emerald-400">{s.stable}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    { }
                    <fieldset className="rounded-3xl border border-stone-900 bg-stone-950 p-6">
                        <legend className="text-white font-semibold px-2 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5 text-rose-500">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                            </svg>
                            Memories At Risk
                        </legend>
                        <div className="space-y-3" suppressHydrationWarning>
                            {riskmems.length === 0 ? (
                                <div className="text-center py-8 text-stone-500" suppressHydrationWarning>
                                    <p>No memories at risk! All memories are stable.</p>
                                </div>
                            ) : (
                                riskmems.map(mem => (
                                    <div key={mem.id} className="rounded-xl border border-rose-500/15 bg-rose-500/10 p-4 hover:bg-rose-500/15 transition-colors" suppressHydrationWarning>
                                        <div className="flex items-center justify-between gap-4" suppressHydrationWarning>
                                            <div className="flex-1" suppressHydrationWarning>
                                                <div className="flex items-center gap-2 mb-2" suppressHydrationWarning>
                                                    <span className="text-xs px-2 py-1 rounded-lg bg-stone-900 text-stone-300 uppercase tracking-wide">
                                                        {mem.sector}
                                                    </span>
                                                    <span className="text-xs text-rose-400">Salience: {mem.salience.toFixed(2)}</span>
                                                </div>
                                                <p className="text-sm text-stone-300">{mem.content}</p>
                                            </div>
                                            <button
                                                onClick={() => boostmemory(mem.id)}
                                                className="rounded-xl p-2 pl-4 bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 text-white font-medium"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                                                </svg>
                                                Boost
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </fieldset>
                </div>
            )}
        </div>
    )
}


