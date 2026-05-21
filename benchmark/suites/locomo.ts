import type { BenchmarkDefinition } from "../types";

export const locomo: BenchmarkDefinition = {
  id: "locomo",
  name: "LoCoMo",
  source: "Long conversation memory benchmark",
  task: "Recall facts, events, and causal links from long-running conversations.",
  default_split: "locomo",
  capabilities: [
    "long_range_recall",
    "causal_dialogue_memory",
    "multi_session_reasoning",
    "temporal_reasoning",
  ],
};
