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
 *  file  : src/core/recall/subject_relevance.ts
 *  usage : implements the LongMemory subject relevance component
 */

import type { HydroNode } from '../types/hydro_node.js';
import { strict_recall_tokens, subject_recall_document } from './recall_text.js';

const stopwords = new Set([
    'what', 'who', 'when', 'where', 'which', 'do', 'does', 'did', 'i', 'is', 'are',
    'was', 'were', 'the', 'a', 'an', 'of', 'to', 'my', 'me', 'in', 'on', 'at', 'and', 'or',
]);

export type SubjectRelevanceQuery = {
    meaningful_terms: readonly string[];
    entity_terms: readonly (readonly string[])[];
};

export function prepare_subject_relevance(terms: readonly string[], entities: readonly string[]): SubjectRelevanceQuery {
    return {
        meaningful_terms: terms.filter((term) => !stopwords.has(term)),
        entity_terms: entities.map((entity) => strict_recall_tokens(entity)),
    };
}

export function is_subject_relevant(node: HydroNode, query: SubjectRelevanceQuery): boolean {
    if (query.meaningful_terms.length === 0 && query.entity_terms.length === 0) return true;
    const node_terms = subject_recall_document(node).terms;
    for (const term of query.meaningful_terms) if (node_terms.has(term)) return true;
    for (const parts of query.entity_terms) {
        if (parts.length > 0 && parts.every((part) => node_terms.has(part))) return true;
    }
    return false;
}