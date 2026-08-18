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
 *  file  : src/core/i18n/language_detection.ts
 *  usage : multilingual and code-switch language detection
 */

import { detect_script, script_of_character, type script_detection, type script_name } from './script_detection.js';

export type language_code = 'en' | 'hi' | 'te' | 'ta' | 'bn' | 'ur' | 'ar' | 'es' | 'fr' | 'de' | 'nl' | 'fi' | 'zh' | 'ja' | 'ko' | 'ru' | 'pt' | 'mixed' | 'und';

export type language_detection = {
    language: language_code;
    confidence: number;
    alternatives: Array<{ language: language_code; confidence: number }>;
    script: script_name;
};

export type code_switch_segment = {
    text: string;
    start: number;
    end: number;
    language: language_code;
    script: script_name;
    confidence: number;
};

const lexical: Partial<Record<language_code, Set<string>>> = {
    en: new Set(['the', 'is', 'are', 'what', 'which', 'for', 'with', 'user', 'prefer', 'likes', 'language', 'backend', 'project']),
    es: new Set(['el', 'la', 'los', 'las', 'que', 'para', 'con', 'usuario', 'prefiere', 'idioma', 'proyecto']),
    fr: new Set(['le', 'la', 'les', 'que', 'pour', 'avec', 'utilisateur', 'préfère', 'langue', 'projet']),
    de: new Set(['der', 'die', 'das', 'und', 'für', 'mit', 'benutzer', 'bevorzugt', 'sprache', 'projekt']),
    nl: new Set(['de', 'het', 'een', 'voor', 'met', 'gebruiker', 'voorkeur', 'taal', 'project']),
    fi: new Set(['ja', 'on', 'että', 'varten', 'kanssa', 'käyttäjä', 'suosii', 'kieli', 'projekti']),
    pt: new Set(['o', 'a', 'os', 'as', 'para', 'com', 'usuário', 'prefere', 'idioma', 'projeto']),
};

const script_language: Partial<Record<script_name, language_code>> = {
    Devanagari: 'hi', Telugu: 'te', Tamil: 'ta', Bengali: 'bn', Hangul: 'ko', Cyrillic: 'ru',
};

const words = (text: string) => text.toLocaleLowerCase().match(/\p{Letter}+/gu) ?? [];

const arabic_language = (text: string): language_code => /[ٹڈڑںھہےۓپچژگک]/u.test(text) || /\b(ہے|کے|میں|اور|مجھے)\b/u.test(text) ? 'ur' : 'ar';
const cjk_language = (text: string): language_code => /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text) ? 'ja' : /\p{Script=Hangul}/u.test(text) ? 'ko' : 'zh';

export function assign_language_confidence(text: string, language: language_code, detected?: script_detection): number {
    if (!text.trim() || language === 'und') return 0;
    const script = detected ?? detect_script(text);
    if (language === 'mixed') return Math.min(0.99, 0.6 + script.scripts.filter((item) => item.ratio >= 0.15).length * 0.1);
    if (script_language[script.script] === language) return Math.max(0.85, script.confidence);
    if ((language === 'ar' || language === 'ur') && script.scripts.some((item) => item.script === 'Arabic')) return 0.9;
    if (['zh', 'ja', 'ko'].includes(language) && script.scripts.some((item) => ['Han', 'Hiragana', 'Katakana', 'Hangul'].includes(item.script))) return 0.9;
    const dictionary = lexical[language];
    if (!dictionary) return 0.55;
    const tokens = words(text);
    const hits = tokens.filter((token) => dictionary.has(token)).length;
    return Math.min(0.95, 0.5 + hits / Math.max(4, tokens.length));
}

export function detect_language(text: string, detected?: script_detection): language_detection {
    const script = detected ?? detect_script(text);
    const significant = script.scripts.filter((item) => item.ratio >= 0.15).map((item) => item.script);
    if (significant.length > 1 && significant.some((item) => item !== 'Latin')) {
        const grouped = new Map<language_code, number>();
        for (const item of significant) {
            const language = script_language[item] ?? (item === 'Arabic' ? arabic_language(text) : item === 'Han' || item === 'Hiragana' || item === 'Katakana' ? cjk_language(text) : 'en');
            grouped.set(language, (grouped.get(language) ?? 0) + (script.scripts.find((entry) => entry.script === item)?.ratio ?? 0));
        }
        const alternatives = [...grouped.entries()].map(([language, confidence]) => ({ language, confidence })).sort((left, right) => right.confidence - left.confidence);
        if (alternatives.length === 1) return { language: alternatives[0].language, confidence: Math.max(0.85, alternatives[0].confidence), alternatives, script: script.script };
        return { language: 'mixed', confidence: assign_language_confidence(text, 'mixed', script), alternatives, script: script.script };
    }
    let language: language_code = script_language[script.script] ?? 'und';
    if (script.script === 'Arabic') language = arabic_language(text);
    else if (['Han', 'Hiragana', 'Katakana', 'Hangul'].includes(script.script)) language = cjk_language(text);
    else if (script.script === 'Latin' || script.script === 'Unknown') {
        const tokens = words(text);
        const scores = Object.entries(lexical).map(([code, dictionary]) => ({ language: code as language_code, score: tokens.filter((token) => dictionary?.has(token)).length }));
        scores.sort((left, right) => right.score - left.score);
        language = scores[0]?.score ? scores[0].language : 'en';
        const alternatives = scores.filter((item) => item.score > 0).slice(0, 3).map((item) => ({ language: item.language, confidence: Math.min(0.9, 0.45 + item.score / Math.max(4, tokens.length)) }));
        return { language, confidence: assign_language_confidence(text, language, script), alternatives, script: script.script };
    }
    const confidence = assign_language_confidence(text, language, script);
    return { language, confidence, alternatives: [{ language, confidence }], script: script.script };
}

const segment_language = (text: string, script: script_name): language_detection => {
    if (script === 'Latin') return detect_language(text);
    const language = script_language[script] ?? (script === 'Arabic' ? arabic_language(text) : ['Han', 'Hiragana', 'Katakana', 'Hangul'].includes(script) ? cjk_language(text) : 'und');
    return { language, confidence: assign_language_confidence(text, language), alternatives: [], script };
};

export function detect_code_switching(text: string): code_switch_segment[] {
    const segments: code_switch_segment[] = [];
    let start = 0;
    let current: script_name | null = null;
    const flush = (end: number) => {
        if (current === null || end <= start) return;
        const value = text.slice(start, end);
        if (!value.trim()) return;
        const detected = segment_language(value, current);
        segments.push({ text: value, start, end, language: detected.language, script: current, confidence: detected.confidence });
    };
    const characters = [...text];
    let offset = 0;
    for (const character of characters) {
        const script = script_of_character(character);
        const next: script_name | null = script === 'Common' ? current : script;
        if (current === null) {
            current = next ?? 'Common';
            start = offset;
        } else if (next && next !== current && script !== 'Common') {
            flush(offset);
            start = offset;
            current = next;
        }
        offset += character.length;
    }
    flush(text.length);
    if (segments.length <= 1) return segments;
    return segments.filter((segment) => segment.text.trim());
}

export { detect_language as detectLanguage, detect_code_switching as detectCodeSwitching, assign_language_confidence as assignLanguageConfidence };