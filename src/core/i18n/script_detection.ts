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
 *  file  : src/core/i18n/script_detection.ts
 *  usage : implements the LongMemory script detection component
 */

export type script_name = 'Latin' | 'Devanagari' | 'Telugu' | 'Tamil' | 'Bengali' | 'Arabic' | 'Han' | 'Hiragana' | 'Katakana' | 'Hangul' | 'Cyrillic' | 'Common' | 'Mixed' | 'Unknown';
export type text_direction = 'ltr' | 'rtl' | 'mixed' | 'neutral';

export type script_detection = {
    script: script_name;
    scripts: Array<{ script: script_name; count: number; ratio: number }>;
    direction: text_direction;
    confidence: number;
};

const ranges: Array<[script_name, RegExp]> = [
    ['Latin', /\p{Script=Latin}/u],
    ['Devanagari', /\p{Script=Devanagari}/u],
    ['Telugu', /\p{Script=Telugu}/u],
    ['Tamil', /\p{Script=Tamil}/u],
    ['Bengali', /\p{Script=Bengali}/u],
    ['Arabic', /\p{Script=Arabic}/u],
    ['Hiragana', /\p{Script=Hiragana}/u],
    ['Katakana', /\p{Script=Katakana}/u],
    ['Hangul', /\p{Script=Hangul}/u],
    ['Han', /\p{Script=Han}/u],
    ['Cyrillic', /\p{Script=Cyrillic}/u],
];

function ascii_script(code: number): script_name {
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) return 'Latin';
    return code < 32 || code === 127 ? 'Unknown' : 'Common';
}

export function script_of_character(character: string): script_name {
    const code = character.charCodeAt(0);
    if (code < 128) return ascii_script(code);
    if (/^[\p{Number}\p{Punctuation}\p{Separator}\p{Symbol}\p{Mark}]$/u.test(character)) return 'Common';
    return ranges.find(([, pattern]) => pattern.test(character))?.[0] ?? 'Unknown';
}

export function detect_script(text: string): script_detection {
    let latin = 0;
    let ascii_only = true;
    for (let index = 0; index < text.length; index++) {
        const code = text.charCodeAt(index);
        if (code >= 128) {
            ascii_only = false;
            break;
        }
        if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) latin++;
    }
    if (ascii_only) {
        return latin > 0
            ? { script: 'Latin', scripts: [{ script: 'Latin', count: latin, ratio: 1 }], direction: 'ltr', confidence: 1 }
            : { script: 'Unknown', scripts: [], direction: 'neutral', confidence: 0 };
    }

    const counts = new Map<script_name, number>();
    for (const character of text) {
        const script = script_of_character(character);
        if (script === 'Common' || script === 'Unknown') continue;
        counts.set(script, (counts.get(script) ?? 0) + 1);
    }
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    const scripts = [...counts.entries()]
        .map(([script, count]) => ({ script, count, ratio: total ? count / total : 0 }))
        .sort((left, right) => right.count - left.count);
    const dominant = scripts[0];
    const significant = scripts.filter((item) => item.ratio >= 0.15);
    const script: script_name = !dominant ? 'Unknown' : significant.length > 1 ? 'Mixed' : dominant.script;
    const has_rtl = scripts.some((item) => item.script === 'Arabic');
    const has_ltr = scripts.some((item) => item.script !== 'Arabic');
    const direction: text_direction = has_rtl && has_ltr ? 'mixed' : has_rtl ? 'rtl' : has_ltr ? 'ltr' : 'neutral';
    return { script, scripts, direction, confidence: dominant?.ratio ?? 0 };
}

export { detect_script as detectScript };