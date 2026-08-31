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
 *  file  : src/core/i18n/normalization.ts
 *  usage : implements the LongMemory normalization component
 */


import type { language_code } from './language_detection.js';

export type normalization_result = {
    original_text: string;
    normalized_text: string;
    canonical_text: string;
    diacritic_folded_text: string | null;
};

const punctuation = (text: string) => text
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/…/g, '...');

export function normalize_multilingual_text(text: string, language: language_code = 'und', locale?: string): normalization_result {
    const normalized_text = punctuation(text.normalize('NFC').replace(/[\u200B\uFEFF]/g, '').replace(/[\t\v\f ]+/g, ' ').replace(/\r\n?/g, '\n').replace(/ *\n */g, '\n').trim());
    const canonical_text = normalized_text.toLocaleLowerCase(locale ?? (language === 'und' || language === 'mixed' ? undefined : language)).normalize('NFC');
    const diacritic_folded_text = /\p{Script=Latin}/u.test(canonical_text)
        ? canonical_text.normalize('NFD').replace(/\p{Mark}+/gu, '').normalize('NFC')
        : null;
    return { original_text: text, normalized_text, canonical_text, diacritic_folded_text };
}

export { normalize_multilingual_text as normalizeMultilingualText };