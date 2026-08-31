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
 *  file  : src/core/recall/rerank.ts
 *  usage : implements the LongMemory rerank component
 */


import type { RecallDocument } from './recall_text.js';

export type RerankFeatures = {
    coverage: number;
    phrase: number;
};

export type RerankWeights = {
    coverage: number;
    phrase: number;
};

// tuned on the 55-case diagnostic; 0.35/0.20 degrades mrr at every cutoff
export const default_rerank_weights: RerankWeights = {
    coverage: 0.18,
    phrase: 0.12,
};

export const default_rerank_depth = 50;

function bigrams(terms: readonly string[]): Set<string> {
    const pairs = new Set<string>();
    for (let index = 1; index < terms.length; index++) pairs.add(`${terms[index - 1]} ${terms[index]}`);
    return pairs;
}

export function rerank_features(
    query_terms: readonly string[],
    query_bigrams: ReadonlySet<string>,
    document: RecallDocument,
): RerankFeatures {
    if (query_terms.length === 0) return { coverage: 0, phrase: 0 };
    let matched = 0;
    for (const term of query_terms) if (document.frequencies.has(term) || document.speaker_terms.has(term)) matched++;
    const coverage = matched / query_terms.length;
    if (query_bigrams.size === 0) return { coverage, phrase: 0 };
    const document_bigrams = bigrams(document.terms);
    let phrase_hits = 0;
    for (const pair of query_bigrams) if (document_bigrams.has(pair)) phrase_hits++;
    return { coverage, phrase: phrase_hits / query_bigrams.size };
}

export function prepare_rerank_query(query_terms: readonly string[]): { terms: string[]; pairs: Set<string> } {
    const terms = [...new Set(query_terms)];
    return { terms, pairs: bigrams(query_terms) };
}

export function rerank_score(base: number, features: RerankFeatures, weights: RerankWeights = default_rerank_weights): number {
    return base + weights.coverage * features.coverage + weights.phrase * features.phrase;
}
