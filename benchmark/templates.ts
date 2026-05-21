import type { AgentConfig, BenchmarkQuery, BenchmarkSample, DatasetConfig } from "./types";

type TemplateKind = "memorize" | "query" | "system";

const DEFAULT_SYSTEM =
  "You are a memory benchmark agent. Answer from the provided memory only. If the answer is not present, abstain.";

const SYSTEM_BY_BENCHMARK: Record<string, string> = {
  longmemeval:
    "Answer long-term memory questions from prior sessions. Respect temporal updates and abstain when the memory does not contain the answer.",
  "longmemeval-v2":
    "Answer agent-environment memory questions from accumulated experience. Track state, workflow knowledge, gotchas, and changed premises.",
  locomo:
    "Answer long conversation memory questions. Use temporal and causal details from the dialogue history.",
  tremu:
    "Answer temporal reasoning questions from multi-session dialogue. Distinguish current truth from historical truth.",
};

export interface TemplateInput {
  agent: AgentConfig;
  dataset: DatasetConfig;
  sample: BenchmarkSample;
  query?: BenchmarkQuery;
  chunk?: string;
}

export function renderTemplate(kind: TemplateKind, input: TemplateInput): string {
  if (kind === "system") {
    return SYSTEM_BY_BENCHMARK[input.dataset.benchmark_id] ?? DEFAULT_SYSTEM;
  }

  if (kind === "memorize") {
    return renderMemorize(input);
  }

  if (!input.query) {
    throw new Error("query template requires a query");
  }
  return renderQuery(input);
}

function renderMemorize(input: TemplateInput): string {
  const chunk = input.chunk ?? "";
  if (input.agent.adapter === "openmemory_http") {
    return chunk;
  }
  return `Memorize the following context chunk for later questions.\n\n${chunk}`;
}

function renderQuery(input: TemplateInput): string {
  const query = input.query;
  const source = query.source ?? input.sample.metadata?.source;
  const details = [
    query.type ? `Question type: ${query.type}` : null,
    query.timestamp || query.date
      ? `Question date: ${query.timestamp ?? query.date}`
      : null,
    source ? `Source: ${String(source)}` : null,
    query.previous_events?.length
      ? `Previous events:\n${query.previous_events.join("\n")}`
      : null,
  ].filter(Boolean);

  return [
    details.join("\n"),
    `Now Answer the Question:\n${query.question}`,
    "Answer:",
  ]
    .filter(Boolean)
    .join("\n\n");
}
