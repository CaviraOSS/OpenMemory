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
 *  file  : src/core/i18n/crosslingual_recall.ts
 *  usage : implements the LongMemory crosslingual recall component
 */


import type { long_memory, public_recall_query } from '../create_memory.js';
import type { HydroNode } from '../types/hydro_node.js';
import type { language_code } from './language_detection.js';
import { count_multilingual_tokens } from './multilingual_tokenizer.js';

export type translation_result = { text: string; confidence: number; provider?: string; model?: string };
export type translation_provider = {
    name?: string;
    translate(text: string, from: language_code, to: language_code): translation_result | Promise<translation_result>;
};

export type crosslingual_recall_query = public_recall_query & {
    output_language?: language_code;
    enable_translation?: boolean;
    translation_confidence_threshold?: number;
};

export type crosslingual_context_item = {
    node: HydroNode;
    original_text: string;
    display_text: string;
    language: language_code;
    output_language: language_code;
    translation_used: boolean;
    translation_confidence: number | null;
    translation_provenance: HydroNode['content']['translation_provenance'];
    provenance: HydroNode['provenance'];
};

export type crosslingual_recall_result = {
    items: crosslingual_context_item[];
    context: {
        text: string;
        items: crosslingual_context_item[];
        tokens_used: number;
        budget: number;
        within_budget: boolean;
    };
    original_result: unknown;
    query_language: language_code;
    output_language: language_code;
};

const nodes_from_result = (result: any): HydroNode[] => {
    if (Array.isArray(result?.items)) return result.items.map((item: any) => item.node).filter(Boolean);
    if (Array.isArray(result?.timeline?.entries)) return result.timeline.entries.map((item: any) => item.node).filter(Boolean);
    return [];
};

export async function format_crosslingual_recall(
    original_result: unknown,
    query: crosslingual_recall_query,
    options: {
        query_language: language_code;
        output_language: language_code;
        translation_provider?: translation_provider;
        enable_translation: boolean;
    },
): Promise<crosslingual_recall_result> {
    const threshold = query.translation_confidence_threshold ?? 0.7;
    const budget = query.token_budget ?? Number.POSITIVE_INFINITY;
    const items: crosslingual_context_item[] = [];
    let tokens_used = 0;
    for (const node of nodes_from_result(original_result)) {
        const language = node.content.language ?? 'und';
        const original_text = node.content.original_text ?? node.content.raw;
        let display_text = original_text;
        let translation_used = false;
        let translation_confidence: number | null = null;
        let translation_provenance = node.content.translation_provenance ?? null;
        const may_translate = options.enable_translation && query.enable_translation !== false && options.translation_provider &&
            language !== options.output_language && node.contract.translation_allowed && !node.contract.preserve_exact_language;
        if (may_translate) {
            if (node.content.translated_text && translation_provenance?.target_language === options.output_language && translation_provenance.confidence >= threshold) {
                display_text = node.content.translated_text;
                translation_confidence = translation_provenance.confidence;
                translation_used = true;
            } else {
                const translated = await options.translation_provider!.translate(original_text, language, options.output_language);
                translation_confidence = translated.confidence;
                if (translated.confidence >= threshold) {
                    display_text = translated.text;
                    translation_used = true;
                    translation_provenance = {
                        provider: translated.provider ?? options.translation_provider!.name ?? 'translation-provider',
                        target_language: options.output_language,
                        confidence: translated.confidence,
                        derived_at: Date.now(),
                        source_text_hash: node.content_hash,
                    };
                }
            }
        }
        const cost = count_multilingual_tokens(display_text, translation_used ? options.output_language : language, node.content.script);
        if (tokens_used + cost > budget) continue;
        tokens_used += cost;
        items.push({ node, original_text, display_text, language, output_language: options.output_language, translation_used, translation_confidence, translation_provenance, provenance: node.provenance });
    }
    return {
        items,
        context: { text: items.map((item) => `- ${item.display_text}`).join('\n'), items, tokens_used, budget, within_budget: tokens_used <= budget },
        original_result,
        query_language: options.query_language,
        output_language: options.output_language,
    };
}

export async function crosslingual_recall(memory: long_memory, query: crosslingual_recall_query, options: { query_language: language_code; output_language: language_code; translation_provider?: translation_provider; enable_translation?: boolean }): Promise<crosslingual_recall_result> {
    const result = await memory.recall(query);
    return format_crosslingual_recall(result, query, { ...options, enable_translation: options.enable_translation ?? false });
}