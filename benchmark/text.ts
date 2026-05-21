const sentenceBoundary = /(?<=[.!?])\s+/;

export function chunkText(text: string, maxCharacters = 4096): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) {
    return [];
  }

  const chunks: string[] = [];
  let current = "";

  for (const sentence of clean.split(sentenceBoundary)) {
    if (!sentence) {
      continue;
    }

    if (!current) {
      current = sentence;
      continue;
    }

    if (current.length + 1 + sentence.length <= maxCharacters) {
      current += ` ${sentence}`;
      continue;
    }

    chunks.push(current);
    current = sentence;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.flatMap((chunk) => splitOversizedChunk(chunk, maxCharacters));
}

export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(a|an|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitOversizedChunk(chunk: string, maxCharacters: number): string[] {
  if (chunk.length <= maxCharacters) {
    return [chunk];
  }

  const parts: string[] = [];
  for (let start = 0; start < chunk.length; start += maxCharacters) {
    parts.push(chunk.slice(start, start + maxCharacters).trim());
  }
  return parts.filter(Boolean);
}
