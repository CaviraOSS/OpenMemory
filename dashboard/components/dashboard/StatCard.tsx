interface StatCardProps {
    label: string
    value: any
    unit?: string
    status: string
    statusColor: string
}

export function StatCard({ label, value, unit, status, statusColor }: StatCardProps) {
    return (
        <div className="bg-transparent rounded-lg p-4 border border-[#27272a] hover:border-zinc-600 transition-colors duration-200 transition-all duration-300">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8a8a8a] mb-2">{label}</p>
            <div className="flex items-baseline gap-1">
                <h3 className="text-2xl font-bold text-[#f4f4f5]">{value}</h3>
                {unit && <span className="text-xs text-[#6b7280]">{unit}</span>}
            </div>
            <p className={`text-xs mt-2 ${statusColor}`}>{status}</p>
        </div>
    )
}
