import type { BenchmarkDefinition } from "../types";

export const longMemEvalV2: BenchmarkDefinition = {
  id: "longmemeval-v2",
  name: "LongMemEval-V2",
  source: "LongMemEval-V2 agent-environment memory tasks",
  task: "Track evolving agent state, workflow details, gotchas, and premise changes across environment interactions.",
  default_split: "longmemeval_v2",
  capabilities: [
    "agent_state_tracking",
    "workflow_memory",
    "knowledge_updates",
    "multi_session_reasoning",
    "long_range_recall",
  ],
};
