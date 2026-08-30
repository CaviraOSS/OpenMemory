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
 *  file  : benchmarks/src/metrics.ts
 *  usage : supports LongMemory benchmark metrics
 */

import { benchmark_defaults } from "./config";
import type { benchmark_case, case_checkpoint, latency_stats, matched_hit, retrieval_metrics, search_hit } from "./types";
import { benchmark_source_ref } from "./source_ref";

const stopwords = new Set(["a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "it", "of", "on", "or", "that", "the", "to", "was", "were", "with"]);

const terms = (text: string): Set<string> => new Set(
    (text.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? []).filter((term) => term.length > 1 && !stopwords.has(term)),
);

const lexical_score = (left: string, right: string): number => {
    const left_terms = terms(left);
    const right_terms = terms(right);
    if (!left_terms.size || !right_terms.size) return 0;
    let overlap = 0;
    for (const term of left_terms) if (right_terms.has(term)) overlap++;
    return overlap / Math.min(left_terms.size, right_terms.size);
};

function source_id(value: unknown, depth = 0): string | null {
    if (depth > 5 || value === null || typeof value !== "object") return null;
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = source_id(item, depth + 1);
            if (found) return found;
        }
        return null;
    }
    const record = value as Record<string, unknown>;
    for (const key of ["source_event_id", "sourceEventId", "customId", "external_id", "sessionId"]) {
        if (typeof record[key] === "string" && record[key]) return record[key] as string;
    }
    for (const nested of Object.values(record)) {
        const found = source_id(nested, depth + 1);
        if (found) return found;
    }
    return null;
}

export function match_hits(hits: search_hit[], item: benchmark_case, threshold = benchmark_defaults.lexical_threshold, trust_source_ids = false): matched_hit[] {
    const events = new Map(item.events.map((event) => [event.id, event]));
    const source_refs = new Map(item.events.map((event) => [benchmark_source_ref(event), event.id]));
    return hits.map((hit) => {
        const opaque_ids = record_source_refs(hit.metadata).flatMap((ref) => source_refs.get(ref) ?? []);
        if (opaque_ids.length) {
            const candidates = opaque_ids.map((id) => ({ id, score: lexical_score(hit.text, events.get(id)?.text ?? "") })).sort((left, right) => right.score - left.score);
            if (candidates[0].score >= threshold || candidates.length === 1) return { ...hit, evidence_id: candidates[0].id, match_method: "source_ref" as const };
        }
        const direct = source_id(hit.metadata);
        if (trust_source_ids && direct && events.has(direct)) return { ...hit, evidence_id: direct, match_method: "source_id" as const };
        let evidence_id: string | null = null;
        let best = 0;
        for (const event of item.events) {
            const score = lexical_score(hit.text, event.text);
            if (score > best) {
                best = score;
                evidence_id = event.id;
            }
        }
        return best >= threshold
            ? { ...hit, evidence_id, match_method: "lexical" as const }
            : { ...hit, evidence_id: null, match_method: "none" as const };
    });
}

function record_source_refs(value: unknown, depth = 0): string[] {
    if (depth > 5 || value === null || typeof value !== "object") return [];
    if (Array.isArray(value)) return value.flatMap((item) => typeof item === "string" ? [item] : record_source_refs(item, depth + 1));
    const entry = value as Record<string, unknown>;
    const direct = [entry.source_ref, ...(Array.isArray(entry.source_refs) ? entry.source_refs : [])].filter((item): item is string => typeof item === "string" && item.length > 0);
    return [...new Set([...direct, ...Object.values(entry).flatMap((item) => record_source_refs(item, depth + 1))])];
}

const dcg = (gains: number[]): number => gains.reduce((sum, gain, index) => sum + gain / Math.log2(index + 2), 0);

export function score_at_k(hits: matched_hit[], evidence_ids: string[], k: number): retrieval_metrics {
    const relevant = new Set(evidence_ids);
    const seen_relevant = new Set<string>();
    const top = hits.slice(0, k);
    let first_rank = 0;
    const gains = top.map((hit, index) => {
        const id = hit.evidence_id;
        if (!id || !relevant.has(id) || seen_relevant.has(id)) return 0;
        seen_relevant.add(id);
        if (!first_rank) first_rank = index + 1;
        return 1;
    });
    const found = seen_relevant.size;
    const precision = top.length ? found / top.length : 0;
    const recall = relevant.size ? found / relevant.size : 0;
    const ideal = dcg(Array.from({ length: Math.min(relevant.size, k) }, () => 1));
    return {
        k,
        queries: relevant.size ? 1 : 0,
        hit_rate: found ? 1 : 0,
        precision,
        recall,
        f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
        mrr: first_rank ? 1 / first_rank : 0,
        ndcg: ideal ? dcg(gains) / ideal : 0,
    };
}

export function aggregate_metrics(cases: case_checkpoint[], cutoffs: number[]): retrieval_metrics[] {
    const answerable = cases.filter((item) => item.metrics?.some((metric) => metric.queries > 0));
    return cutoffs.map((k) => {
        const values = answerable.flatMap((item) => item.metrics?.find((metric) => metric.k === k) ?? []);
        const average = (key: keyof Omit<retrieval_metrics, "k" | "queries">): number => values.length ? values.reduce((sum, value) => sum + value[key], 0) / values.length : 0;
        return {
            k,
            queries: values.length,
            hit_rate: average("hit_rate"),
            precision: average("precision"),
            recall: average("recall"),
            f1: average("f1"),
            mrr: average("mrr"),
            ndcg: average("ndcg"),
        };
    });
}

export type quality_report_result = {
    k: number;
    recall_at_k: number;
    precision_at_k: number;
    mrr: number;
    ndcg: number;
    queries: number;
};

export function quality_report(queries: Array<{ retrieved: string[]; relevant: Set<string> }>, k: number): quality_report_result {
    if (!queries.length) return { k, recall_at_k: 0, precision_at_k: 0, mrr: 0, ndcg: 0, queries: 0 };
    const values = queries.map((query) => score_at_k(
        query.retrieved.map((id) => ({ id, text: id, metadata: {}, evidence_id: id, match_method: "source_id" as const })),
        [...query.relevant],
        k,
    ));
    const average = (key: keyof Omit<retrieval_metrics, "k" | "queries">): number => values.reduce((sum, value) => sum + value[key], 0) / values.length;
    return {
        k,
        recall_at_k: average("recall"),
        precision_at_k: average("precision"),
        mrr: average("mrr"),
        ndcg: average("ndcg"),
        queries: values.length,
    };
}

export const count_tokens = (text: string): number => text.trim() ? Math.ceil(text.length / 4) : 0;

export function percentile(values: number[], value: number): number {
    if (!values.length) return 0;
    if (values.length === 1) return values[0];
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.min(1, Math.max(0, value)) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
}

export function latency(values: number[]): latency_stats {
    if (!values.length) return { count: 0, min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0, stddev: 0 };
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    return {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        mean,
        p50: percentile(values, 0.5),
        p95: percentile(values, 0.95),
        p99: percentile(values, 0.99),
        stddev: Math.sqrt(variance),
    };
}
