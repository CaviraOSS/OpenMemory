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

export type CompressionMode = "semantic" | "syntactic" | "aggressive";

export type CompressionPreview = {
  original: string;
  compressed: string;
  mutates_storage: false;
  metrics: {
    original_tokens: number;
    compressed_tokens: number;
    saved_tokens: number;
    ratio: number;
    mode: CompressionMode;
  };
};

const estimateTokens = (text: string) =>
  text.trim()
    ? Math.ceil(text.length / 4 + text.trim().split(/\s+/).length / 2)
    : 0;

const replacements: Array<[RegExp, string]> = [
  [/\bI think that\b/gi, ""],
  [/\bI believe that\b/gi, ""],
  [/\bvery\b/gi, ""],
  [/\breally\b/gi, ""],
  [/\bdue to the fact that\b/gi, "because"],
  [/\bin order to\b/gi, "to"],
  [/\bat this point in time\b/gi, "now"],
  [/\bTypeScript\b/g, "TS"],
  [/\bJavaScript\b/g, "JS"],
  [/\bdocumentation\b/gi, "docs"],
  [/\brepository\b/gi, "repo"],
  [/\bdatabase\b/gi, "db"],
  [/\bconfiguration\b/gi, "config"],
];

const dedupeSentences = (text: string) => {
  const seen = new Set<string>();
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => {
      const key = sentence.toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(" ");
};

export function previewMemoryCompression(
  text: string,
  mode: CompressionMode = "semantic",
): CompressionPreview {
  let compressed = dedupeSentences(text);
  if (mode === "syntactic" || mode === "aggressive") {
    compressed = compressed.replace(/\bdo not\b/gi, "don't");
    compressed = compressed.replace(/\bcannot\b/gi, "can't");
  }
  if (mode === "aggressive") {
    for (const [pattern, value] of replacements) {
      compressed = compressed.replace(pattern, value);
    }
    compressed = compressed
      .replace(/https?:\/\/(www\.)?([^/\s]+)(\/[^\s]*)?/gi, "$2")
      .replace(/[*_~`#]/g, "");
  }
  compressed = compressed.replace(/\s+/g, " ").trim();

  const originalTokens = estimateTokens(text);
  const compressedTokens = estimateTokens(compressed);
  return {
    original: text,
    compressed,
    mutates_storage: false,
    metrics: {
      original_tokens: originalTokens,
      compressed_tokens: compressedTokens,
      saved_tokens: Math.max(0, originalTokens - compressedTokens),
      ratio: originalTokens ? compressedTokens / originalTokens : 1,
      mode,
    },
  };
}
