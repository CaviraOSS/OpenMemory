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
 *  file  : src/core/recall/recall_text.ts
 *  usage : implements the LongMemory recall text component
 */


import { tokenize } from '../i18n/multilingual_tokenizer.js';
import type { HydroNode } from '../types/hydro_node.js';

const stopwords = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'could', 'did', 'do', 'does', 'for', 'from', 'had', 'has', 'have', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'should', 'that', 'the', 'to', 'was', 'were', 'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'would', 'you', 'your']);

export type RecallDocument = {
    terms: readonly string[];
    frequencies: ReadonlyMap<string, number>;
    length: number;
    speaker_terms: ReadonlySet<string>;
};

export type RecallVector = {
    values: readonly number[];
    norm: number;
};

export type StrictRecallDocument = {
    terms: ReadonlySet<string>;
};

export type SubjectRecallDocument = {
    terms: ReadonlySet<string>;
};

const document_cache = new WeakMap<HydroNode, RecallDocument>();
const strict_document_cache = new WeakMap<HydroNode, StrictRecallDocument>();
const subject_document_cache = new WeakMap<HydroNode, SubjectRecallDocument>();
const vector_cache = new WeakMap<readonly number[], RecallVector>();

const doubled_consonant = /([bdfgmnprt])\1$/;

function undouble(stem: string): string {
    return doubled_consonant.test(stem) ? stem.slice(0, -1) : stem;
}

export function normalize_recall_token(value: string): string {
    if (!/^[a-z]+$/.test(value) || value.length <= 3) return value;
    if (value.endsWith('ies')) return `${value.slice(0, -3)}y`;
    if (value.length > 5 && value.endsWith('ing')) return undouble(value.slice(0, -3));
    if (value.length > 4 && value.endsWith('ed')) return undouble(value.slice(0, -2));
    if (value.length > 4 && value.endsWith('ly')) return value.slice(0, -2);
    if (value.endsWith('s') && !/(?:ss|us|is)$/.test(value)) return value.slice(0, -1);
    return value;
}

function split_speaker(text: string): { speaker: string; body: string } {
    const match = /^\s*([^:\n]{1,32}):\s+([\s\S]*)$/.exec(text || '');
    if (!match) return { speaker: '', body: text || '' };
    const candidate = match[1].trim();
    if (!candidate || /[.!?,;]/.test(candidate) || candidate.split(/\s+/).length > 2) return { speaker: '', body: text || '' };
    return { speaker: candidate, body: match[2] };
}

export function recall_tokens(text: string): string[] {
    return tokenize(text || '').map((token) => normalize_recall_token(token.value)).filter((value) => !stopwords.has(value));
}

export function strict_recall_tokens(text: string): string[] {
    return tokenize(text || '').map((token) => token.value);
}

export function recall_document(node: HydroNode): RecallDocument {
    const cached = document_cache.get(node);
    if (cached) return cached;
    const canonical = split_speaker(node.content.canonical);
    const declared_speaker = typeof node.metadata.speaker === 'string' ? node.metadata.speaker : '';
    const speaker_terms = new Set(recall_tokens(`${declared_speaker} ${canonical.speaker}`));
    const terms = recall_tokens(`${canonical.body} ${node.content.summary}`).filter((term) => !speaker_terms.has(term));
    const frequencies = new Map<string, number>();
    for (const term of terms) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
    const document = { terms, frequencies, length: terms.length, speaker_terms };
    document_cache.set(node, document);
    return document;
}

export function strict_recall_document(node: HydroNode): StrictRecallDocument {
    const cached = strict_document_cache.get(node);
    if (cached) return cached;
    const terms = new Set(strict_recall_tokens(
        `${node.content.canonical_text ?? node.content.canonical} ${node.content.summary} ${node.content.transliteration ?? ''}`,
    ));
    const document = { terms };
    strict_document_cache.set(node, document);
    return document;
}

export function subject_recall_document(node: HydroNode): SubjectRecallDocument {
    const cached = subject_document_cache.get(node);
    if (cached) return cached;
    const document = { terms: new Set(strict_recall_tokens(`${node.content.canonical} ${node.content.summary}`)) };
    subject_document_cache.set(node, document);
    return document;
}

export function recall_vector(vector: readonly number[] | null): RecallVector | null {
    if (!vector?.length) return null;
    const cached = vector_cache.get(vector);
    if (cached) return cached;
    const values = Array.from(vector);
    let squared = 0;
    for (let index = 0; index < values.length; index++) squared += values[index] * values[index];
    const prepared = { values, norm: Math.sqrt(squared) };
    vector_cache.set(vector, prepared);
    return prepared;
}

export function prepare_recall_node(node: HydroNode): void {
    recall_document(node);
    strict_recall_document(node);
    subject_recall_document(node);
    recall_vector(node.vectors.semantic);
}