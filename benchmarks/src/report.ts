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
 *  file  : benchmarks/src/report.ts
 *  usage : supports LongMemory benchmark report
 */


import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { benchmark_defaults } from "./config";
import { aggregate_metrics, latency } from "./metrics";
import { build_longmemory_scorecard } from "./scorecard";
import type { benchmark_report, category_report, dataset_report, gate_check, provider_name, provider_report, provider_status, run_checkpoint, run_manifest, scorecard_metric } from "./types";

export type provider_outcome = {
    name: provider_name;
    display_name: string;
    status: provider_status;
    reason?: string;
};

const round = (value: number, places = 3): number => Number(value.toFixed(places));
const primary_cutoff = (cutoffs: number[]): number => cutoffs.includes(5) ? 5 : Math.max(...cutoffs);

export function build_report(run_id: string, manifest: run_manifest, checkpoint: run_checkpoint, outcomes: provider_outcome[]): benchmark_report {
    const providers = outcomes.map((outcome): provider_report => {
        const cases = Object.values(checkpoint.providers[outcome.name] ?? {});
        const terminal_phase = manifest.ai.enabled ? "judge" : "evaluate";
        const completed = cases.filter((item) => item.phases[terminal_phase].status === "completed" && item.metrics);
        const failed = cases.filter((item) => item.phases[terminal_phase].status !== "completed");
        const failed_questions = manifest.case_ids.length - completed.length;
        const metrics = aggregate_metrics(completed, manifest.cutoffs);
        const answer_accuracy_for = (values: typeof completed): Record<string, number> => Object.fromEntries(manifest.cutoffs.flatMap((cutoff) => {
            const judged = values.flatMap((item) => {
                const value = item.cutoff_results?.[`top_${cutoff}`]?.score;
                return value === undefined ? [] : [value];
            });
            return judged.length ? [[`top_${cutoff}`, judged.reduce((sum, value) => sum + value, 0) / judged.length] as const] : [];
        }));
        const answer_accuracy = manifest.ai.enabled ? answer_accuracy_for(completed) : {};
        const ai_cutoffs = manifest.ai.enabled ? Object.fromEntries(manifest.cutoffs.map((cutoff) => {
            const label = `top_${cutoff}`;
            const values = completed.flatMap((item) => item.cutoff_results?.[label] ?? []);
            const average = (key: "prompt_tokens" | "base_prompt_tokens" | "context_tokens" | "completion_tokens"): number => values.length
                ? values.reduce((sum, value) => sum + (value[key] ?? 0), 0) / values.length
                : 0;
            return [label, {
                k: cutoff,
                questions: values.length,
                accuracy: answer_accuracy[label] ?? 0,
                answer_latency: latency(values.map((value) => value.answer_duration_ms)),
                judge_latency: latency(values.flatMap((value) => value.judge_duration_ms ?? [])),
                tokens: {
                    prompt: round(average("prompt_tokens"), 1),
                    base_prompt: round(average("base_prompt_tokens"), 1),
                    context: round(average("context_tokens"), 1),
                    completion: round(average("completion_tokens"), 1),
                },
            }];
        })) : {};
        const categories = [...new Set(completed.map((item) => item.category))].sort().map((category): category_report => {
            const values = completed.filter((item) => item.category === category);
            const abstentions = values.filter((item) => item.abstention_correct !== null && item.abstention_correct !== undefined);
            return {
                category,
                questions: values.length,
                metrics: aggregate_metrics(values, manifest.cutoffs),
                abstention_accuracy: abstentions.length ? abstentions.filter((item) => item.abstention_correct).length / abstentions.length : null,
                stale_leakage_rate: values.length ? values.filter((item) => item.stale_leakage).length / values.length : 0,
                answer_accuracy: manifest.ai.enabled ? answer_accuracy_for(values) : {},
            };
        });
        const datasets = manifest.datasets.map((dataset): dataset_report => {
            const values = completed.filter((item) => item.dataset === dataset);
            const expected = Object.values(manifest.case_datasets).filter((value) => value === dataset).length;
            return {
                dataset,
                questions: values.length,
                failed_questions: expected - values.length,
                metrics: aggregate_metrics(values, manifest.cutoffs),
                answer_accuracy: manifest.ai.enabled ? answer_accuracy_for(values) : {},
            };
        }).filter((dataset) => dataset.questions > 0 || dataset.failed_questions > 0);
        const durations = (name: "ingest" | "indexing" | "search" | "answer" | "judge"): number[] => {
            if (name === "answer") return completed.flatMap((item) => Object.values(item.cutoff_results ?? {}).map((value) => value.answer_duration_ms));
            if (name === "judge") return completed.flatMap((item) => Object.values(item.cutoff_results ?? {}).flatMap((value) => value.judge_duration_ms ?? []));
            if (name === "ingest" || name === "indexing") return completed.filter((item) => !item.ingest_reused).flatMap((item) => item.phases[name].duration_ms ?? []);
            return completed.flatMap((item) => item.phases[name].duration_ms ?? []);
        };
        const totals = completed.map((item) => ["ingest", "indexing", "search", "evaluate", ...(manifest.ai.enabled ? ["answer", "judge"] : [])].reduce(
            (sum, name) => sum + (item.phases[name as keyof typeof item.phases].duration_ms ?? 0),
            0,
        ));
        const average_tokens = completed.length ? completed.reduce((sum, item) => sum + (item.context_tokens ?? 0), 0) / completed.length : 0;
        const quality_cutoff = primary_cutoff(manifest.cutoffs);
        const quality_metric = metrics.find((metric) => metric.k === quality_cutoff) ?? metrics.at(-1);
        const search_latency = latency(durations("search"));
        const abstentions = completed.filter((item) => item.abstention_correct !== null && item.abstention_correct !== undefined);
        const primary_ai = ai_cutoffs[`top_${quality_cutoff}`];
        const primary_quality = manifest.ai.enabled ? answer_accuracy[`top_${quality_cutoff}`] ?? 0 : quality_metric?.hit_rate ?? 0;
        return {
            name: outcome.name,
            display_name: outcome.display_name,
            status: outcome.status,
            ...(outcome.reason ? { reason: outcome.reason } : {}),
            questions: completed.length,
            failed_questions,
            metrics,
            datasets,
            categories,
            latency: {
                ingest: latency(durations("ingest")),
                indexing: latency(durations("indexing")),
                search: search_latency,
                answer: latency(durations("answer")),
                judge: latency(durations("judge")),
                total: latency(totals),
            },
            average_context_tokens: round(average_tokens, 1),
            stale_leakage_rate: completed.length ? completed.filter((item) => item.stale_leakage).length / completed.length : 0,
            abstention_accuracy: abstentions.length ? abstentions.filter((item) => item.abstention_correct).length / abstentions.length : null,
            memscore: completed.length && quality_metric ? `${round(primary_quality * 100, 1)}% / ${round(search_latency.mean, 1)}ms / ${round(manifest.ai.enabled ? primary_ai?.tokens.context ?? 0 : average_tokens, 1)}tok` : null,
            answer_accuracy,
            ai_cutoffs,
            cases,
        };
    });

    const checks: gate_check[] = [];
    for (const provider of providers) {
        const at_five = provider.metrics.find((metric) => metric.k === 5) ?? provider.metrics.at(-1);
        checks.push(
            { provider: provider.name, name: "provider completed", value: provider.status === "completed" ? 1 : 0, comparator: "gte", target: 1, passed: provider.status === "completed" },
            { provider: provider.name, name: "stale leakage", value: provider.stale_leakage_rate, comparator: "lte", target: benchmark_defaults.gates.stale_leakage_max, passed: provider.stale_leakage_rate <= benchmark_defaults.gates.stale_leakage_max },
            { provider: provider.name, name: "failed questions", value: provider.failed_questions, comparator: "lte", target: benchmark_defaults.gates.failed_questions_max, passed: provider.failed_questions <= benchmark_defaults.gates.failed_questions_max },
        );
        if (manifest.evaluation_mode !== "official") {
            checks.push({ provider: provider.name, name: "hit@5", value: at_five?.hit_rate ?? 0, comparator: "gte", target: benchmark_defaults.gates.hit_at_5_min, passed: (at_five?.hit_rate ?? 0) >= benchmark_defaults.gates.hit_at_5_min });
        }
        if (manifest.ai.enabled) {
            const primary = provider.answer_accuracy[`top_${primary_cutoff(manifest.cutoffs)}`] ?? 0;
            checks.push({ provider: provider.name, name: "answer accuracy", value: primary, comparator: "gte", target: benchmark_defaults.gates.answer_accuracy_min, passed: primary >= benchmark_defaults.gates.answer_accuracy_min });
        }
    }
    return {
        schema_version: 2,
        run_id,
        generated_at: new Date().toISOString(),
        manifest,
        providers,
        scorecard: build_longmemory_scorecard(manifest, providers.find((provider) => provider.name === "longmemory")),
        gates: { passed: checks.every((check) => check.passed), checks },
    };
}

const percentage = (value: number): string => `${(value * 100).toFixed(1)}%`;
const score = (metric: scorecard_metric): string => {
    if (metric.value === null) return `N/A — ${metric.reason ?? "not measured"}`;
    if (metric.unit === "ratio") return percentage(metric.value);
    if (metric.unit === "milliseconds") return `${metric.value.toFixed(1)} ms`;
    if (metric.unit === "tokens") return metric.value.toFixed(1);
    return `$${metric.value < 0.0001 ? metric.value.toExponential(3) : metric.value.toFixed(6)}`;
};

export function markdown(report: benchmark_report): string {
    const environment = report.manifest.environment;
    const card = report.scorecard;
    const provider = report.providers.find((item) => item.name === "longmemory");
    const lines = [
        "# LongMemory Benchmark Scorecard",
        "",
        `> Run \`${report.run_id}\` | ${report.generated_at}`,
        "",
        `Status: **${provider?.status ?? "failed"}** | Evaluation: **${report.manifest.evaluation_mode.replaceAll("-", " ")}** | Primary cutoff: **K=${card.cutoff}**`,
        "",
        "### Memory Quality",
        "",
        `**LongMemEval:** ${score(card.memory_quality.longmemeval)}`,
        "",
        `**LoCoMo:** ${score(card.memory_quality.locomo)}`,
        "",
        `**BEAM-1M:** ${score(card.memory_quality.beam_1m)}`,
        "",
        `**BEAM-10M:** ${score(card.memory_quality.beam_10m)}`,
        "",
        "### Retrieval",
        "",
        `**Context recall:** ${score(card.retrieval.context_recall)}`,
        "",
        `**Context precision:** ${score(card.retrieval.context_precision)}`,
        "",
        `**Evidence completeness:** ${score(card.retrieval.evidence_completeness)}`,
        "",
        "### Temporal memory",
        "",
        `**Current-fact accuracy:** ${score(card.temporal_memory.current_fact_accuracy)}`,
        "",
        `**Historical-fact accuracy:** ${score(card.temporal_memory.historical_fact_accuracy)}`,
        "",
        `**Update accuracy:** ${score(card.temporal_memory.update_accuracy)}`,
        "",
        `**Event-order accuracy:** ${score(card.temporal_memory.event_order_accuracy)}`,
        "",
        "### Reliability",
        "",
        `**Abstention accuracy:** ${score(card.reliability.abstention_accuracy)}`,
        "",
        `**Contradiction resolution:** ${score(card.reliability.contradiction_resolution)}`,
        "",
        "### Efficiency",
        "",
        `**p50 retrieval:** ${score(card.efficiency.p50_retrieval)}`,
        "",
        `**p95 retrieval:** ${score(card.efficiency.p95_retrieval)}`,
        "",
        `**mean tokens retrieved:** ${score(card.efficiency.mean_tokens_retrieved)}`,
        "",
        `**write cost / 1K input tokens:** ${score(card.efficiency.write_cost_per_1k_input_tokens)}`,
        "",
        `**read cost / query:** ${score(card.efficiency.read_cost_per_query)}`,
        "",
        "## Coverage",
        "",
        "| Dataset | Completed | Failed |",
        "| --- | ---: | ---: |",
        ...(provider?.datasets.map((dataset) => `| ${dataset.dataset} | ${dataset.questions} | ${dataset.failed_questions} |`) ?? []),
        "",
        "## Methodology",
        "",
        `- LongMemory only; ${report.manifest.case_ids.length} selected questions; evidence metrics use K=${card.cutoff}.`,
        `- Context budget: ${report.manifest.context_token_budget} tokens. Retrieval values are macro-averaged over evidence-bearing questions.`,
        `- Answerer: ${report.manifest.ai.answerer ? `${report.manifest.ai.answerer.provider}:${report.manifest.ai.answerer.model}` : "disabled"}.`,
        `- Judge: ${report.manifest.ai.judge ? `${report.manifest.ai.judge.provider}:${report.manifest.ai.judge.model}` : "disabled"}.`,
        `- Embeddings: ${report.manifest.longmemory_embedding ? `${report.manifest.longmemory_embedding.provider}:${report.manifest.longmemory_embedding.model}, ${report.manifest.longmemory_embedding.dimension}d, tier ${report.manifest.longmemory_embedding.tier}` : "none"}.`,
        `- Environment: Node ${environment.node_version}; ${environment.platform} ${environment.os_release} (${environment.architecture}); ${environment.cpu_model}; ${environment.logical_cpus} logical CPUs; ${environment.total_memory_mb} MiB RAM.`,
        "- BEAM and historical-fact values stay N/A until dedicated datasets are implemented. Dollar values are embedding list-price estimates and stay N/A without an explicit price.",
    ];
    const terminal_phase = report.manifest.ai.enabled ? "judge" : "evaluate";
    const failed = report.providers.flatMap((provider) => provider.cases.filter((item) => item.phases[terminal_phase].status !== "completed").map((item) => ({ provider: provider.display_name, item })));
    const missing = report.providers.flatMap((provider) => {
        const present = new Set(provider.cases.map((item) => item.case_id));
        return report.manifest.case_ids.filter((case_id) => !present.has(case_id)).map((case_id) => ({ provider: provider.display_name, case_id, reason: provider.reason ?? "provider did not start case" }));
    });
    if (failed.length || missing.length) {
        lines.push("", "## Failures", "", "| Case | Phase | Duration | Error |", "| --- | --- | ---: | --- |");
        for (const failure of failed) {
            const phase = Object.entries(failure.item.phases).find(([, value]) => value.status === "failed");
            const duration = phase?.[1].duration_ms === undefined ? "-" : `${phase[1].duration_ms.toFixed(1)} ms`;
            lines.push(`| ${failure.item.case_id} | ${phase?.[0] ?? "unknown"} | ${duration} | ${phase?.[1].error ?? "unknown error"} |`);
        }
        for (const failure of missing) lines.push(`| ${failure.case_id} | not started | - | ${failure.reason} |`);
    }
    lines.push("", "Per-case phases, cutoff metrics, matched evidence, raw metadata, and token counts remain in `report.json`.", "");
    return lines.join("\n");
}

export function write_report(report: benchmark_report, output_dir: string): { json: string; markdown: string } {
    const directory = resolve(output_dir);
    mkdirSync(directory, { recursive: true });
    const json = resolve(directory, "report.json");
    const markdown_path = resolve(directory, "report.md");
    writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    writeFileSync(markdown_path, markdown(report), "utf8");
    return { json, markdown: markdown_path };
}
