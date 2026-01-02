"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extract_keywords = extract_keywords;
exports.compute_keyword_overlap = compute_keyword_overlap;
exports.exact_phrase_match = exact_phrase_match;
exports.compute_bm25_score = compute_bm25_score;
exports.keyword_filter_memories = keyword_filter_memories;
const text_1 = require("./text");
const cfg_1 = require("../core/cfg");
function extract_keywords(text, min_length = 3) {
    const tokens = (0, text_1.canonical_tokens_from_text)(text);
    const keywords = new Set();
    for (const token of tokens) {
        if (token.length >= min_length) {
            keywords.add(token);
            if (token.length >= 3) {
                for (let i = 0; i <= token.length - 3; i++) {
                    keywords.add(token.slice(i, i + 3));
                }
            }
        }
    }
    for (let i = 0; i < tokens.length - 1; i++) {
        const bigram = `${tokens[i]}_${tokens[i + 1]}`;
        if (bigram.length >= min_length) {
            keywords.add(bigram);
        }
    }
    for (let i = 0; i < tokens.length - 2; i++) {
        const trigram = `${tokens[i]}_${tokens[i + 1]}_${tokens[i + 2]}`;
        keywords.add(trigram);
    }
    return keywords;
}
function compute_keyword_overlap(query_keywords, content_keywords) {
    let matches = 0;
    let total_weight = 0;
    for (const qk of query_keywords) {
        if (content_keywords.has(qk)) {
            const weight = qk.includes("_") ? 2.0 : 1.0;
            matches += weight;
        }
        total_weight += qk.includes("_") ? 2.0 : 1.0;
    }
    if (total_weight === 0)
        return 0;
    return matches / total_weight;
}
function exact_phrase_match(query, content) {
    const q_norm = query.toLowerCase().trim();
    const c_norm = content.toLowerCase();
    return c_norm.includes(q_norm);
}
function compute_bm25_score(query_terms, content_terms, corpus_size = 10000, avg_doc_length = 100) {
    const k1 = 1.5;
    const b = 0.75;
    const term_freq = new Map();
    for (const term of content_terms) {
        term_freq.set(term, (term_freq.get(term) || 0) + 1);
    }
    const doc_length = content_terms.length;
    let score = 0;
    for (const q_term of query_terms) {
        const tf = term_freq.get(q_term) || 0;
        if (tf === 0)
            continue;
        const idf = Math.log((corpus_size + 1) / (tf + 0.5));
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (doc_length / avg_doc_length));
        score += idf * (numerator / denominator);
    }
    return score;
}
async function keyword_filter_memories(query, all_memories, threshold = 0.1) {
    const query_keywords = extract_keywords(query, cfg_1.env.keyword_min_length);
    const query_terms = (0, text_1.canonical_tokens_from_text)(query);
    const scores = new Map();
    for (const mem of all_memories) {
        let total_score = 0;
        if (exact_phrase_match(query, mem.content)) {
            total_score += 1.0;
        }
        const content_keywords = extract_keywords(mem.content, cfg_1.env.keyword_min_length);
        const keyword_score = compute_keyword_overlap(query_keywords, content_keywords);
        total_score += keyword_score * 0.8;
        const content_terms = (0, text_1.canonical_tokens_from_text)(mem.content);
        const bm25_score = compute_bm25_score(query_terms, content_terms);
        total_score += Math.min(1.0, bm25_score / 10) * 0.5;
        if (total_score > threshold) {
            scores.set(mem.id, total_score);
        }
    }
    return scores;
}
