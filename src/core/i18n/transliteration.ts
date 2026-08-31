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
 *  file  : src/core/i18n/transliteration.ts
 *  usage : implements the LongMemory transliteration component
 */


import type { language_code } from './language_detection.js';
import { script_of_character } from './script_detection.js';

export type transliteration_result = { text: string; confidence: number; scheme: string };

const phrases: Record<string, string> = {
    'नरेंद्र मोदी': 'narendra modi',
    'नरेन्द्र मोदी': 'narendra modi',
    'మోదీ': 'modi',
    'మోడీ': 'modi',
    'سمر خان': 'samar khan',
    'ثمر خان': 'samar khan',
};

const cyrillic: Record<string, string> = Object.fromEntries([...`абвгдеёжзийклмнопрстуфхцчшщъыьэюя`].map((value, index) => [value, ['a','b','v','g','d','e','yo','zh','z','i','y','k','l','m','n','o','p','r','s','t','u','f','h','ts','ch','sh','sch','','y','','e','yu','ya'][index]]));
const arabic: Record<string, string> = { ا:'a',أ:'a',إ:'i',آ:'aa',ب:'b',ت:'t',ث:'th',ج:'j',ح:'h',خ:'kh',د:'d',ذ:'dh',ر:'r',ز:'z',س:'s',ش:'sh',ص:'s',ض:'d',ط:'t',ظ:'z',ع:"'",غ:'gh',ف:'f',ق:'q',ك:'k',ک:'k',گ:'g',ل:'l',م:'m',ن:'n',ں:'n',ه:'h',ہ:'h',و:'w',ؤ:'u',ي:'y',ی:'y',ى:'a',ے:'e',پ:'p',چ:'ch',ژ:'zh',ڑ:'r',ٹ:'t',ڈ:'d' };

const map_characters = (text: string, map: Record<string, string>) => [...text.toLocaleLowerCase()].map((character) => map[character] ?? character).join('').replace(/\s+/g, ' ').trim();

export function transliterate(text: string, language: language_code = 'und'): transliteration_result | null {
    const exact = phrases[text.trim()];
    if (exact) return { text: exact, confidence: 0.99, scheme: 'longmemory-curated' };
    if (/\p{Script=Cyrillic}/u.test(text)) return { text: map_characters(text, cyrillic), confidence: 0.82, scheme: 'iso-like-cyrillic' };
    if (/\p{Script=Arabic}/u.test(text)) return { text: map_characters(text, arabic), confidence: language === 'ur' ? 0.72 : 0.78, scheme: 'buckwalter-like' };
    if (/\p{Script=Latin}/u.test(text) && [...text].every((character) => ['Latin', 'Common'].includes(script_of_character(character)))) return { text: text.toLocaleLowerCase(), confidence: 1, scheme: 'identity-latin' };
    return null;
}

export const transliteration_aliases = (values: string[], language: language_code): string[] => [...new Set(values.flatMap((value) => {
    const result = transliterate(value, language);
    return result && result.text.toLocaleLowerCase() !== value.toLocaleLowerCase() ? [result.text] : [];
}))];