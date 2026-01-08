from typing import Set, List, Dict, Any
import math
from .text import canonical_tokens_from_text
from ..core.config import env

def extract_keywords(text: str, min_length: int = 3) -> Set[str]:
    tokens = canonical_tokens_from_text(text)
    keywords = set()

    for token in tokens:
        if len(token) >= min_length:
            keywords.add(token)
            if len(token) >= 3:
                for i in range(len(token) - 2):
                    keywords.add(token[i : i+3])
    for i in range(len(tokens) - 1):
        bigram = f"{tokens[i]}_{tokens[i+1]}"
        if len(bigram) >= min_length:
            keywords.add(bigram)
    for i in range(len(tokens) - 2):
        trigram = f"{tokens[i]}_{tokens[i+1]}_{tokens[i+2]}"
        keywords.add(trigram)

    return keywords

def compute_keyword_overlap(query_keywords: Set[str], content_keywords: Set[str]) -> float:
    matches = 0.0
    total_weight = 0.0

    for qk in query_keywords:
        w = 2.0 if "_" in qk else 1.0
        if qk in content_keywords:
            matches += w
        total_weight += w

    return matches / total_weight if total_weight > 0 else 0.0

def exact_phrase_match(query: str, content: str) -> bool:
    return query.lower().strip() in content.lower()

def compute_bm25_score(
    query_terms: List[str],
    content_terms: List[str],
    corpus_size: int = 10000,
    avg_doc_length: int = 100
) -> float:
    k1 = 1.5
    b = 0.75

    term_freq = {}
    for t in content_terms:
        term_freq[t] = term_freq.get(t, 0) + 1

    doc_len = len(content_terms)
    score = 0.0

    for qt in query_terms:
        tf = term_freq.get(qt, 0)
        if tf == 0: continue

        idf = math.log((corpus_size + 1) / (tf + 0.5))
        numerator = tf * (k1 + 1)
        denominator = tf + k1 * (1 - b + b * (doc_len / avg_doc_length))

        score += idf * (numerator / denominator)

    return score

async def keyword_filter_memories(
    query: str,
    all_memories: List[Dict[str, Any]],
    threshold: float = 0.1
) -> Dict[str, float]:
    q_kw = extract_keywords(query, env.keyword_min_length if hasattr(env, 'keyword_min_length') else 3)
    q_terms = canonical_tokens_from_text(query)
    scores = {}

    for mem in all_memories:
        total = 0.0
        if exact_phrase_match(query, mem["content"]):
            total += 1.0

        c_kw = extract_keywords(mem["content"], env.keyword_min_length if hasattr(env, 'keyword_min_length') else 3)
        kw_score = compute_keyword_overlap(q_kw, c_kw)
        total += kw_score * 0.8

        c_terms = canonical_tokens_from_text(mem["content"])
        bm25 = compute_bm25_score(q_terms, c_terms)
        total += min(1.0, bm25 / 10.0) * 0.5

        if total > threshold:
            scores[mem["id"]] = total

    return scores
