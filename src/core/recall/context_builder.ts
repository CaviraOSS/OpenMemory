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
 *  file  : src/core/recall/context_builder.ts
 *  usage : implements the LongMemory context builder component
 */


import type { HydroNode } from '../types/hydro_node.js';
import { count_multilingual_tokens } from '../i18n/multilingual_tokenizer.js';
import { memory_evidence_of, type memory_evidence } from './evidence.js';

function code_point_length(text: string): number {
    let count = 0;
    for (let index = 0; index < text.length; index++) {
        const code = text.charCodeAt(index);
        if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
            const next = text.charCodeAt(index + 1);
            if (next >= 0xdc00 && next <= 0xdfff) index++;
        }
        count++;
    }
    return count;
}

export function count_tokens(text: string): number {
    const t = (text || '').trim();
    if (!t) return 0;
    return Math.max(1, count_multilingual_tokens(t), Math.ceil(code_point_length(t) / 4));
}

const node_token_cache = new WeakMap<HydroNode, number>();

function render_node(node: HydroNode): string {
    return node.content.summary || node.content.canonical || node.content.raw;
}

function node_tokens(node: HydroNode, line: string): number {
    const cached = node_token_cache.get(node);
    if (cached !== undefined) return cached;
    const cost = count_tokens(line);
    node_token_cache.set(node, cost);
    return cost;
}

export type ContextPacket = {
    text: string;
    tokens_used: number;
    budget: number;
    items: HydroNode[];
    evidence: memory_evidence[];
    within_budget: boolean;
    bundled_items: number;
};

export type context_packet_options = {
    query_terms?: readonly string[];
    bundles?: ReadonlyMap<string, readonly HydroNode[]>;
};


export function build_context_packet(
    scored: readonly { node: HydroNode }[],
    budget: number,
    options: context_packet_options = {},
): ContextPacket {
    const items: HydroNode[] = [];
    const evidence: memory_evidence[] = [];
    const lines: string[] = [];
    let tokens_used = 0;
    let bundled_items = 0;

    for (const candidate of scored) {
        const bundle = options.bundles?.get(candidate.node.id) ?? [];
        const evidence_text = bundle.length
            ? [...bundle, candidate.node]
                .sort((left, right) => left.temporal.observed_at - right.temporal.observed_at)
                .map((node) => memory_evidence_of(node, { query_terms: options.query_terms, prefer_raw: true }).text)
                .join(' | ')
            : memory_evidence_of(candidate.node, { query_terms: options.query_terms }).text;
        const line = bundle.length ? evidence_text : render_node(candidate.node);
        const cost = bundle.length ? count_tokens(line) : node_tokens(candidate.node, line);
        if (tokens_used + cost > budget) continue;
        items.push(candidate.node);
        const item_evidence = memory_evidence_of(candidate.node, { query_terms: options.query_terms });
        evidence.push({ ...item_evidence, text: evidence_text });
        lines.push(`- ${line}`);
        tokens_used += cost;
        bundled_items += bundle.length;
    }

    return {
        text: lines.join('\n'),
        tokens_used: tokens_used,
        budget,
        items,
        evidence,
        within_budget: tokens_used <= budget,
        bundled_items,
    };
}
