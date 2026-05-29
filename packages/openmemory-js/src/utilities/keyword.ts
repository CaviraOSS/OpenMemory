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

import { canonical_tokens_from_text } from "./text";

export function extractKeywords(text: string, minLength = 3): Set<string> {
  const tokens = canonical_tokens_from_text(text);
  const keywords = new Set<string>();

  for (const token of tokens) {
    if (token.length < minLength) continue;
    keywords.add(token);
    if (token.length >= 3) {
      for (let i = 0; i <= token.length - 3; i++) {
        keywords.add(token.slice(i, i + 3));
      }
    }
  }

  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]}_${tokens[i + 1]}`;
    if (bigram.length >= minLength) keywords.add(bigram);
  }

  for (let i = 0; i < tokens.length - 2; i++) {
    keywords.add(`${tokens[i]}_${tokens[i + 1]}_${tokens[i + 2]}`);
  }

  return keywords;
}

export function computeKeywordOverlap(
  queryKeywords: Set<string>,
  contentKeywords: Set<string>,
): number {
  let matches = 0;
  let totalWeight = 0;

  for (const keyword of queryKeywords) {
    const weight = keyword.includes("_") ? 2 : 1;
    if (contentKeywords.has(keyword)) matches += weight;
    totalWeight += weight;
  }

  return totalWeight === 0 ? 0 : matches / totalWeight;
}

export function computeLexicalScore(query: string, content: string): number {
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedContent = content.toLowerCase();
  const phraseScore =
    normalizedQuery && normalizedContent.includes(normalizedQuery) ? 1 : 0;
  const overlap = computeKeywordOverlap(
    extractKeywords(query),
    extractKeywords(content),
  );
  return Math.max(phraseScore, overlap);
}
