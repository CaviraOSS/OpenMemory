import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { benchmark_defaults } from "./config";
import { aggregate_metrics, latency } from "./metrics";
import type { benchmark_report, category_report, dataset_report, gate_check, provider_name, provider_report, provider_status, run_checkpoint, run_manifest } from "./types";

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
        schema_version: 1,
        run_id,
        generated_at: new Date().toISOString(),
        manifest,
        providers,
        gates: { passed: checks.every((check) => check.passed), checks },
    };
}

const percentage = (value: number): string => `${(value * 100).toFixed(1)}%`;

export function markdown(report: benchmark_report): string {
    const environment = report.manifest.environment;
    const cutoff = primary_cutoff(report.manifest.cutoffs);
    const lines = [
        "# OpenMemory Memory Benchmark",
        "",
        `> Run \`${report.run_id}\` | ${report.generated_at}`,
        "",
        `Benchmark status: **${report.manifest.evaluation_mode.replaceAll("-", " ")}**`,
        "",
        `Datasets: ${report.manifest.datasets.join(", ")} | Cases: ${report.manifest.case_ids.length} | Cutoffs: ${report.manifest.cutoffs.join(", ")}`,
        `Context token budget: ${report.manifest.context_token_budget}`,
        "",
        `Environment: Node ${environment.node_version} | ${environment.platform} ${environment.os_release} (${environment.architecture}) | ${environment.cpu_model} | ${environment.logical_cpus} logical CPUs | ${environment.total_memory_mb} MiB RAM`,
        "",
        "| Provider | Endpoint | Profile | Timeout | Auth configured | Route overrides |",
        "| --- | --- | --- | ---: | --- | --- |",
        ...report.manifest.providers.map((provider) => `| ${provider.name} | ${provider.base_url} | ${provider.profile ?? "default"} | ${provider.timeout_ms ?? "default"} | ${provider.authenticated ? "yes" : "no"} | ${Object.entries(provider.routes).map(([name, path]) => `${name}=${path}`).join("<br>") || "none"} |`),
        "",
        `AI evaluation: ${report.manifest.ai.enabled ? `answerer ${report.manifest.ai.answerer?.provider}:${report.manifest.ai.answerer?.model} | judge ${report.manifest.ai.judge?.provider}:${report.manifest.ai.judge?.model} | fresh answer and judgment at every cutoff` : "disabled (deterministic retrieval only)"}`,
        "",
        "## Scoreboard",
        "",
        `| Provider | Status | Questions | Hit@${cutoff} | Answer@${cutoff} | MRR | Search p50 | Search p95 | Context | MemScore |`,
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ];
    for (const provider of report.providers) {
        const metric = provider.metrics.find((value) => value.k === cutoff) ?? provider.metrics.at(-1);
        const answer_accuracy = provider.answer_accuracy[`top_${cutoff}`];
        const primary_ai = provider.ai_cutoffs[`top_${cutoff}`];
        lines.push(`| ${provider.display_name} | ${provider.status} | ${provider.questions} | ${metric ? percentage(metric.hit_rate) : "-"} | ${answer_accuracy === undefined ? "-" : percentage(answer_accuracy)} | ${metric?.mrr.toFixed(3) ?? "-"} | ${provider.latency.search.p50.toFixed(1)} ms | ${provider.latency.search.p95.toFixed(1)} ms | ${(primary_ai?.tokens.context ?? provider.average_context_tokens).toFixed(1)} tok | ${provider.memscore ?? "-"} |`);
        if (provider.reason) lines.push(`\n> ${provider.display_name}: ${provider.reason}`);
    }
    lines.push("", "## Dataset Breakdown", "", `| Provider | Dataset | Completed | Failed | Retrieval N | Hit@${cutoff} | Answer@${cutoff} | MRR | Recall | nDCG |`, "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (const provider of report.providers) for (const dataset of provider.datasets) {
        const metric = dataset.metrics.find((value) => value.k === cutoff) ?? dataset.metrics.at(-1);
        const retrieval = metric && metric.queries > 0 ? metric : undefined;
        const answer = dataset.answer_accuracy[`top_${cutoff}`];
        lines.push(`| ${provider.display_name} | ${dataset.dataset} | ${dataset.questions} | ${dataset.failed_questions} | ${metric?.queries ?? 0} | ${retrieval ? percentage(retrieval.hit_rate) : "-"} | ${answer === undefined ? "-" : percentage(answer)} | ${retrieval?.mrr.toFixed(3) ?? "-"} | ${retrieval ? percentage(retrieval.recall) : "-"} | ${retrieval?.ndcg.toFixed(3) ?? "-"} |`);
    }
    lines.push("", "## Retrieval by Cutoff", "", "| Provider | K | Queries | Hit@K | Precision | Recall | F1 | MRR | nDCG |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (const provider of report.providers) for (const metric of provider.metrics) {
        lines.push(`| ${provider.display_name} | ${metric.k} | ${metric.queries} | ${percentage(metric.hit_rate)} | ${percentage(metric.precision)} | ${percentage(metric.recall)} | ${percentage(metric.f1)} | ${metric.mrr.toFixed(3)} | ${metric.ndcg.toFixed(3)} |`);
    }
    if (report.manifest.ai.enabled) {
        lines.push("", "## AI Answer Evaluation", "", "| Provider | Cutoff | Accuracy | Answer p50 | Judge p50 | Prompt tokens | Context tokens | Completion tokens |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
        for (const provider of report.providers) for (const cutoff of report.manifest.cutoffs) {
            const value = provider.ai_cutoffs[`top_${cutoff}`];
            lines.push(`| ${provider.display_name} | ${cutoff} | ${value?.questions ? percentage(value.accuracy) : "-"} | ${value?.questions ? value.answer_latency.p50.toFixed(1) : "-"} ms | ${value?.questions ? value.judge_latency.p50.toFixed(1) : "-"} ms | ${value?.questions ? value.tokens.prompt.toFixed(1) : "-"} | ${value?.questions ? value.tokens.context.toFixed(1) : "-"} | ${value?.questions ? value.tokens.completion.toFixed(1) : "-"} |`);
        }
    }
    lines.push("", "## Category Breakdown", "", `| Provider | Category | Questions | Retrieval N | Hit@${cutoff} | Quality@${cutoff} | Abstention | Stale leakage |`, "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (const provider of report.providers) for (const category of provider.categories) {
        const metric = category.metrics.find((value) => value.k === cutoff) ?? category.metrics.at(-1);
        const retrieval = metric && metric.queries > 0 ? metric : undefined;
        const answer = category.answer_accuracy[`top_${cutoff}`];
        lines.push(`| ${provider.display_name} | ${category.category} | ${category.questions} | ${metric?.queries ?? 0} | ${retrieval ? percentage(retrieval.hit_rate) : "-"} | ${answer === undefined ? retrieval ? percentage(retrieval.recall) : "-" : percentage(answer)} | ${category.abstention_accuracy === null ? "-" : percentage(category.abstention_accuracy)} | ${percentage(category.stale_leakage_rate)} |`);
    }
    lines.push("", "Retrieval N excludes no-evidence abstention cases; `-` means no retrieval query was scored.");
    lines.push("Latency aggregates include terminally completed cases only; failed phase durations and errors are disclosed below and in `report.json`.");
    lines.push("", "## Gates", "", "| Provider | Check | Value | Target | Result |", "| --- | --- | ---: | ---: | --- |");
    for (const check of report.gates.checks) lines.push(`| ${check.provider} | ${check.name} | ${round(check.value)} | ${check.comparator === "gte" ? ">=" : "<="} ${check.target} | ${check.passed ? "pass" : "fail"} |`);
    const terminal_phase = report.manifest.ai.enabled ? "judge" : "evaluate";
    const failed = report.providers.flatMap((provider) => provider.cases.filter((item) => item.phases[terminal_phase].status !== "completed").map((item) => ({ provider: provider.display_name, item })));
    const missing = report.providers.flatMap((provider) => {
        const present = new Set(provider.cases.map((item) => item.case_id));
        return report.manifest.case_ids.filter((case_id) => !present.has(case_id)).map((case_id) => ({ provider: provider.display_name, case_id, reason: provider.reason ?? "provider did not start case" }));
    });
    if (failed.length || missing.length) {
        lines.push("", "## Failures", "", "| Provider | Case | Phase | Duration | Error |", "| --- | --- | --- | ---: | --- |");
        for (const failure of failed) {
            const phase = Object.entries(failure.item.phases).find(([, value]) => value.status === "failed");
            const duration = phase?.[1].duration_ms === undefined ? "-" : `${phase[1].duration_ms.toFixed(1)} ms`;
            lines.push(`| ${failure.provider} | ${failure.item.case_id} | ${phase?.[0] ?? "unknown"} | ${duration} | ${phase?.[1].error ?? "unknown error"} |`);
        }
        for (const failure of missing) lines.push(`| ${failure.provider} | ${failure.case_id} | not started | - | ${failure.reason} |`);
    }
    lines.push("", "Per-case phases, matched evidence, raw provider metadata, errors, and token counts are in `report.json`.", "");
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
