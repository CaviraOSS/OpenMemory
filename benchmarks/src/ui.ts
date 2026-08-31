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
 *  file  : benchmarks/src/ui.ts
 *  usage : supports LongMemory benchmark ui
 */


import type { benchmark_report, provider_name, scorecard_metric } from "./types";

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
        console.log(this.paint("longmemory bench", "bold"));
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
        const format = (metric: scorecard_metric): string => {
            if (metric.value === null) return `N/A (${metric.reason ?? "not measured"})`;
            if (metric.unit === "ratio") return `${(metric.value * 100).toFixed(1)}%`;
            if (metric.unit === "milliseconds") return `${metric.value.toFixed(1)} ms`;
            if (metric.unit === "tokens") return metric.value.toFixed(1);
            return `$${metric.value < 0.0001 ? metric.value.toExponential(3) : metric.value.toFixed(6)}`;
        };
        const section = (title: string, rows: Array<[string, scorecard_metric]>) => {
            console.log(this.paint(title, "bold"));
            for (const [label, metric] of rows) console.log(`  ${label.padEnd(30)} ${format(metric)}`);
            console.log("");
        };
        const card = report.scorecard;
        console.log("");
        section("memory quality", [["LongMemEval", card.memory_quality.longmemeval], ["LoCoMo", card.memory_quality.locomo], ["BEAM-1M", card.memory_quality.beam_1m], ["BEAM-10M", card.memory_quality.beam_10m]]);
        section("retrieval", [["context recall", card.retrieval.context_recall], ["context precision", card.retrieval.context_precision], ["evidence completeness", card.retrieval.evidence_completeness]]);
        section("temporal memory", [["current-fact accuracy", card.temporal_memory.current_fact_accuracy], ["historical-fact accuracy", card.temporal_memory.historical_fact_accuracy], ["update accuracy", card.temporal_memory.update_accuracy], ["event-order accuracy", card.temporal_memory.event_order_accuracy]]);
        section("reliability", [["abstention accuracy", card.reliability.abstention_accuracy], ["contradiction resolution", card.reliability.contradiction_resolution]]);
        section("efficiency", [["p50 retrieval", card.efficiency.p50_retrieval], ["p95 retrieval", card.efficiency.p95_retrieval], ["mean tokens retrieved", card.efficiency.mean_tokens_retrieved], ["write cost / 1K input tokens", card.efficiency.write_cost_per_1k_input_tokens], ["read cost / query", card.efficiency.read_cost_per_query]]);
        console.log(report.gates.passed ? this.paint("  gates: pass", "green") : this.paint("  gates: fail", "red"));
    }
}
