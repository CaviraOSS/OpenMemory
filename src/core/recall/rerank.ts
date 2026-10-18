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


import { recall_tokens, strict_recall_tokens, type RecallDocument } from './recall_text.js';
import type { HydroNode } from '../types/hydro_node.js';

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

export type calendar_window = { from: number; to: number };
const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const calendar_pattern = new RegExp(`\\b(${months.join('|')})(?:\\s+(\\d{1,2})(?:st|nd|rd|th)?,?)?\\s+(\\d{4})\\b`, 'gi');

export function query_calendar_window(text: string): calendar_window | null {
    const matches = [...text.matchAll(calendar_pattern)];
    if (matches.length !== 1 || /\b(?:before|after|since|until|between|from)\b/i.test(text)) return null;
    const [, month_name, day_text, year_text] = matches[0];
    const month = months.indexOf(month_name.toLowerCase());
    const year = Number(year_text);
    const day = day_text ? Number(day_text) : 1;
    if (year < 1000 || day < 1 || day > 31) return null;
    const from = Date.UTC(year, month, day);
    if (new Date(from).getUTCMonth() !== month) return null;
    return { from, to: day_text ? Date.UTC(year, month, day + 1) : Date.UTC(year, month + 1, 1) };
}

export function calendar_relevance(window: calendar_window | null, node: HydroNode): number {
    if (!window || !Number.isFinite(node.temporal.observed_at)) return 0;
    const at = node.temporal.observed_at;
    const observed = new Date(at);
    const contains = (value: number) => value >= window.from && value < window.to;
    const mentions = [...node.content.raw.matchAll(calendar_pattern)];
    if (mentions.some((match) => {
        const explicit = query_calendar_window(match[0]);
        return explicit !== null && explicit.from < window.to && explicit.to > window.from;
    })) return 1;
    const prior_month = /\blast month\b/i.test(node.content.raw);
    const prior_week = /\blast week\b/i.test(node.content.raw);
    const yesterday = /\byesterday\b/i.test(node.content.raw);
    if (prior_month) {
        const from = Date.UTC(observed.getUTCFullYear(), observed.getUTCMonth() - 1, 1);
        const to = Date.UTC(observed.getUTCFullYear(), observed.getUTCMonth(), 1);
        if (from < window.to && to > window.from) return 1;
    }
    if (prior_week && contains(at - 7 * 86_400_000)) return 0.75;
    if (yesterday && contains(at - 86_400_000)) return 1;
    if (contains(at) && !prior_month && !prior_week && !yesterday && !mentions.length) return 0.75;
    return 0;
}

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

export type evidence_query = {
    subject: string | null;
    terms: ReadonlySet<string>;
    excluded: ReadonlySet<string>;
    aggregate: boolean;
};

export type evidence_features = {
    attribution: number;
    assertion: number;
    excluded_only: boolean;
    derivation?: number;
};

type evidence_document = {
    speaker: string;
    assertions: readonly string[];
    assertion_terms: ReadonlySet<string>;
    speaker_terms: ReadonlySet<string>;
    terms: ReadonlySet<string>;
};

const evidence_cache = new WeakMap<HydroNode, evidence_document>();
const generic_terms = new Set(['activiti', 'activity', 'item', 'thing', 'many', 'total', 'list', 'beside', 'apart', 'other', 'except']);
const escape_pattern = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const evidence_tokens = (text: string): string[] => recall_tokens(text.replace(/[^\p{L}\p{N}'_-]+/gu, ' '));

function related_word(left: string, right: string): boolean {
    if (left === right || !/^[a-z]{6,}$/.test(left) || !/^[a-z]{6,}$/.test(right)) return false;
    const shorter = left.length < right.length ? left : right;
    const longer = left.length < right.length ? right : left;
    return longer.startsWith(shorter) && /^(?:ation|ations|ion|ions|ment|ments|al|ally|ness)$/.test(longer.slice(shorter.length));
}

function speaker_of(node: HydroNode): string {
    const declared = node.metadata.speaker ?? node.metadata.role;
    return typeof declared === 'string' ? declared.trim().toLowerCase() : '';
}

function evidence_document_of(node: HydroNode): evidence_document {
    const cached = evidence_cache.get(node);
    if (cached) return cached;
    const speaker = speaker_of(node);
    const prefix = speaker ? new RegExp(`^\\s*${escape_pattern(speaker)}:\\s*`, 'i') : null;
    const body = prefix ? node.content.raw.replace(prefix, '') : node.content.raw;
    const statements = body.split(/(?<=[.!?])\s+|\n+/).map((value) => value.trim()).filter(Boolean);
    const assertions = statements.filter((statement) => !statement.endsWith('?'));
    const document = {
        speaker, assertions,
        assertion_terms: new Set(assertions.flatMap(evidence_tokens)),
        speaker_terms: new Set(evidence_tokens(speaker)),
        terms: new Set(evidence_tokens(body)),
    };
    evidence_cache.set(node, document);
    return document;
}

export function prepare_evidence_query(text: string, nodes: readonly HydroNode[]): evidence_query {
    const words = ` ${strict_recall_tokens(text).join(' ')} `;
    const speakers = new Set(nodes.map(speaker_of)
        .filter((speaker) => speaker && !/^(?:user|assistant|system|tool|function|speaker)$/.test(speaker)));
    const mentioned = [...speakers].filter((speaker) => words.includes(` ${strict_recall_tokens(speaker).join(' ')} `));
    const subject = mentioned.length === 1 ? mentioned[0]
        : /\b(?:i|me|my|mine)\b/i.test(text) && !/\b(?:you|your|assistant)\b/i.test(text) ? 'user' : null;
    const exclusion = /\b(?:besides|apart from|other than|except for)\s+(.+?)[?.!]*$/i.exec(text);
    const excluded = new Set(exclusion ? evidence_tokens(exclusion[1]).filter((term) => !generic_terms.has(term)) : []);
    const subject_terms = new Set(subject ? evidence_tokens(subject) : []);
    const terms = new Set(evidence_tokens(exclusion ? text.slice(0, exclusion.index) : text)
        .filter((term) => !subject_terms.has(term) && !generic_terms.has(term)));
    // a named third party's history is scattered across many turns; searching it narrowly
    // and keeping only the single closest lexical match misses the other facts a real
    // question about that person needs, so treat it the same as an explicit list/count query.
    const named_subject_query = subject !== null && subject !== 'user';
    return {
        subject, terms, excluded,
        aggregate: named_subject_query || /\b(?:how many|list|which (?:items|events|activities|places)|what activities)\b/i.test(text),
    };
}


export function evidence_support(query: evidence_query, node: HydroNode, derivation_enabled = true): evidence_features {
    const document = evidence_document_of(node);
    const assertions = document.assertions;
    const subject_pattern = query.subject && query.subject !== 'user'
        ? new RegExp(`(?:^|[.!?]\\s+)(?:my (?:friend|colleague|partner) )?${escape_pattern(query.subject)}(?:'s)?\\s+(?![,!?])`, 'i')
        : null;
    const explicit_subject = subject_pattern ? assertions.some((statement) => subject_pattern.test(statement)) : false;
    const attribution = !query.subject ? 0 : document.speaker === query.subject || explicit_subject ? 1
        : document.speaker ? -1 : 0;
    const supported_terms = document.assertion_terms;
    const derivation = derivation_enabled && [...query.terms].some((term) => !supported_terms.has(term)
        && [...supported_terms].some((token) => related_word(term, token))) ? 1 : 0;
    const positive_match = derivation > 0 || [...query.terms].some((term) => supported_terms.has(term));
    const assertion = assertions.length === 0 ? -1 : query.terms.size === 0 ? 0
        : positive_match ? 1 : 0;
    const excluded_match = [...query.excluded].some((term) => document.terms.has(term));
    return { attribution, assertion, excluded_only: excluded_match && !positive_match, derivation };
}

export type EvidenceWeights = {
    attribution: number;
    assertion: number;
    excluded_only: number;
    derivation: number;
};

// tuned on the 55-case diagnostic alongside default_rerank_weights
export const default_evidence_weights: EvidenceWeights = {
    attribution: 0.24,
    assertion: 0.06,
    excluded_only: 0.16,
    derivation: 0.12,
};

export function evidence_adjustment(features: evidence_features, weights: EvidenceWeights = default_evidence_weights): number {
    return weights.attribution * features.attribution + weights.assertion * features.assertion - (features.excluded_only ? weights.excluded_only : 0)
        + weights.derivation * (features.derivation ?? 0);
}

export function order_evidence<item extends { node: HydroNode; score: number }>(items: readonly item[], query: evidence_query, counterevidence?: item): item[] {
    const ordered = [...items].sort((left, right) => right.score - left.score);
    if (counterevidence) {
        const position = ordered.indexOf(counterevidence);
        if (position > 2) ordered.splice(2, 0, ...ordered.splice(position, 1));
    }
    if (!query.aggregate || ordered.length < 2) return ordered;
    const terms = ordered.map((item) => {
        const document = evidence_document_of(item.node);
        const speaker_terms = document.speaker_terms;
        return new Set([...document.terms].filter((term) => !query.terms.has(term) && !speaker_terms.has(term)));
    });
    const remaining = new Set(ordered.map((_, index) => index));
    const redundancy = new Array<number>(ordered.length).fill(0);
    const selected: item[] = [];
    while (remaining.size) {
        let best = -1;
        let score = -Infinity;
        for (const index of remaining) {
            const value = ordered[index].score - 0.12 * redundancy[index];
            if (value > score) { best = index; score = value; }
        }
        selected.push(ordered[best]);
        remaining.delete(best);
        for (const index of remaining) {
            let overlap = 0;
            for (const term of terms[index]) if (terms[best].has(term)) overlap++;
            const similarity = overlap / (terms[index].size + terms[best].size - overlap || 1);
            redundancy[index] = Math.max(redundancy[index], similarity);
        }
    }
    if (counterevidence) {
        const position = selected.indexOf(counterevidence);
        if (position > 2) selected.splice(2, 0, ...selected.splice(position, 1));
    }
    return selected;
}
