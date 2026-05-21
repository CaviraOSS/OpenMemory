import type { BenchmarkDefinition } from "../types";

export const longMemEval: BenchmarkDefinition = {
  id: "longmemeval",
  name: "LongMemEval",
  source: "LongMemEval memory QA tasks",
  task: "Inject long multi-session context once, then answer multiple recall, update, temporal, and abstention questions.",
  default_split: "longmemeval_s",
  capabilities: [
    "information_extraction",
    "long_range_recall",
    "multi_session_reasoning",
    "temporal_reasoning",
    "knowledge_updates",
    "abstention",
  ],
};
