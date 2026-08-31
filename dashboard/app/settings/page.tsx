/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : dashboard/app/settings/page.tsx
 *  usage : supports the LongMemory dashboard page
 */


"use client"

import { useEffect, useState } from "react"

type RuntimeView = {
    metrics?: {
        enabled: boolean
        uptime_ms: number
        requests: number
        errors: number
        average_duration_ms: number
    }
    limits?: {
        max_payload_size: number
        max_active_requests: number
        rate_limit: { enabled: boolean; window_ms: number; max_requests: number }
    }
    features?: {
        mcp_http: boolean
        telemetry: boolean
        cors: boolean
        embedding_provider: string
    }
}

type Setting = {
    key: string
    label: string
    description: string
    value: string
    secret?: boolean
}

const bytes = (value = 0) => value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MiB` : `${Math.round(value / 1024)} KiB`
const duration = (value = 0) => value >= 86_400_000 ? `${(value / 86_400_000).toFixed(1)} days` : value >= 3_600_000 ? `${(value / 3_600_000).toFixed(1)} hours` : `${Math.round(value / 60_000)} minutes`

export default function SettingsPage() {
    const [runtime, setRuntime] = useState<RuntimeView>({})
    const [environment, setEnvironment] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    const load = async () => {
        setLoading(true)
        setError("")
        try {
            const [runtimeResponse, settingsResponse] = await Promise.all([
                fetch("/api/longmemory/v1/runtime"),
                fetch("/api/settings"),
            ])
            if (!runtimeResponse.ok || !settingsResponse.ok) throw new Error("LongMemory runtime is unavailable")
            const runtimePayload = await runtimeResponse.json()
            const settingsPayload = await settingsResponse.json()
            setRuntime(runtimePayload.data ?? runtimePayload)
            setEnvironment(settingsPayload.settings ?? {})
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { void load() }, [])

    const provider = runtime.features?.embedding_provider ?? "deterministic"
    const settings: Setting[] = [
        { key: "LONGMEMORY_EMBEDDING_PROVIDER", label: "Embedding provider", value: provider, description: "OpenAI-compatible, Gemini, AWS Bedrock, Ollama, local HTTP, Siray, or synthetic." },
        { key: "LONGMEMORY_EMBEDDING_TIER", label: "Embedding tier", value: environment.LONGMEMORY_EMBEDDING_TIER || "configured in backend", description: "fast/hybrid stay local; smart blends local and semantic; deep uses semantic vectors." },
        { key: "LONGMEMORY_EMBEDDING_FALLBACK", label: "Provider fallback", value: environment.LONGMEMORY_EMBEDDING_FALLBACK || "synthetic", description: "Ordered provider chain. Synthetic remains the final local fallback." },
        { key: "LONGMEMORY_MAX_PAYLOAD_SIZE", label: "Maximum payload", value: bytes(runtime.limits?.max_payload_size), description: "Largest accepted JSON request body." },
        { key: "LONGMEMORY_MAX_ACTIVE_REQUESTS", label: "Active requests", value: String(runtime.limits?.max_active_requests ?? 0), description: "Concurrent request backpressure limit." },
        { key: "LONGMEMORY_RATE_LIMIT_ENABLED", label: "Rate limiting", value: runtime.limits?.rate_limit.enabled ? `${runtime.limits.rate_limit.max_requests} / ${duration(runtime.limits.rate_limit.window_ms)}` : "disabled", description: "Fixed-window limit per remote address." },
        { key: "LONGMEMORY_ALLOWED_ORIGINS", label: "CORS", value: runtime.features?.cors ? "enabled" : "same-origin only", description: "Explicit browser origins accepted by the API." },
        { key: "LONGMEMORY_MCP_HTTP", label: "MCP HTTP", value: runtime.features?.mcp_http ? "enabled" : "disabled", description: "Streamable HTTP MCP endpoint at /mcp." },
        { key: "LONGMEMORY_TELEMETRY", label: "Local telemetry", value: runtime.features?.telemetry ? "enabled" : "disabled", description: "In-process request metrics only. No outbound telemetry." },
    ]

    if (loading) return <div className="min-h-screen flex items-center justify-center text-stone-400">Loading runtime configuration...</div>

    return (
        <div className="min-h-screen pb-20 space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-500">Runtime</p>
                    <h1 className="text-2xl font-semibold text-white mt-1">LongMemory Settings</h1>
                    <p className="text-sm text-stone-500 mt-2 max-w-2xl">Configuration is read-only here. Change environment variables in the backend deployment and restart LongMemory.</p>
                </div>
                <button onClick={() => void load()} className="rounded-xl border border-stone-800 px-4 py-2 text-sm text-stone-300 hover:bg-stone-900 transition-colors">Refresh</button>
            </div>

            {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-rose-300">{error}</div>}

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    ["Provider", provider],
                    ["Requests", runtime.metrics?.requests ?? 0],
                    ["Errors", runtime.metrics?.errors ?? 0],
                    ["Uptime", duration(runtime.metrics?.uptime_ms)],
                ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-stone-900 bg-stone-950/60 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">{label}</p>
                        <p className="mt-2 text-lg font-semibold text-stone-100 break-words">{value}</p>
                    </div>
                ))}
            </section>

            <section className="rounded-2xl border border-stone-900 bg-stone-950/30 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Active Configuration</h2>
                        <p className="text-xs text-stone-500 mt-1">Canonical environment names are shown below; archived OM_* aliases remain accepted.</p>
                    </div>
                    <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">Read only</span>
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {settings.map(setting => (
                        <article key={setting.key} className="rounded-xl border border-stone-900 bg-black/30 p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <h3 className="text-sm font-medium text-stone-200">{setting.label}</h3>
                                    <p className="text-xs leading-5 text-stone-500 mt-1">{setting.description}</p>
                                </div>
                                <span className="shrink-0 rounded-md bg-stone-900 px-2 py-1 text-xs text-sky-400 max-w-[45%] truncate">{setting.secret ? "configured" : setting.value}</span>
                            </div>
                            <code className="block mt-3 text-[10px] text-stone-600 break-all">{setting.key}</code>
                        </article>
                    ))}
                </div>
            </section>

            <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                <h2 className="text-sm font-semibold text-amber-300">Hydrograph invariants</h2>
                <p className="text-xs leading-5 text-amber-200/70 mt-2">External embeddings rank candidates only after truth, time, permission, contradiction, confidence, and grounding gates. Recall never reinforces or mutates memory.</p>
            </section>
        </div>
    )
}
