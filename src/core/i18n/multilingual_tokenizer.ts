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
 *  file  : src/core/i18n/multilingual_tokenizer.ts
 *  usage : implements the LongMemory multilingual tokenizer component
 */


import { detect_language, type language_code } from './language_detection.js';
import { detect_script, type script_name } from './script_detection.js';

export type multilingual_token = { value: string; start: number; end: number; language: language_code; script: script_name };

const cjk_pattern = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|[\p{Script=Latin}\p{Number}_+#.-]+/gu;
const default_pattern = /[\p{Letter}\p{Mark}\p{Number}_+#.-]+/gu;

function resolve(text: string, language?: language_code, script?: script_name): { language: language_code; script: script_name } {
    if (language !== undefined && script !== undefined) return { language, script };
    const detected = detect_script(text);
    return { language: language ?? detect_language(text, detected).language, script: script ?? detected.script };
}

function pattern_for(language: language_code, script: script_name): RegExp {
    const cjk = language === 'zh' || language === 'ja' || language === 'ko'
        || script === 'Han' || script === 'Hiragana' || script === 'Katakana' || script === 'Hangul';
    return cjk ? cjk_pattern : default_pattern;
}

export function tokenize(text: string, language?: language_code, script?: script_name): multilingual_token[] {
    const resolved = resolve(text, language, script);
    const pattern = pattern_for(resolved.language, resolved.script);
    pattern.lastIndex = 0;
    const tokens: multilingual_token[] = [];
    for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
        tokens.push({ value: match[0].toLocaleLowerCase(), start: match.index, end: match.index + match[0].length, language: resolved.language, script: resolved.script });
    }
    return tokens;
}

export function count_multilingual_tokens(text: string, language?: language_code, script?: script_name): number {
    const resolved = resolve(text, language, script);
    const pattern = pattern_for(resolved.language, resolved.script);
    pattern.lastIndex = 0;
    let count = 0;
    while (pattern.exec(text) !== null) count++;
    return count;
}