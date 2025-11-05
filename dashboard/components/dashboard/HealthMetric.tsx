interface HealthMetricProps {
    label: string
    value: number
}

export function HealthMetric({ label, value }: HealthMetricProps) {
    const barColor = value > 80 ? "#fb923c" : value > 60 ? "#facc15" : "#22c55e"

    return (
        <div className="text-sm">
            <div className="flex justify-between mb-1">
                <span className="text-[#8a8a8a]">{label}</span>
                <span className="text-[#e6e6e6]">{value}%</span>
            </div>
            <div className="w-full bg-transparent rounded-full h-2 border border-[#27272a] hover:border-zinc-600 transition-colors duration-200 flex items-center overflow-hidden relative">
                <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${value}%`, backgroundColor: barColor }}
                />
            </div>
        </div>
    )
}
