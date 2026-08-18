import type { benchmark_report, provider_name } from "./types";

const ansi = {
    reset: "\u001b[0m",
    bold: "\u001b[1m",
    dim: "\u001b[2m",
    green: "\u001b[32m",
    red: "\u001b[31m",
    yellow: "\u001b[33m",
    cyan: "\u001b[36m",
};

export class terminal_ui {
    private readonly color: boolean;

    constructor(color = process.stdout.isTTY && !process.env.NO_COLOR) {
        this.color = color;
    }

    private paint(value: string, color: keyof typeof ansi): string {
        return this.color ? `${ansi[color]}${value}${ansi.reset}` : value;
    }

    header(run_id: string, providers: provider_name[], datasets: string[], ai: string | null = null): void {
        console.log("");
        console.log(this.paint("openmemory bench", "bold"));
        console.log(this.paint("memory-system evaluation", "dim"));
        console.log("");
        console.log(`  run       ${run_id}`);
        console.log(`  providers ${providers.join(", ")}`);
        console.log(`  datasets  ${datasets.join(", ")}`);
        console.log(`  ai mode   ${ai ?? "retrieval only"}`);
        console.log("");
    }

    progress(provider: provider_name, index: number, total: number, case_id: string): void {
        const count = `${String(index).padStart(String(total).length)}/${total}`;
        console.log(`  ${this.paint(provider.padEnd(12), "cyan")} ${count}  ${case_id}`);
    }

    report(report: benchmark_report): void {
        const rows = report.providers.map((provider) => {
            const metric = provider.metrics.find((value) => value.k === 5) ?? provider.metrics.at(-1);
            return [
                provider.display_name,
                provider.status,
                String(provider.questions),
                metric ? `${(metric.hit_rate * 100).toFixed(1)}%` : "-",
                provider.answer_accuracy[`top_${report.manifest.cutoffs.includes(5) ? 5 : Math.max(...report.manifest.cutoffs)}`] !== undefined ? `${(provider.answer_accuracy[`top_${report.manifest.cutoffs.includes(5) ? 5 : Math.max(...report.manifest.cutoffs)}`] * 100).toFixed(1)}%` : "-",
                `${provider.latency.search.p50.toFixed(1)} ms`,
                `${provider.latency.search.p95.toFixed(1)} ms`,
                `${(provider.ai_cutoffs[`top_${report.manifest.cutoffs.includes(5) ? 5 : Math.max(...report.manifest.cutoffs)}`]?.tokens.context ?? provider.average_context_tokens).toFixed(1)} tok`,
                provider.memscore ?? "-",
            ];
        });
        const headers = ["provider", "status", "questions", "hit@5", "answer", "p50", "p95", "context", "memscore"];
        const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => row[index].length)));
        const line = (row: string[]): string => `  ${row.map((value, index) => value.padEnd(widths[index])).join("  ")}`;
        console.log("");
        console.log(this.paint("scoreboard", "bold"));
        console.log(line(headers));
        console.log(`  ${widths.map((width) => "-".repeat(width)).join("  ")}`);
        for (const row of rows) {
            const status = row[1];
            const rendered = row.map((value, index) => {
                const padded = value.padEnd(widths[index]);
                return index === 1 ? this.paint(padded, status === "completed" ? "green" : status === "unavailable" ? "yellow" : "red") : padded;
            });
            console.log(`  ${rendered.join("  ")}`);
        }
        console.log("");
        console.log(report.gates.passed ? this.paint("  gates: pass", "green") : this.paint("  gates: fail", "red"));
    }
}
