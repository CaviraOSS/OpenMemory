"use client"
import { useState, useEffect } from "react"
import { Bar } from "react-chartjs-2"
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js"
import Sidebar from "@/components/sidebar"
import { API_BASE_URL, getHeaders } from "@/lib/api"
import { StatCard } from "@/components/dashboard/StatCard"
import { HealthMetric } from "@/components/dashboard/HealthMetric"
import { getStatusColor, sectorColors } from "@/lib/colors"

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export default function Dashboard() {
    const [loading, setLoading] = useState(true)
    const [qpsData, setQpsData] = useState<any[]>([])
    const [healthMetrics, setHealthMetrics] = useState<any>({})
    const [logs, setLogs] = useState<any[]>([])
    const [topUsers, setTopUsers] = useState<any[]>([])
    const [timePeriod, setTimePeriod] = useState("today")
    const [qpsStats, setQpsStats] = useState<any>({})
    const [maintenanceData, setMaintenanceData] = useState<any[]>([])
    const [maintenanceStats, setMaintenanceStats] = useState<any>({})
    const [systemHealth, setSystemHealth] = useState<any>({})
    const [backendHealth, setBackendHealth] = useState<any>({})
    const [queryLoadPeriod, setQueryLoadPeriod] = useState("24")

    useEffect(() => {
        fetchDashboardData()
        fetchBackendHealth()
        const dataInterval = setInterval(fetchDashboardData, 30000)
        const healthInterval = setInterval(fetchBackendHealth, 60000) // 1 minute
        return () => {
            clearInterval(dataInterval)
            clearInterval(healthInterval)
        }
    }, [queryLoadPeriod])

    const fetchDashboardData = async () => {
        try {
            // Fetch dashboard stats
            const statsRes = await fetch(`${API_BASE_URL}/dashboard/stats`, {
                headers: getHeaders()
            })
            if (statsRes.ok) {
                const stats = await statsRes.json()

                // Update health metrics with comprehensive data
                setHealthMetrics({
                    totalMemories: stats.totalMemories || 0,
                    avgSalience: parseFloat(stats.avgSalience || 0),
                    recentMemories: stats.recentMemories || 0,
                    totalRequests: stats.requests?.total || 0,
                    errors: stats.requests?.errors || 0,
                    errorRate: stats.requests?.errorRate || '0.0',
                })

                // Set QPS stats from backend data
                setQpsStats({
                    peakQps: stats.qps?.peak || 0,
                    avgQps: stats.qps?.average || 0,
                    total: stats.totalMemories || 0,
                    errors: stats.requests?.errors || 0,
                    cacheHit: stats.qps?.cacheHitRate || 0,
                })

                // Update only config-related system health (preserve health endpoint data)
                setSystemHealth((prev: any) => ({
                    ...prev,
                    activeSegments: stats.config?.cacheSegments || 0,
                    maxActive: stats.config?.maxActive || 0,
                }))
            }

            // Fetch activity logs
            const activityRes = await fetch(`${API_BASE_URL}/dashboard/activity?limit=20`, {
                headers: getHeaders()
            })
            if (activityRes.ok) {
                const activity = await activityRes.json()
                setLogs(activity.activities?.map((a: any) => ({
                    time: new Date(a.timestamp).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                    }),
                    event: a.type.replace('_', ' '),
                    sector: a.sector,
                    salience: a.salience?.toFixed(2),
                    level: a.salience > 0.8 ? 'Critical' : a.salience > 0.5 ? 'Warning' : 'Info',
                })) || [])
            }

            // Fetch sector timeline
            const timelineRes = await fetch(`${API_BASE_URL}/dashboard/sectors/timeline?hours=${queryLoadPeriod}`, {
                headers: getHeaders()
            })
            if (timelineRes.ok) {
                const timeline = await timelineRes.json()
                const grouped: Record<string, any> = {}

                timeline.timeline?.forEach((item: any) => {
                    // Use sort_key for grouping to distinguish same hours on different days
                    const key = item.sort_key || item.hour
                    if (!grouped[key]) {
                        grouped[key] = { hour: item.hour, sort_key: key }
                    }
                    grouped[key][item.primary_sector] = item.count
                })

                // Explicitly sort by sort_key for proper chronological ordering
                const chartData = Object.values(grouped)
                    .sort((a: any, b: any) => (a.sort_key || a.hour).localeCompare(b.sort_key || b.hour))
                    .map((item: any) => ({
                        hour: item.hour,
                        semantic: item.semantic || 0,
                        episodic: item.episodic || 0,
                        procedural: item.procedural || 0,
                        emotional: item.emotional || 0,
                        reflective: item.reflective || 0,
                    }))

                setQpsData(chartData)
            }

            // fetch neural maintenance data
            const maintRes = await fetch(`${API_BASE_URL}/dashboard/maintenance?hours=24`, {
                headers: getHeaders()
            })
            if (maintRes.ok) {
                const maint = await maintRes.json()
                setMaintenanceData(maint.operations || [])
                setMaintenanceStats(maint.totals || {
                    cycles: 0,
                    reflections: 0,
                    consolidations: 0,
                    efficiency: 0
                })
            }

            setLoading(false)
        } catch (error) {
            console.error('Error fetching dashboard data:', error)
            setLoading(false)
        }
    }

    const fetchBackendHealth = async () => {
        try {
            const healthRes = await fetch(`${API_BASE_URL}/dashboard/health`)
            if (healthRes.ok) {
                const health = await healthRes.json()
                setBackendHealth(health)

                // Update system health with real backend data (merge with existing)
                setSystemHealth((prev: any) => ({
                    ...prev,
                    memoryUsage: health.memory?.heapUsed && health.memory?.heapTotal
                        ? Math.round((health.memory.heapUsed / health.memory.heapTotal) * 100)
                        : 0,
                    heapUsed: health.memory?.heapUsed || 0,
                    heapTotal: health.memory?.heapTotal || 0,
                    rss: health.memory?.rss || 0,
                    external: health.memory?.external || 0,
                    uptimeDays: health.uptime?.days || 0,
                    uptimeHours: health.uptime?.hours || 0,
                    uptimeSeconds: health.uptime?.seconds || 0,
                }))
            }
        } catch (error) {
            console.error('Error fetching backend health:', error)
        }
    }

    const timePeriods = [
        { value: "today", label: "Today" },
        { value: "1d", label: "1D" },
        { value: "1w", label: "1W" },
        { value: "1m", label: "1M" },
        { value: "1y", label: "1Y" },
        { value: "5y", label: "5Y" },
        { value: "max", label: "All" },
    ]

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-[#e6e6e6] flex items-center justify-center">
                <div className="text-center">
                    <div className="text-stone-400 text-xl mb-2">Loading Dashboard...</div>
                    <div className="text-stone-600 text-sm">Connecting to backend at {API_BASE_URL}</div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-black text-[#e6e6e6]">
            <Sidebar />

            <div className="p-6 ml-24">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-4xl font-bold text-[#f4f4f5]">Dashboard</h1>
                    <div className="flex gap-2">
                        {timePeriods.map((period) => (
                            <button
                                key={period.value}
                                onClick={() => setTimePeriod(period.value)}
                                className={`rounded-xl p-2 pl-4 flex items-center justify-center transition-colors ${timePeriod === period.value
                                    ? "bg-stone-900 text-stone-200 border border-stone-800"
                                    : "hover:bg-stone-900/50 hover:text-stone-300 border border-stone-800 text-stone-400"
                                    }`}
                            >
                                <span className="text-sm font-medium">{period.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                { }
                <div className="grid grid-cols-4 gap-4 mb-6 md:grid-cols-7">
                    <StatCard
                        label="Total Memories"
                        value={healthMetrics.totalMemories?.toLocaleString() || "0"}
                        status="Stable"
                        statusColor={getStatusColor("Stable")}
                    />
                    <StatCard
                        label="Recent (24h)"
                        value={healthMetrics.recentMemories || "0"}
                        status="Stable"
                        statusColor={getStatusColor("Stable")}
                    />
                    <StatCard
                        label="Avg Salience"
                        value={(healthMetrics.avgSalience || 0).toFixed(2)}
                        status="Improving"
                        statusColor={getStatusColor("Improving")}
                    />
                    <StatCard
                        label="API Requests"
                        value={(healthMetrics.totalRequests || 0).toLocaleString()}
                        status="High"
                        statusColor={getStatusColor("High")}
                    />
                    <StatCard
                        label="Request Errors"
                        value={healthMetrics.errors || "0"}
                        status={healthMetrics.errors > 10 ? "Critical" : "Stable"}
                        statusColor={getStatusColor(healthMetrics.errors > 10 ? "Critical" : "Stable")}
                    />
                    <StatCard
                        label="Memory Usage"
                        value={`${systemHealth.heapUsed || 0}MB`}
                        status="Stable"
                        statusColor={getStatusColor("Stable")}
                    />
                    <StatCard
                        label="Uptime"
                        value={`${systemHealth.uptimeDays || 0}d ${systemHealth.uptimeHours || 0}h`}
                        status="Stable"
                        statusColor={getStatusColor("Stable")}
                    />
                </div>

                { }
                <div className="grid grid-cols-2 gap-6 mb-6">
                    { }
                    <div className="bg-transparent rounded-xl p-6 border border-[#27272a] hover:border-zinc-600 transition-colors duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-[#f4f4f5]">Memory Query Load</h2>
                            <div className="flex gap-2">
                                <select 
                                    value={queryLoadPeriod}
                                    onChange={(e) => setQueryLoadPeriod(e.target.value)}
                                    className="rounded-xl p-2 pl-4 border border-stone-800 bg-stone-950 hover:bg-stone-900/50 hover:text-stone-300 text-sm font-medium text-stone-400 outline-none cursor-pointer transition-colors"
                                >
                                    <option value="24" className="bg-stone-950">24 hours</option>
                                    <option value="168" className="bg-stone-950">7 days</option>
                                    <option value="720" className="bg-stone-950">30 days</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ height: "280px" }}>
                            <Bar
                                data={{
                                    labels: qpsData.map((d) => d.hour),
                                    datasets: [
                                        {
                                            label: "Semantic",
                                            data: qpsData.map((d) => d.semantic),
                                            backgroundColor: "rgba(248, 113, 113, 0.7)",
                                            borderColor: "rgba(248, 113, 113, 1)",
                                            borderWidth: 0,
                                        },
                                        {
                                            label: "Episodic",
                                            data: qpsData.map((d) => d.episodic),
                                            backgroundColor: "rgba(251, 191, 36, 0.7)",
                                            borderColor: "rgba(251, 191, 36, 1)",
                                            borderWidth: 0,
                                        },
                                        {
                                            label: "Procedural",
                                            data: qpsData.map((d) => d.procedural),
                                            backgroundColor: "rgba(52, 211, 153, 0.7)",
                                            borderColor: "rgba(52, 211, 153, 1)",
                                            borderWidth: 0,
                                        },
                                        {
                                            label: "Emotional",
                                            data: qpsData.map((d) => d.emotional),
                                            backgroundColor: "rgba(96, 165, 250, 0.7)",
                                            borderColor: "rgba(96, 165, 250, 1)",
                                            borderWidth: 0,
                                        },
                                        {
                                            label: "Reflective",
                                            data: qpsData.map((d) => d.reflective),
                                            backgroundColor: "rgba(192, 132, 252, 0.7)",
                                            borderColor: "rgba(192, 132, 252, 1)",
                                            borderWidth: 0,
                                        },
                                    ],
                                }}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    interaction: {
                                        mode: "index",
                                        intersect: false,
                                    },
                                    scales: {
                                        x: {
                                            stacked: true,
                                            grid: {
                                                color: "#2a2a2a",
                                            },
                                            ticks: {
                                                color: "#9ca3af",
                                                font: { size: 11 },
                                            },
                                        },
                                        y: {
                                            stacked: true,
                                            grid: {
                                                color: "#2a2a2a",
                                            },
                                            ticks: {
                                                color: "#9ca3af",
                                                font: { size: 11 },
                                            },
                                        },
                                    },
                                    plugins: {
                                        legend: {
                                            display: false,
                                        },
                                        tooltip: {
                                            backgroundColor: "#111111",
                                            borderColor: "#52525b",
                                            borderWidth: 1,
                                            titleColor: "#e6e6e6",
                                            bodyColor: "#e6e6e6",
                                            padding: 12,
                                            displayColors: true,
                                            boxWidth: 12,
                                            boxHeight: 12,
                                            boxPadding: 4,
                                        },
                                    },
                                }}
                            />
                        </div>
                        <div className="flex gap-3 text-xs text-[#8a8a8a] mt-4 pt-4 border-t border-[#27272a] hover:border-zinc-600 transition-colors duration-200">
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: sectorColors.semantic }} />
                                semantic
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: sectorColors.episodic }} />
                                episodic
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: sectorColors.procedural }} />
                                procedural
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: sectorColors.emotional }} />
                                emotional
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: sectorColors.reflective }} />
                                reflective
                            </div>
                        </div>
                        <div className="grid grid-cols-5 gap-2 mt-4">
                            <div className="bg-transparent rounded p-2 border border-[#27272a] hover:border-zinc-600 transition-colors duration-200 text-center">
                                <p className="text-xs text-[#8a8a8a] mb-1">Peak QPS</p>
                                <p className="text-lg font-bold text-[#f4f4f5]">{qpsStats.peakQps || 0}</p>
                            </div>
                            <div className="bg-transparent rounded p-2 border border-[#27272a] hover:border-zinc-600 transition-colors duration-200 text-center">
                                <p className="text-xs text-[#8a8a8a] mb-1">Avg QPS</p>
                                <p className="text-lg font-bold text-[#f4f4f5]">{qpsStats.avgQps || 0}</p>
                            </div>
                            <div className="bg-transparent rounded p-2 border border-[#27272a] hover:border-zinc-600 transition-colors duration-200 text-center">
                                <p className="text-xs text-[#8a8a8a] mb-1">Total</p>
                                <p className="text-lg font-bold text-[#f4f4f5]">{(qpsStats.total || 0).toLocaleString()}k</p>
                            </div>
                            <div className="bg-transparent rounded p-2 border border-[#27272a] hover:border-zinc-600 transition-colors duration-200 text-center">
                                <p className="text-xs text-[#8a8a8a] mb-1">Errors</p>
                                <p className="text-lg font-bold text-[#f87171]">{qpsStats.errors || 0}</p>
                            </div>
                            <div className="bg-transparent rounded p-2 border border-[#27272a] hover:border-zinc-600 transition-colors duration-200 text-center">
                                <p className="text-xs text-[#8a8a8a] mb-1">Cache Hit</p>
                                <p className="text-lg font-bold text-[#22c55e]">{qpsStats.cacheHit || 0}%</p>
                            </div>
                        </div>
                    </div>

                    { }
                    <div className="bg-transparent rounded-xl p-6 border border-[#27272a] hover:border-zinc-600 transition-colors duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-[#f4f4f5]">Neural Maintenance</h2>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
                                <span className="text-xs text-[#8a8a8a]">Active</span>
                            </div>
                        </div>
                        <div style={{ height: "280px" }}>
                            <Bar
                                data={{
                                    labels: maintenanceData.map((d) => d.hour),
                                    datasets: [
                                        {
                                            label: "Decay Cycles",
                                            data: maintenanceData.map((d) => d.decay),
                                            backgroundColor: "rgba(34, 197, 94, 0.7)",
                                            borderColor: "rgba(34, 197, 94, 1)",
                                            borderWidth: 0,
                                        },
                                        {
                                            label: "Reflections",
                                            data: maintenanceData.map((d) => d.reflection),
                                            backgroundColor: "rgba(96, 165, 250, 0.7)",
                                            borderColor: "rgba(96, 165, 250, 1)",
                                            borderWidth: 0,
                                        },
                                        {
                                            label: "Consolidations",
                                            data: maintenanceData.map((d) => d.consolidation),
                                            backgroundColor: "rgba(192, 132, 252, 0.7)",
                                            borderColor: "rgba(192, 132, 252, 1)",
                                            borderWidth: 0,
                                        },
                                    ],
                                }}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    interaction: {
                                        mode: "index",
                                        intersect: false,
                                    },
                                    scales: {
                                        x: {
                                            grid: {
                                                color: "#2a2a2a",
                                            },
                                            ticks: {
                                                color: "#9ca3af",
                                                font: { size: 11 },
                                            },
                                        },
                                        y: {
                                            grid: {
                                                color: "#2a2a2a",
                                            },
                                            ticks: {
                                                color: "#9ca3af",
                                                font: { size: 11 },
                                            },
                                        },
                                    },
                                    plugins: {
                                        legend: {
                                            display: false,
                                        },
                                        tooltip: {
                                            backgroundColor: "#111111",
                                            borderColor: "#52525b",
                                            borderWidth: 1,
                                            titleColor: "#e6e6e6",
                                            bodyColor: "#e6e6e6",
                                            padding: 12,
                                            displayColors: true,
                                            boxWidth: 12,
                                            boxHeight: 12,
                                            boxPadding: 4,
                                        },
                                    },
                                }}
                            />
                        </div>
                        <div className="flex gap-3 text-xs text-[#8a8a8a] mt-4 pt-4 border-t border-[#27272a] hover:border-zinc-600 transition-colors duration-200">
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-[#22c55e]" />
                                decay cycles
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-[#60a5fa]" />
                                reflections
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-[#c084fc]" />
                                consolidations
                            </div>
                        </div>
                        <div className="grid grid-cols-5 gap-2 mt-4">
                            <div className="bg-transparent rounded p-2 border border-[#27272a] hover:border-zinc-600 transition-colors duration-200 text-center">
                                <p className="text-xs text-[#8a8a8a] mb-1">Stability</p>
                                <p className="text-lg font-bold text-[#22c55e]">{healthMetrics.decayStability || "0"}%</p>
                            </div>
                            <div className="bg-transparent rounded p-2 border border-[#27272a] hover:border-zinc-600 transition-colors duration-200 text-center">
                                <p className="text-xs text-[#8a8a8a] mb-1">Cycles</p>
                                <p className="text-lg font-bold text-[#f4f4f5]">{maintenanceStats.cycles || 0}</p>
                            </div>
                            <div className="bg-transparent rounded p-2 border border-[#27272a] hover:border-zinc-600 transition-colors duration-200 text-center">
                                <p className="text-xs text-[#8a8a8a] mb-1">Reflect</p>
                                <p className="text-lg font-bold text-[#60a5fa]">{maintenanceStats.reflections || 0}</p>
                            </div>
                            <div className="bg-transparent rounded p-2 border border-[#27272a] hover:border-zinc-600 transition-colors duration-200 text-center">
                                <p className="text-xs text-[#8a8a8a] mb-1">Consol.</p>
                                <p className="text-lg font-bold text-[#c084fc]">{maintenanceStats.consolidations || 0}</p>
                            </div>
                            <div className="bg-transparent rounded p-2 border border-[#27272a] hover:border-zinc-600 transition-colors duration-200 text-center">
                                <p className="text-xs text-[#8a8a8a] mb-1">Efficiency</p>
                                <p className="text-lg font-bold text-[#22c55e]">{maintenanceStats.efficiency || 0}%</p>
                            </div>
                        </div>
                    </div>
                </div>

                { }
                <div className="mb-6 bg-transparent rounded-xl p-6 border border-[#27272a] hover:border-zinc-600 transition-colors duration-200  transition-all duration-300">
                    <h2 className="text-lg font-semibold text-[#f4f4f5] mb-4">System Health</h2>
                    <div className="grid grid-cols-3 gap-6">
                        <div className="space-y-4">
                            <HealthMetric label="Memory Usage" value={systemHealth.memoryUsage || 0} />
                        </div>
                        <div className="space-y-2 text-sm text-[#8a8a8a]">
                            <div className="flex justify-between border-b border-[#27272a] pb-2">
                                <span>Heap Used</span>
                                <span className="text-[#e6e6e6]">{systemHealth.heapUsed || 0} MB</span>
                            </div>
                            <div className="flex justify-between border-b border-[#27272a] pb-2">
                                <span>Heap Total</span>
                                <span className="text-[#e6e6e6]">{systemHealth.heapTotal || 0} MB</span>
                            </div>
                            <div className="flex justify-between border-b border-[#27272a] pb-2">
                                <span>RSS Memory</span>
                                <span className="text-[#e6e6e6]">{systemHealth.rss || 0} MB</span>
                            </div>
                            <div className="flex justify-between border-b border-[#27272a] pb-2">
                                <span>External Memory</span>
                                <span className="text-[#e6e6e6]">{systemHealth.external || 0} MB</span>
                            </div>
                            <div className="flex justify-between border-b border-[#27272a] pb-2">
                                <span>Uptime</span>
                                <span className="text-[#e6e6e6]">{systemHealth.uptimeDays || 0}d {systemHealth.uptimeHours || 0}h</span>
                            </div>
                        </div>
                        <div className="space-y-2 text-sm text-[#8a8a8a]">
                            <div className="flex justify-between border-b border-[#27272a] pb-2">
                                <span>Active Segments</span>
                                <span className="text-[#e6e6e6]">✓ {systemHealth.activeSegments || 0}</span>
                            </div>
                            <div className="flex justify-between border-b border-[#27272a] pb-2">
                                <span>Max Active</span>
                                <span className="text-[#e6e6e6]">{systemHealth.maxActive || 0}</span>
                            </div>
                            <div className="flex justify-between border-b border-[#27272a] pb-2">
                                <span>Node Version</span>
                                <span className="text-[#22c55e]">✓ {backendHealth.process?.version || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between border-b border-[#27272a] pb-2">
                                <span>Platform</span>
                                <span className="text-[#e6e6e6]">{backendHealth.process?.platform || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between border-b border-[#27272a] pb-2">
                                <span>Process ID</span>
                                <span className="text-[#e6e6e6]">{backendHealth.process?.pid || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    { }
                    <div className="bg-transparent rounded-xl p-6 border border-[#27272a] hover:border-zinc-600 transition-colors duration-200  transition-all duration-300">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-[#f4f4f5]">Memory & System Logs</h2>
                            <div className="flex gap-2">
                                <select className="rounded-xl p-2 pl-4 border border-stone-800 bg-stone-950 hover:bg-stone-900/50 hover:text-stone-300 text-sm font-medium text-stone-400 outline-none cursor-pointer transition-colors">
                                    <option className="bg-stone-950">All Levels</option>
                                    <option className="bg-stone-950">Info</option>
                                    <option className="bg-stone-950">Warning</option>
                                    <option className="bg-stone-950">Critical</option>
                                </select>
                            </div>
                        </div>
                        <div className="bg-transparent rounded-lg p-2 mb-2 grid grid-cols-5 gap-2 text-xs font-semibold text-[#8a8a8a] border border-[#27272a] hover:border-zinc-600 transition-colors duration-200">
                            <span>Time</span>
                            <span className="col-span-2">Event</span>
                            <span>Sector</span>
                            <span>Salience</span>
                        </div>
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                            {logs.length > 0 ? logs.map((log, idx) => (
                                <div
                                    key={idx}
                                    className="bg-transparent rounded px-2 py-2 grid grid-cols-5 gap-2 text-xs text-[#9ca3af] hover:bg-transparent border border-transparent transition-colors"
                                >
                                    <span className="text-[#6b7280]">{log.time}</span>
                                    <span className="col-span-2">{log.event}</span>
                                    <span className="text-[#6b7280]">{log.sector}</span>
                                    <span
                                        className={
                                            log.level === "Critical"
                                                ? "text-[#f87171]"
                                                : log.level === "Warning"
                                                    ? "text-[#facc15]"
                                                    : "text-[#9ca3af]"
                                        }
                                    >
                                        {log.salience}
                                    </span>
                                </div>
                            )) : (
                                <div className="text-center text-stone-500 py-8">
                                    No activity logs yet. Start adding memories!
                                </div>
                            )}
                        </div>
                    </div>

                    { }
                    <div className="bg-transparent rounded-xl p-6 border border-[#27272a] hover:border-zinc-600 transition-colors duration-200 transition-all duration-300">
                        <h2 className="text-lg font-semibold text-[#f4f4f5] mb-4">Recent Memory Activity</h2>
                        <div className="space-y-2">
                            {logs.length > 0 ? logs.slice(0, 10).map((log, idx) => (
                                <div
                                    key={idx}
                                    className="bg-transparent rounded p-3 text-sm border border-[#27272a] hover:border-zinc-600 transition-colors duration-200"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[#e6e6e6] font-medium">{log.event}</span>
                                        <span className="text-xs text-[#6b7280]">{log.time}</span>
                                    </div>
                                    <div className="flex gap-3 text-xs text-[#8a8a8a]">
                                        <span>Sector: <span className="text-[#9ca3af]">{log.sector}</span></span>
                                        <span>Salience: <span className={
                                            log.level === "Critical" ? "text-[#f87171]" :
                                                log.level === "Warning" ? "text-[#facc15]" :
                                                    "text-[#9ca3af]"
                                        }>{log.salience}</span></span>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center text-stone-500 py-8">
                                    No recent activity
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

