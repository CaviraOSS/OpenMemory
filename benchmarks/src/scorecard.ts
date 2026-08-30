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
 *  file  : benchmarks/src/scorecard.ts
 *  usage : supports LongMemory benchmark scorecard
 */

import type { case_checkpoint, longmemory_scorecard, provider_report, run_manifest, scorecard_metric } from "./types";

const unavailable = (unit: scorecard_metric["unit"], reason: string): scorecard_metric => ({
    value: null, unit, numerator: null, denominator: null, reason,
});

const ratio = (numerator: number, denominator: number, reason = ""): scorecard_metric => denominator > 0
    ? { value: numerator / denominator, unit: "ratio", numerator, denominator, ...(reason ? { reason } : {}) }
    : unavailable("ratio", reason || "no eligible questions");

const scalar = (value: number, unit: scorecard_metric["unit"], denominator: number): scorecard_metric => ({
    value, unit, numerator: null, denominator,
});

const terminal_cases = (provider: provider_report, manifest: run_manifest): case_checkpoint[] => provider.cases.filter((item) =>
    item.phases[manifest.ai.enabled ? "judge" : "evaluate"].status === "completed",
);

const judged = (cases: case_checkpoint[], cutoff: number): scorecard_metric => {
    const values = cases.flatMap((item) => item.cutoff_results?.[`top_${cutoff}`]?.score ?? []);
    return values.length ? ratio(values.reduce((sum, value) => sum + value, 0), values.length) : unavailable("ratio", "AI answer evaluation was not completed");
};

const category_accuracy = (cases: case_checkpoint[], cutoff: number, categories: Set<string>, label: string): scorecard_metric => {
    const selected = cases.filter((item) => categories.has(item.category));
    return selected.length ? judged(selected, cutoff) : unavailable("ratio", `no ${label} cases in the selected datasets`);
};

const dataset_accuracy = (provider: provider_report, dataset: "longmemeval" | "locomo" | "beam-1m" | "beam-10m", cutoff: number): scorecard_metric => {
    const result = provider.datasets.find((item) => item.dataset === dataset);
    if (!result) return unavailable("ratio", `${dataset} was not selected`);
    if (result.failed_questions > 0) return unavailable("ratio", `${dataset} run incomplete: ${result.failed_questions} question(s) failed`);
    const value = result.answer_accuracy[`top_${cutoff}`];
    return value === undefined ? unavailable("ratio", `${dataset} requires answerer and judge evaluation`) : ratio(value * result.questions, result.questions);
};

const rank_weighted_precision = (item: case_checkpoint, cutoff: number): number | null => {
    const evidence = new Set(item.evidence_ids ?? []);
    if (!evidence.size || !item.hits?.length) return null;
    let relevant_seen = 0;
    let weighted = 0;
    for (const [index, hit] of item.hits.slice(0, cutoff).entries()) {
        if (!hit.evidence_id || !evidence.has(hit.evidence_id)) continue;
        relevant_seen++;
        weighted += relevant_seen / (index + 1);
    }
    return weighted / evidence.size;
};

export function build_longmemory_scorecard(manifest: run_manifest, provider?: provider_report): longmemory_scorecard {
    const cutoff = manifest.cutoffs.includes(5) ? 5 : Math.max(...manifest.cutoffs);
    if (!provider) {
        const missing = (unit: scorecard_metric["unit"]) => unavailable(unit, "LongMemory provider did not produce a report");
        return {
            cutoff,
            memory_quality: { longmemeval: missing("ratio"), locomo: missing("ratio"), beam_1m: missing("ratio"), beam_10m: missing("ratio") },
            retrieval: { context_recall: missing("ratio"), context_precision: missing("ratio"), evidence_completeness: missing("ratio") },
            temporal_memory: { current_fact_accuracy: missing("ratio"), historical_fact_accuracy: missing("ratio"), update_accuracy: missing("ratio"), event_order_accuracy: missing("ratio") },
            reliability: { abstention_accuracy: missing("ratio"), contradiction_resolution: missing("ratio") },
            efficiency: { p50_retrieval: missing("milliseconds"), p95_retrieval: missing("milliseconds"), mean_tokens_retrieved: missing("tokens"), write_cost_per_1k_input_tokens: missing("usd"), read_cost_per_query: missing("usd") },
        };
    }

    const cases = terminal_cases(provider, manifest);
    const retrieval_cases = cases.flatMap((item) => {
        const metric = item.metrics?.find((value) => value.k === cutoff);
        return metric?.queries ? [{ item, metric }] : [];
    });
    const recall_sum = retrieval_cases.reduce((sum, value) => sum + value.metric.recall, 0);
    const precision_values = retrieval_cases.map((value) => rank_weighted_precision(value.item, cutoff)).filter((value): value is number => value !== null);
    const precision_sum = precision_values.reduce((sum, value) => sum + value, 0);
    const complete = retrieval_cases.filter((value) => value.metric.recall === 1).length;
    const update_cases = cases.filter((item) => item.category === "knowledge-update");
    const update_contradictions = update_cases.flatMap((item) => {
        const score = item.cutoff_results?.[`top_${cutoff}`]?.score;
        return score === undefined ? [] : [score === 1 && !item.stale_leakage ? 1 : 0];
    });
    const judged_contradictions = judged(cases.filter((item) => item.category === "contradiction-resolution"), cutoff);
    const contradiction_numerator = update_contradictions.reduce((sum, value) => sum + value, 0) + (judged_contradictions.numerator ?? 0);
    const contradiction_denominator = update_contradictions.length + (judged_contradictions.denominator ?? 0);
    const read_tokens = cases.flatMap((item) => item.read_input_tokens ?? []);
    const semantic_active = manifest.providers.find((item) => item.name === "longmemory")?.profile === "semantic";
    const price = semantic_active ? manifest.longmemory_embedding?.input_cost_per_million_usd ?? null : null;
    const cost_reason = semantic_active ? "set BENCH_EMBEDDING_INPUT_COST_PER_MILLION_USD to calculate embedding cost" : "semantic embedding profile was not active";
    const mean_read_tokens = read_tokens.length ? read_tokens.reduce((sum, value) => sum + value, 0) / read_tokens.length : 0;

    return {
        cutoff,
        memory_quality: {
            longmemeval: dataset_accuracy(provider, "longmemeval", cutoff),
            locomo: dataset_accuracy(provider, "locomo", cutoff),
            beam_1m: dataset_accuracy(provider, "beam-1m", cutoff),
            beam_10m: dataset_accuracy(provider, "beam-10m", cutoff),
        },
        retrieval: {
            context_recall: ratio(recall_sum, retrieval_cases.length, `macro-average evidence recall at K=${cutoff}`),
            context_precision: ratio(precision_sum, precision_values.length, `rank-weighted evidence precision at K=${cutoff}`),
            evidence_completeness: ratio(complete, retrieval_cases.length, `questions retrieving all required evidence at K=${cutoff}`),
        },
        temporal_memory: {
            current_fact_accuracy: category_accuracy(cases, cutoff, new Set(["information-extraction", "single-hop"]), "direct current-fact"),
            historical_fact_accuracy: unavailable("ratio", "no dedicated historical-fact dataset is implemented"),
            update_accuracy: category_accuracy(cases, cutoff, new Set(["knowledge-update"]), "knowledge-update"),
            event_order_accuracy: category_accuracy(cases, cutoff, new Set(["temporal-reasoning", "event-ordering"]), "temporal/event-order"),
        },
        reliability: {
            abstention_accuracy: category_accuracy(cases, cutoff, new Set(["abstention", "adversarial"]), "abstention"),
            contradiction_resolution: contradiction_denominator
                ? ratio(contradiction_numerator, contradiction_denominator, "judged contradiction handling plus correct updates with no forbidden stale evidence")
                : unavailable("ratio", "no judged contradiction or knowledge-update cases with stale-evidence annotations"),
        },
        efficiency: {
            p50_retrieval: provider.latency.search.count ? scalar(provider.latency.search.p50, "milliseconds", provider.latency.search.count) : unavailable("milliseconds", "no completed retrievals"),
            p95_retrieval: provider.latency.search.count ? scalar(provider.latency.search.p95, "milliseconds", provider.latency.search.count) : unavailable("milliseconds", "no completed retrievals"),
            mean_tokens_retrieved: cases.length ? scalar(provider.average_context_tokens, "tokens", cases.length) : unavailable("tokens", "no completed retrievals"),
            write_cost_per_1k_input_tokens: price === null
                ? unavailable("usd", cost_reason)
                : scalar(price / 1_000, "usd", 1_000),
            read_cost_per_query: price === null
                ? unavailable("usd", cost_reason)
                : scalar(mean_read_tokens * price / 1_000_000, "usd", read_tokens.length),
        },
    };
}