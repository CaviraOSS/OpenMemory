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
 *  file  : src/core/i18n/locale_context.ts
 *  usage : implements the LongMemory locale context component
 */


import type { language_code } from './language_detection.js';
import type { script_name, text_direction } from './script_detection.js';

export type locale_context = { locale: string; language: language_code; script: script_name; region: string | null; direction: text_direction; cultural_context: Record<string, unknown> };

const default_locales: Partial<Record<language_code, string>> = {
    en:'en-US', hi:'hi-IN', te:'te-IN', ta:'ta-IN', bn:'bn-IN', ur:'ur-PK', ar:'ar-SA', es:'es-ES', fr:'fr-FR', de:'de-DE', nl:'nl-NL', fi:'fi-FI', zh:'zh-CN', ja:'ja-JP', ko:'ko-KR', ru:'ru-RU', pt:'pt-BR',
};

export function create_locale_context(language: language_code, script: script_name, locale?: string, direction: text_direction = script === 'Arabic' ? 'rtl' : 'ltr'): locale_context {
    const resolved = locale ?? default_locales[language] ?? 'und';
    const region = resolved.includes('-') ? resolved.split('-')[1] : null;
    return { locale: resolved, language, script, region, direction, cultural_context: {} };
}