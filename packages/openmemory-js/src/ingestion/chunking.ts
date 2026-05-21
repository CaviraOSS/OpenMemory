export type CandidateTextChunk = {
  index: number;
  text: string;
  start: number;
  end: number;
  estimated_tokens: number;
};

const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export function chunkTextForCandidates(
  text: string,
  options: { target_chars?: number } = {},
): CandidateTextChunk[] {
  const targetChars = Math.max(32, Math.floor(options.target_chars || 3000));
  if (text.length <= targetChars) {
    return [
      {
        index: 0,
        text,
        start: 0,
        end: text.length,
        estimated_tokens: estimateTokens(text),
      },
    ];
  }

  const chunks: CandidateTextChunk[] = [];
  const paragraphs = [...text.matchAll(/[^\n]+(?:\n\n+|$)/g)];
  let current = "";
  let start = 0;

  const push = () => {
    if (!current) return;
    chunks.push({
      index: chunks.length,
      text: current.replace(/\n\n+$/, ""),
      start,
      end: start + current.replace(/\n\n+$/, "").length,
      estimated_tokens: estimateTokens(current),
    });
    start += current.length;
    current = "";
  };

  for (const match of paragraphs) {
    const part = match[0];
    if (current && current.length + part.length > targetChars) push();
    if (part.length <= targetChars) {
      current += part;
      continue;
    }

    push();
    let offset = match.index || 0;
    for (let i = 0; i < part.length; i += targetChars) {
      const slice = part.slice(i, i + targetChars);
      chunks.push({
        index: chunks.length,
        text: slice,
        start: offset + i,
        end: offset + i + slice.length,
        estimated_tokens: estimateTokens(slice),
      });
    }
    start = offset + part.length;
  }
  push();
  return chunks;
}
