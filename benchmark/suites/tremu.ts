import type { BenchmarkDefinition } from "../types";

export const tremu: BenchmarkDefinition = {
  id: "tremu",
  name: "TReMu",
  source: "Temporal reasoning over multi-session dialogue",
  task: "Answer time-aware memory questions where valid time and recorded time matter.",
  default_split: "tremu",
  capabilities: [
    "temporal_reasoning",
    "bitemporal_recall",
    "multi_session_reasoning",
    "long_range_recall",
  ],
};
