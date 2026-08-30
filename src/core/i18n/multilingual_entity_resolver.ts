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
 *  file  : src/core/i18n/multilingual_entity_resolver.ts
 *  usage : implements the LongMemory multilingual entity resolver component
 */

import { context_overlap, normalize_name } from '../resolver/entity_score.js';
import type { EntityResolver, ResolveResult } from '../resolver/entity_resolver.js';
import type { EntityMention } from '../types/entity.js';
import { detect_language } from './language_detection.js';
import { transliterate } from './transliteration.js';

const metadata_context = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export function resolve_multilingual_entity(resolver: EntityResolver, input: EntityMention): ResolveResult {
    const direct = resolver.canonical_id_for(input.name);
    if (direct) return resolver.resolve(input);
    const language = detect_language(input.name).language;
    const transliteration = transliterate(input.name, language);
    if (transliteration && transliteration.confidence >= 0.7) {
        const alias_id = resolver.canonical_id_for(transliteration.text);
        const entity = alias_id ? resolver.get_entity(alias_id) : undefined;
        if (entity) {
            const explicit_alias = entity.aliases.some((alias) => normalize_name(alias) === normalize_name(transliteration.text));
            const overlap = context_overlap(input.context, metadata_context(entity.metadata.context));
            const opted_in = input.metadata?.allow_transliteration_match === true;
            if (explicit_alias || overlap >= 0.25 || opted_in) {
                const resolved = resolver.resolve({
                    ...input,
                    name: transliteration.text,
                    aliases: [...new Set([...(input.aliases ?? []), input.name])],
                    metadata: { ...input.metadata, original_name: input.name, original_language: language, transliteration_confidence: transliteration.confidence },
                });
                if (resolved.action === 'resolved') resolver.add_alias(resolved.entity.id, input.name);
                return resolved;
            }
        }
    }
    return resolver.resolve({
        ...input,
        metadata: {
            ...input.metadata,
            language,
            transliteration: transliteration?.text ?? null,
            transliteration_confidence: transliteration?.confidence ?? 0,
        },
    });
}

export class multilingual_entity_resolver {
    constructor(readonly resolver: EntityResolver) {}
    resolve(input: EntityMention): ResolveResult { return resolve_multilingual_entity(this.resolver, input); }
}