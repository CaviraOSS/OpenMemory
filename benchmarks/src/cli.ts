#!/usr/bin/env node

import { resolve } from "node:path";
import { benchmark_defaults, model_config_from_spec, model_provider_names, provider_names } from "./config";
import { download_datasets } from "./datasets/download";
import { write_report } from "./report";
import { run_benchmark } from "./runner.js";
import type { dataset_name, provider_name } from "./types";
import { terminal_ui } from "./ui";

type cli_options = {
    providers: provider_name[];
    datasets: dataset_name[];
    per_category: number;
    sample_offset: number;
    cutoffs: number[];
    run_id: string;
    output_dir: string;
    resume: boolean;
    require_all: boolean;
    gate: boolean;
    color: boolean;
    answerer: string | null;
    judge: string | null;
    retrieval_diagnostic: boolean;
};

const value = (input: string, name: string): string | null => input.startsWith(`--${name}=`) ? input.slice(name.length + 3) : null;
const list = (input: string): string[] => input.split(",").map((item) => item.trim()).filter(Boolean);

function parse(argv: string[]): cli_options {
    const run_id = argv.map((item) => value(item, "run-id")).find((item) => item !== null) ?? new Date().toISOString().replace(/[:.]/g, "-");
    let providers: provider_name[] = ["openmemory"];
    let datasets: dataset_name[] = ["smoke"];
    let per_category = benchmark_defaults.per_category;
    let sample_offset = 0;
    let cutoffs = benchmark_defaults.cutoffs;
    let output_dir = resolve(process.cwd(), "benchmarks", "runs", run_id);
    let resume = true;
    let require_all = false;
    let gate = false;
    let color = true;
    let answerer: string | null = null;
    let judge: string | null = null;
    let retrieval_diagnostic = false;
    for (const item of argv) {
        const providers_value = value(item, "providers");
        const datasets_value = value(item, "datasets");
        const per_category_value = value(item, "per-category");
        const sample_offset_value = value(item, "sample-offset");
        const cutoffs_value = value(item, "cutoffs");
        const output_value = value(item, "out");
        const answerer_value = value(item, "answerer");
        const judge_value = value(item, "judge");
        if (providers_value !== null) {
            const names = list(providers_value);
            const unknown = names.find((name) => !provider_names.includes(name as provider_name));
            if (unknown) throw new Error(`unknown provider: ${unknown}`);
            providers = names as provider_name[];
        } else if (datasets_value !== null) {
            const names = list(datasets_value);
            const unknown = names.find((name) => !["smoke", "longmemeval", "locomo"].includes(name));
            if (unknown) throw new Error(`unknown dataset: ${unknown}`);
            datasets = names as dataset_name[];
        } else if (per_category_value !== null) per_category = Number(per_category_value);
        else if (sample_offset_value !== null) sample_offset = Number(sample_offset_value);
        else if (cutoffs_value !== null) cutoffs = list(cutoffs_value).map(Number);
        else if (output_value !== null) output_dir = resolve(output_value);
        else if (answerer_value !== null) answerer = answerer_value;
        else if (judge_value !== null) judge = judge_value;
        else if (item === "--no-resume") resume = false;
        else if (item === "--require-all") require_all = true;
        else if (item === "--gate") gate = true;
        else if (item === "--no-color") color = false;
        else if (item === "--retrieval-diagnostic") retrieval_diagnostic = true;
        else if (!item.startsWith("--run-id=")) throw new Error(`unknown flag: ${item}`);
    }
    if (!providers.length || !datasets.length) throw new Error("at least one provider and dataset are required");
    if (!Number.isInteger(per_category) || per_category < 1) throw new Error("--per-category must be a positive integer");
    if (!Number.isInteger(sample_offset) || sample_offset < 0) throw new Error("--sample-offset must be a non-negative integer");
    if (Boolean(answerer) !== Boolean(judge)) throw new Error("--answerer and --judge must be supplied together");
    return { providers, datasets, per_category, sample_offset, cutoffs, run_id, output_dir, resume, require_all, gate, color, answerer, judge, retrieval_diagnostic };
}

async function main(): Promise<void> {
    const [command = "run", ...argv] = process.argv.slice(2);
    if (command === "help" || command === "--help" || command === "-h") {
        console.log(`
openmemory bench

commands:
    run        execute a benchmark run
    data       download official datasets
    providers  list provider names
    models     list answerer/judge model providers

run flags:
    --providers=<list>     openmemory,supermemory,mem0,graphiti,cognee
    --datasets=<list>      smoke,longmemeval,locomo
    --per-category=<n>     official cases retained per category
    --sample-offset=<n>    skip n cases per category for deterministic holdouts
    --cutoffs=<list>       retrieval cutoffs, default 1,5,10,20
    --run-id=<id>          checkpoint identity
    --out=<directory>      artifact directory
    --answerer=<p:model>   generate an answer at every cutoff
    --judge=<p:model>      judge every generated answer
    --retrieval-diagnostic allow official data without AI for non-publishable tuning
    --no-resume            replace an existing checkpoint
    --require-all          fail unless every provider completes
    --gate                 apply quality gates
    --no-color             disable ansi colors
`);
        return;
    }
    if (command === "data") {
        console.log("\ndownloading benchmark datasets\n");
        await download_datasets();
        return;
    }
    if (command === "providers") {
        console.log(provider_names.join("\n"));
        return;
    }
    if (command === "models") {
        console.log(model_provider_names.join("\n"));
        return;
    }
    if (command !== "run") throw new Error(`unknown command: ${command}`);
    const options = parse(argv);
    const ui = new terminal_ui(options.color);
    ui.header(options.run_id, options.providers, options.datasets, options.answerer && options.judge ? `${options.answerer} -> ${options.judge}` : null);
    const result = await run_benchmark({
        providers: options.providers,
        datasets: options.datasets,
        per_category: options.per_category,
        sample_offset: options.sample_offset,
        cutoffs: options.cutoffs,
        run_id: options.run_id,
        output_dir: options.output_dir,
        resume: options.resume,
        answerer_config: options.answerer ? model_config_from_spec(options.answerer) : undefined,
        judge_config: options.judge ? model_config_from_spec(options.judge) : undefined,
        retrieval_diagnostic: options.retrieval_diagnostic,
        on_progress: (progress) => ui.progress(progress.provider, progress.index, progress.total, progress.case_id),
    });
    const paths = write_report(result.report, result.output_dir);
    ui.report(result.report);
    console.log(`  json     ${paths.json}`);
    console.log(`  markdown ${paths.markdown}\n`);
    const unavailable = result.report.providers.some((provider) => provider.status !== "completed");
    if ((options.require_all && unavailable) || (options.gate && !result.report.gates.passed)) process.exitCode = 1;
}

main().catch((error) => {
    console.error(`\nbenchmark failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
});
