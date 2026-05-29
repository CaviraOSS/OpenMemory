/*
   ____                   __  __                                 
  / __ \                 |  \/  |                                
 | |  | |_ __   ___ _ __ | \  / | ___ _ __ ___   ___  _ __ _   _ 
 | |  | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 | |__| | |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
  \____/| .__/ \___|_| |_|_|  |_|\___|_| |_| |_|\___/|_|   \__, |
        | |                                                 __/ |
        |_|                                                |___/ 
  CaviraOSS @ 2026

 - filename
 - what is the file used for
*/

export type DetectedLanguage = {
  language: string;
  script: string;
  confidence: number;
};

const countMatches = (text: string, pattern: RegExp) =>
  Array.from(text.matchAll(pattern)).length;

export function detectTextLanguage(text: string): DetectedLanguage {
  const sample = text || "";
  const counts = {
    hangul: countMatches(sample, /[\uac00-\ud7af]/gu),
    kana: countMatches(sample, /[\u3040-\u30ff]/gu),
    han: countMatches(sample, /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/gu),
    arabic: countMatches(sample, /[\u0600-\u06ff]/gu),
    devanagari: countMatches(sample, /[\u0900-\u097f]/gu),
    cyrillic: countMatches(sample, /[\u0400-\u04ff]/gu),
    latin: countMatches(sample, /[a-z]/giu),
  };
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (!total) return { language: "unknown", script: "unknown", confidence: 0 };

  if (counts.hangul > 0) {
    return {
      language: "ko",
      script: "hangul",
      confidence: counts.hangul / total,
    };
  }
  if (counts.kana > 0) {
    return {
      language: "ja",
      script: "kana",
      confidence: (counts.kana + counts.han) / total,
    };
  }
  if (counts.han > 0) {
    return { language: "zh", script: "han", confidence: counts.han / total };
  }
  if (counts.arabic > 0) {
    return {
      language: "ar",
      script: "arabic",
      confidence: counts.arabic / total,
    };
  }
  if (counts.devanagari > 0) {
    return {
      language: "hi",
      script: "devanagari",
      confidence: counts.devanagari / total,
    };
  }
  if (counts.cyrillic > 0) {
    return {
      language: "ru",
      script: "cyrillic",
      confidence: counts.cyrillic / total,
    };
  }
  if (counts.latin > 0) {
    return {
      language: "en",
      script: "latin",
      confidence: counts.latin / total,
    };
  }

  return { language: "unknown", script: "unknown", confidence: 0 };
}
