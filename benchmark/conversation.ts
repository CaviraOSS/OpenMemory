import { chunkText } from "./text";
import type { BenchmarkSample, ConversationContext } from "./types";

export interface CreateConversationOptions {
  chunkSize: number;
}

export function createConversation(
  samples: BenchmarkSample[],
  options: CreateConversationOptions,
): ConversationContext[] {
  return samples.map((sample) => ({
    id: sample.id,
    chunks: chunkText(sample.context, options.chunkSize),
    query_answer_pairs: sample.queries,
    sample,
  }));
}
