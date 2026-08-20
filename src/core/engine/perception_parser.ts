/*
 *   _____                 ___  ___
 *  |  _  |                |  \/  |
 *  | | | |_ __   ___ _ __ | .  . | ___ _ __ ___   ___  _ __ _   _
 *  | | | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 *  \ \_/ / |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
 *   \___/| .__/ \___|_| |_\_|  |_/\___|_| |_| |_|\___/|_|   \__, |
 *        | |                                                 __/ |
 *        |_|                                                |___/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/core/engine/perception_parser.ts
 *  usage : parse raw ingest events into cognitive observations
 */

import type { GroundingSource } from '../grounding/exocortex.js';
import type { Contract } from '../types/contract.js';
import type { EntityMention, EntityType } from '../types/entity.js';
import type { FacetName } from '../types/facets.js';
import type { Zone } from '../types/hydro_node.js';
import { extract_claims, type ExtractedClaim } from './claim_extractor.js';
import { detect_code_switching, detect_language, type code_switch_segment, type language_code } from '../i18n/language_detection.js';
import { create_locale_context } from '../i18n/locale_context.js';
import { normalize_multilingual_text, type normalization_result } from '../i18n/normalization.js';
import { detect_script, type script_detection } from '../i18n/script_detection.js';
import { transliterate, transliteration_aliases } from '../i18n/transliteration.js';

export type MemoryEvent = {
    id?: string;
    user_id: string;
    text: string;
    speaker?: string;
    conversation_id?: string;
    at?: number;
    observed_at?: number;
    valid_from?: number;
    valid_to?: number | null;
    world?: string;
    world_id?: string;
    tags?: string[];
    vector?: number[] | null;
    zone?: Zone;
    external?: boolean;
    source?: GroundingSource;
    source_ref?: string;
    grounding_ref?: string;
    facet_hint?: FacetName;
    entity_hints?: EntityMention[];
    contract?: Partial<Contract>;
    metadata?: Record<string, unknown>;
    conflict_behavior?: 'auto' | 'supersede' | 'contradict' | 'none';
    language?: language_code;
    locale?: string;
    translated_text?: string | null;
    translation_provenance?: {
        provider: string;
        target_language: language_code;
        confidence: number;
        derived_at: number;
        source_text_hash: string;
    } | null;
    transliteration?: string | null;
    enable_transliteration?: boolean;
};

export type ParsedPerception = {
    event: MemoryEvent;
    text: string;
    at: number;
    observed_at: number;
    valid_from: number;
    valid_to: number | null;
    entities: EntityMention[];
    claims: ExtractedClaim[];
    preferences: string[];
    actions: string[];
    procedures: string[];
    emotions: string[];
    reflections: string[];
    possible_external_facts: string[];
    zone: Zone;
    multilingual: {
        language: language_code;
        language_confidence: number;
        script: script_detection;
        original_text: string;
        normalization: normalization_result;
        translated_text: string | null;
        translation_provenance: MemoryEvent['translation_provenance'];
        transliteration: string | null;
        locale: string;
        code_switch_segments: code_switch_segment[];
    };
};

const entity_re = /\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+|[A-Z]\.[ ]?[A-Z][a-z]+|[A-Z][a-z]{2,})\b/g;
const emotion_re = /\b(afraid|anxious|angry|excited|happy|sad|proud|frustrated|delighted|fear|love|hate)\b/gi;
const action_re = /\b(?:I|we)\s+(?:ran|run|built|build|deployed|deploy|fixed|fix|installed|install|visited|moved|created|create)\b[^.!?]*/gi;
const procedure_re = /\b(?:first|then|next|finally|step|procedure|workflow|to fix|to deploy)\b[^.!?]*/gi;
const reflection_re = /\b(?:I|we)\s+(?:realized|learned|noticed|think|believe|understand|reflected)\b[^.!?]*/gi;
const preference_re = /\b(?:I|we)\s+(?:(?:now|also|really|especially|generally)\s+)*(?:prefer|like|love|dislike|hate)\b[^.!?]*/gi;

function infer_type(name: string): EntityType {
    if (/^(?:Berlin|Tokyo|Finland|Sweden|Germany|Rome|Kyoto)$/i.test(name)) return 'place';
    if (/^(?:Project|OpenMemory)/i.test(name)) return 'project';
    if (/^[A-Z]\.|\s/.test(name)) return 'person';
    return 'unknown';
}

function matches(text: string, pattern: RegExp): string[] {
    return [...text.matchAll(pattern)].map((match) => match[0].trim());
}

export function parse_perception(event: MemoryEvent, now = Date.now()): ParsedPerception {
    if (!event.user_id?.trim()) throw new Error('MemoryEvent.user_id is required');
    if (!event.text?.trim()) throw new Error('MemoryEvent.text is required');
    const at = event.at ?? now;
    const observed_at = event.observed_at ?? at;
    const valid_from = event.valid_from ?? observed_at;
    const external = event.external === true || event.zone === 'exocortex' || event.source !== undefined;
    const detected_language = detect_language(event.text);
    const language = event.language ?? detected_language.language;
    const script = detect_script(event.text);
    const locale = create_locale_context(language, script.script, event.locale, script.direction);
    const normalization = normalize_multilingual_text(event.text, language, locale.locale);
    const transliteration = event.transliteration ?? (event.enable_transliteration === false ? null : transliterate(normalization.normalized_text, language)?.text ?? null);
    const speaker = event.speaker?.trim();
    const claims = extract_claims(event.text).map((claim) => claim.subject === 'user' && speaker
        ? { ...claim, subject: speaker.toLocaleLowerCase(), topic: claim.topic.replace(/:(?:user):/i, `:${speaker.toLocaleLowerCase()}:`) }
        : claim);
    const context = event.text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    const named_speaker = speaker && !/^(?:user|assistant|system|tool|function|speaker)$/i.test(speaker) ? speaker : null;
    const names = [...new Set([...(event.text.match(entity_re) ?? []), ...(named_speaker ? [named_speaker] : [])])];
    const entities: EntityMention[] = [
        ...names.map((name) => ({ name, type: infer_type(name), context, observed_at })),
        ...(event.entity_hints ?? []).map((hint) => ({
            ...hint,
            aliases: [...new Set(hint.aliases ?? [])],
            observed_at: hint.observed_at ?? observed_at,
            metadata: { ...hint.metadata, language, script: script.script, transliteration_aliases: event.enable_transliteration === false ? [] : transliteration_aliases([hint.name, ...(hint.aliases ?? [])], language) },
        })),
    ];
    return {
        event,
        text: event.text.trim(),
        at,
        observed_at,
        valid_from,
        valid_to: event.valid_to ?? null,
        entities,
        claims,
        preferences: matches(event.text, preference_re),
        actions: matches(event.text, action_re),
        procedures: matches(event.text, procedure_re),
        emotions: matches(event.text, emotion_re),
        reflections: matches(event.text, reflection_re),
        possible_external_facts: external ? claims.map((claim) => claim.statement) : [],
        zone: external ? 'exocortex' : 'endocortex',
        multilingual: {
            language,
            language_confidence: event.language ? 1 : detected_language.confidence,
            script,
            original_text: event.text,
            normalization,
            translated_text: event.translated_text ?? null,
            translation_provenance: event.translation_provenance ?? null,
            transliteration,
            locale: locale.locale,
            code_switch_segments: detect_code_switching(event.text),
        },
    };
}