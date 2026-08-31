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
 *  file  : benchmarks/src/runner.ts
 *  usage : supports LongMemory benchmark runner
 */


import { mkdirSync } from "node:fs";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { basename, resolve } from "node:path";
import { create_judge } from "./ai/judge";
import { create_language_model } from "./ai/model";
import { build_answer_prompt } from "./ai/prompts";
import { complete_phase, fail_phase, load_checkpoint, new_case, save_checkpoint, start_phase } from "./checkpoint";
import { benchmark_defaults, provider_config_from_env } from "./config";
import { load_datasets as load_benchmark_datasets } from "./datasets";
import { count_tokens, match_hits, score_at_k } from "./metrics";
import { create_provider } from "./providers";
import { build_report, type provider_outcome } from "./report";
import { load_embedding_environment } from "../../src/core/embeddings/environment.js";
import type { ai_judge, benchmark_case, benchmark_provider, benchmark_report, dataset_load, dataset_name, language_model, model_config, provider_config, provider_name, run_manifest, search_hit } from "./types";

export type run_options = {
    providers: provider_name[];
    datasets: dataset_name[];
    configs?: Partial<Record<provider_name, provider_config>>;
    per_category?: number;
    sample_offset?: number;
    cutoffs?: number[];
    run_id?: string;
    output_dir?: string;
    resume?: boolean;
    make_provider?: (name: provider_name) => benchmark_provider;
    answerer_config?: model_config;
    judge_config?: model_config;
    retrieval_diagnostic?: boolean;
    make_model?: (config: model_config, role: "answerer" | "judge") => language_model;
    make_judge?: (model: language_model) => ai_judge;
    load_datasets?: (names: dataset_name[], per_category: number, sample_offset: number) => dataset_load[];
    on_progress?: (value: { provider: provider_name; case_id: string; index: number; total: number }) => void;
};

export type run_result = {
    report: benchmark_report;
    output_dir: string;
};

const elapsed = async <value>(operation: () => Promise<value>): Promise<{ value: value; duration_ms: number }> => {
    const started = performance.now();
    const value = await operation();
    return { value, duration_ms: performance.now() - started };
};

const fit_context = (hits: search_hit[], budget: number): search_hit[] => {
    const selected: search_hit[] = [];
    let remaining = budget;
    for (const hit of hits) {
        const cost = count_tokens(hit.text);
        if (cost <= remaining) {
            selected.push(hit);
            remaining -= cost;
            continue;
        }
        if (!selected.length && remaining > 0) selected.push({ ...hit, text: hit.text.slice(0, remaining * 4) });
        break;
    }
    return selected;
};

const make_manifest = (
    options: run_options,
    cases: benchmark_case[],
    cutoffs: number[],
    configs: Record<provider_name, provider_config>,
): run_manifest => {
    const cpu_list = cpus();
    const embedding = load_embedding_environment();
    const embedding_model = embedding ? ({
        openai: embedding.openai_model,
        gemini: embedding.gemini_model,
        ollama: embedding.ollama_model,
        aws: embedding.aws_model,
        siray: embedding.siray_model,
        local: embedding.local_model,
        synthetic: "deterministic-hash",
    } as Record<string, string>)[embedding.provider] : null;
    const configured_embedding_price = process.env.BENCH_EMBEDDING_INPUT_COST_PER_MILLION_USD;
    const embedding_price = configured_embedding_price === undefined || configured_embedding_price.trim() === "" ? null : Number(configured_embedding_price);
    if (embedding_price !== null && (!Number.isFinite(embedding_price) || embedding_price < 0)) throw new Error("BENCH_EMBEDDING_INPUT_COST_PER_MILLION_USD must be a non-negative number");
    return {
        version: 1,
        official: cases.every((item) => item.dataset !== "smoke"),
        evaluation_mode: cases.every((item) => item.dataset !== "smoke")
            ? options.answerer_config && options.judge_config ? "official" : "retrieval-diagnostic"
            : "smoke-diagnostic",
        environment: {
            node_version: process.version,
            platform: platform(),
            os_release: release(),
            architecture: arch(),
            cpu_model: cpu_list[0]?.model.trim() ?? "unknown",
            logical_cpus: cpu_list.length,
            total_memory_mb: Math.round(totalmem() / 1_048_576),
        },
        providers: options.providers.map((name) => {
            const config = configs[name];
            return {
                name,
                base_url: config.base_url,
                timeout_ms: config.timeout_ms ?? null,
                profile: config.profile ?? null,
                routes: config.routes ?? {},
                authenticated: Boolean(config.api_key),
                header_names: Object.keys(config.headers ?? {}).map((header) => header.toLowerCase()).sort(),
            };
        }),
        datasets: options.datasets,
        case_ids: cases.map((item) => item.id).sort(),
        case_datasets: Object.fromEntries(cases.map((item) => [item.id, item.dataset]).sort(([left], [right]) => left.localeCompare(right))),
        cutoffs,
        per_category: options.per_category ?? benchmark_defaults.per_category,
        sample_offset: options.sample_offset ?? 0,
        matching: { version: 2, lexical_threshold: benchmark_defaults.lexical_threshold, opaque_source_ref_first: true, source_id_first: false },
        context_token_budget: benchmark_defaults.context_token_budget,
        longmemory_embedding: embedding ? {
            provider: embedding.provider,
            model: embedding_model ?? "unknown",
            tier: embedding.tier,
            dimension: embedding.dimension,
            fallback: embedding.fallback,
            batch_size: configs.longmemory?.embedding_batch_size ?? (embedding.provider === "ollama" ? 128 : embedding.provider === "gemini" ? 100 : 16),
            inputs_per_minute: embedding.provider === "gemini" ? embedding.gemini_inputs_per_minute : 0,
            input_cost_per_million_usd: embedding_price,
        } : null,
        ai: {
            enabled: Boolean(options.answerer_config && options.judge_config),
            answerer: options.answerer_config ? {
                provider: options.answerer_config.provider,
                model: options.answerer_config.model,
                base_url: options.answerer_config.base_url ?? null,
                timeout_ms: options.answerer_config.timeout_ms,
                max_retries: options.answerer_config.max_retries,
                max_tokens: options.answerer_config.max_tokens,
                temperature: options.answerer_config.temperature,
                command: options.answerer_config.command ? basename(options.answerer_config.command) : null,
            } : null,
            judge: options.judge_config ? {
                provider: options.judge_config.provider,
                model: options.judge_config.model,
                base_url: options.judge_config.base_url ?? null,
                timeout_ms: options.judge_config.timeout_ms,
                max_retries: options.judge_config.max_retries,
                max_tokens: options.judge_config.max_tokens,
                temperature: options.judge_config.temperature,
                command: options.judge_config.command ? basename(options.judge_config.command) : null,
            } : null,
            per_cutoff: true,
        },
    };
};

export async function run_benchmark(options: run_options): Promise<run_result> {
    if (Boolean(options.answerer_config) !== Boolean(options.judge_config)) throw new Error("answerer and judge must be configured together");
    if (options.retrieval_diagnostic && (options.answerer_config || options.judge_config)) throw new Error("retrieval diagnostic mode cannot use answerer or judge models");
    const official_requested = options.datasets.some((dataset) => dataset !== "smoke");
    if (official_requested && (!options.answerer_config || !options.judge_config) && !options.retrieval_diagnostic) {
        throw new Error("official LongMemEval/LoCoMo runs require --answerer and --judge; use --retrieval-diagnostic only for non-publishable tuning");
    }
    if (official_requested && options.answerer_config && options.judge_config && options.answerer_config.provider === options.judge_config.provider && options.answerer_config.model === options.judge_config.model) {
        throw new Error("official runs require distinct answerer and judge model specs to reduce correlated evaluation bias");
    }
    if (official_requested && options.providers.includes("longmemory")) {
        const embedding = load_embedding_environment();
        if (!embedding || embedding.provider === "synthetic" || embedding.tier === "fast" || embedding.tier === "hybrid") {
            throw new Error("official LongMemory runs require a semantic embedding profile via LONGMEMORY_EMBEDDING_PROVIDER with tier=deep or smart");
        }
    }
    const run_id = options.run_id ?? new Date().toISOString().replace(/[:.]/g, "-");
    const output_dir = resolve(options.output_dir ?? resolve(process.cwd(), "benchmarks", "runs", run_id));
    mkdirSync(output_dir, { recursive: true });
    const cutoffs = [...new Set(options.cutoffs ?? benchmark_defaults.cutoffs)].filter((value) => Number.isInteger(value) && value > 0).sort((left, right) => left - right);
    if (!cutoffs.length) throw new Error("at least one positive cutoff is required");
    const loads = (options.load_datasets ?? load_benchmark_datasets)(options.datasets, options.per_category ?? benchmark_defaults.per_category, options.sample_offset ?? 0);
    const dataset_order = new Map(options.datasets.map((dataset, index) => [dataset, index]));
    const cases = loads.flatMap((load) => load.cases).sort((left, right) => (dataset_order.get(left.dataset) ?? Number.MAX_SAFE_INTEGER) - (dataset_order.get(right.dataset) ?? Number.MAX_SAFE_INTEGER) || left.corpus_id.localeCompare(right.corpus_id));
    if (!cases.length) throw new Error("no benchmark cases selected");
    const configs = Object.fromEntries(options.providers.map((name) => {
        const config = options.configs?.[name] ?? provider_config_from_env(name);
        return [name, name === "longmemory" && !config.profile
            ? { ...config, profile: official_requested ? "semantic" : "synthetic" }
            : config];
    })) as Record<provider_name, provider_config>;
    const manifest = make_manifest(options, cases, cutoffs, configs);
    const checkpoint_path = resolve(output_dir, "checkpoint.json");
    const checkpoint = load_checkpoint(checkpoint_path, run_id, manifest, options.resume !== false);
    const datasets_by_case = new Map(cases.map((item) => [item.id, item.dataset]));
    for (const provider_cases of Object.values(checkpoint.providers)) {
        for (const item of Object.values(provider_cases ?? {})) item.dataset = datasets_by_case.get(item.case_id) ?? item.dataset;
    }
    save_checkpoint(checkpoint_path, checkpoint);
    const outcomes: provider_outcome[] = [];
    const answerer = options.answerer_config ? (options.make_model?.(options.answerer_config, "answerer") ?? create_language_model(options.answerer_config)) : null;
    const judge_model = options.judge_config ? (options.make_model?.(options.judge_config, "judge") ?? create_language_model(options.judge_config)) : null;
    const judge = judge_model ? (options.make_judge?.(judge_model) ?? create_judge(judge_model)) : null;

    for (const name of options.providers) {
        const provider = options.make_provider?.(name) ?? create_provider(name);
        const provider_cases = checkpoint.providers[name] ?? {};
        checkpoint.providers[name] = provider_cases;
        const complete = cases.every((item) => provider_cases[item.id]?.phases[manifest.ai.enabled ? "judge" : "evaluate"].status === "completed");
        if (options.resume !== false && complete) {
            outcomes.push({ name, display_name: provider.display_name, status: "completed" });
            continue;
        }
        try {
            await provider.initialize(configs[name]);
            try {
                await provider.health();
            } catch (error) {
                outcomes.push({ name, display_name: provider.display_name, status: "unavailable", reason: error instanceof Error ? error.message : String(error) });
                continue;
            }
            let active_corpus_id: string | null = null;
            for (let index = 0; index < cases.length; index++) {
                const benchmark_case = cases[index];
                const terminal_phase = manifest.ai.enabled ? "judge" : "evaluate";
                if (options.resume !== false && provider_cases[benchmark_case.id]?.phases[terminal_phase].status === "completed") continue;
                options.on_progress?.({ provider: name, case_id: benchmark_case.id, index: index + 1, total: cases.length });
                const item = new_case(benchmark_case.id, benchmark_case.corpus_id, benchmark_case.dataset, benchmark_case.category);
                item.read_input_tokens = count_tokens(benchmark_case.question);
                provider_cases[benchmark_case.id] = item;
                const parsed_question_time = benchmark_case.question_date ? Date.parse(benchmark_case.question_date.replace(/\s*\([A-Za-z]{3}\)\s*/, " ")) : Number.NaN;
                const scope = {
                    run_id,
                    case_id: benchmark_case.id,
                    corpus_id: benchmark_case.corpus_id,
                    user_id: benchmark_case.user_id,
                    ...(Number.isFinite(parsed_question_time) ? { question_time: parsed_question_time } : {}),
                };
                let active_phase: keyof typeof item.phases = "ingest";
                let phase_started = performance.now();
                try {
                    if (active_corpus_id === benchmark_case.corpus_id) {
                        item.ingest_reused = true;
                        item.write_input_tokens = 0;
                        start_phase(item, "ingest");
                        complete_phase(item, "ingest", 0);
                        start_phase(item, "indexing");
                        complete_phase(item, "indexing", 0);
                    } else {
                        item.write_input_tokens = benchmark_case.events.reduce((sum, event) => sum + count_tokens(event.text), 0);
                        await provider.reset(scope);
                        start_phase(item, "ingest");
                        save_checkpoint(checkpoint_path, checkpoint);
                        phase_started = performance.now();
                        const ingest = await elapsed(() => provider.ingest(benchmark_case.events, scope));
                        complete_phase(item, "ingest", ingest.duration_ms);

                        active_phase = "indexing";
                        start_phase(item, "indexing");
                        save_checkpoint(checkpoint_path, checkpoint);
                        phase_started = performance.now();
                        const indexing = await elapsed(() => provider.await_indexing(ingest.value, scope));
                        complete_phase(item, "indexing", indexing.duration_ms);
                        active_corpus_id = benchmark_case.corpus_id;
                    }

                    active_phase = "search";
                    start_phase(item, "search");
                    save_checkpoint(checkpoint_path, checkpoint);
                    phase_started = performance.now();
                    const searched = await elapsed(() => provider.search(benchmark_case.question, Math.max(...cutoffs), scope));
                    complete_phase(item, "search", searched.duration_ms);
                    const context_hits = fit_context(searched.value, manifest.context_token_budget);

                    active_phase = "evaluate";
                    start_phase(item, "evaluate");
                    save_checkpoint(checkpoint_path, checkpoint);
                    phase_started = performance.now();
                    const matched = match_hits(searched.value, benchmark_case);
                    const top = matched.slice(0, Math.max(...cutoffs));
                    const matched_ids = new Set(top.flatMap((hit) => hit.evidence_id ? [hit.evidence_id] : []));
                    item.hits = matched;
                    item.metrics = cutoffs.map((cutoff) => score_at_k(matched, benchmark_case.evidence_ids, cutoff));
                    item.evidence_ids = benchmark_case.evidence_ids;
                    item.stale_leakage = benchmark_case.forbidden_ids.some((id) => matched_ids.has(id));
                    item.abstention_correct = benchmark_case.evidence_ids.length || benchmark_case.evidence_unknown ? null : matched_ids.size === 0;
                    item.context_tokens = count_tokens(context_hits.map((hit) => hit.text).join("\n"));
                    complete_phase(item, "evaluate", performance.now() - phase_started);

                    if (answerer && judge) {
                        active_phase = "answer";
                        start_phase(item, "answer");
                        save_checkpoint(checkpoint_path, checkpoint);
                        phase_started = performance.now();
                        item.cutoff_results = {};
                        for (const cutoff of cutoffs) {
                            const context = context_hits.slice(0, cutoff);
                            const base_prompt = build_answer_prompt(benchmark_case, []);
                            const answer_prompt = build_answer_prompt(benchmark_case, context);
                            const answer_started = performance.now();
                            const response = await answerer.generate({ system: answer_prompt.system, user: answer_prompt.user });
                            const base_prompt_tokens = count_tokens(`${base_prompt.system}\n${base_prompt.user}`);
                            const estimated_prompt_tokens = count_tokens(`${answer_prompt.system}\n${answer_prompt.user}`);
                            item.cutoff_results[`top_${cutoff}`] = {
                                k: cutoff,
                                memories_evaluated: context.length,
                                hypothesis: response.text.trim(),
                                prompt_tokens: response.prompt_tokens ?? estimated_prompt_tokens,
                                base_prompt_tokens,
                                context_tokens: Math.max(0, estimated_prompt_tokens - base_prompt_tokens),
                                completion_tokens: response.completion_tokens ?? count_tokens(response.text),
                                answer_duration_ms: performance.now() - answer_started,
                            };
                        }
                        complete_phase(item, "answer", performance.now() - phase_started);

                        active_phase = "judge";
                        start_phase(item, "judge");
                        save_checkpoint(checkpoint_path, checkpoint);
                        phase_started = performance.now();
                        const evidence = benchmark_case.events.filter((event) => benchmark_case.evidence_ids.includes(event.id)).map((event) => event.text);
                        for (const result of Object.values(item.cutoff_results)) {
                            const judge_started = performance.now();
                            const abstention = benchmark_case.category.toLowerCase().includes("abstention") || benchmark_case.category.toLowerCase().includes("adversarial");
                            const exact_abstention = /^i (?:do not|don't) know[.!]?$/i.test(result.hypothesis.trim());
                            if (abstention && exact_abstention) {
                                result.score = 1;
                                result.label = "correct";
                                result.explanation = "Exact required abstention.";
                                result.judge_raw = "deterministic-abstention";
                                result.judge_duration_ms = performance.now() - judge_started;
                                continue;
                            }
                            const judgment = await judge.evaluate({
                                question: benchmark_case.question,
                                category: benchmark_case.category,
                                ground_truth: benchmark_case.answer,
                                hypothesis: result.hypothesis,
                                evidence,
                            });
                            result.score = judgment.score;
                            result.label = judgment.label;
                            result.explanation = judgment.explanation;
                            result.judge_raw = judgment.raw;
                            result.judge_duration_ms = performance.now() - judge_started;
                        }
                        complete_phase(item, "judge", performance.now() - phase_started);
                    }
                } catch (error) {
                    fail_phase(item, active_phase, performance.now() - phase_started, error);
                }
                save_checkpoint(checkpoint_path, checkpoint);
            }
            const values = Object.values(provider_cases);
            const completed_count = values.filter((item) => item.phases[manifest.ai.enabled ? "judge" : "evaluate"].status === "completed").length;
            const failed_count = values.length - completed_count;
            outcomes.push({
                name,
                display_name: provider.display_name,
                status: failed_count === 0 ? "completed" : completed_count ? "partial" : "failed",
                ...(failed_count ? { reason: `${failed_count} question(s) failed` } : {}),
            });
        } catch (error) {
            outcomes.push({
                name,
                display_name: provider.display_name,
                status: "failed",
                reason: error instanceof Error ? error.message : String(error),
            });
        } finally {
            await provider.close().catch(() => undefined);
        }
    }
    return { report: build_report(run_id, manifest, checkpoint, outcomes), output_dir };
}
