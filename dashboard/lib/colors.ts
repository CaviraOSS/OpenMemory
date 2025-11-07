export function getStatusColor(status: string): string {
    switch (status) {
        case "Improving":
            return "text-[#a3e635]"
        case "High":
            return "text-[#facc15]"
        case "Stable":
            return "text-[#22c55e]"
        case "Critical":
            return "text-[#f87171]"
        default:
            return "text-[#8a8a8a]"
    }
}

export const sectorColors = {
    semantic: "rgba(248, 113, 113, 0.7)",
    episodic: "rgba(251, 191, 36, 0.7)",
    procedural: "rgba(52, 211, 153, 0.7)",
    emotional: "rgba(96, 165, 250, 0.7)",
    reflective: "rgba(192, 132, 252, 0.7)",
}
