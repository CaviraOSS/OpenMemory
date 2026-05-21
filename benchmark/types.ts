export type BenchmarkId = "longmemeval" | "longmemeval-v2" | "locomo" | "tremu";

export type BenchmarkCapability =
  | "abstention"
  | "agent_state_tracking"
  | "bitemporal_recall"
  | "causal_dialogue_memory"
  | "information_extraction"
  | "knowledge_updates"
  | "long_range_recall"
  | "multi_session_reasoning"
  | "temporal_reasoning"
  | "workflow_memory";

export interface BenchmarkDefinition {
  id: BenchmarkId;
  name: string;
  source: string;
  task: string;
  default_split: string;
  capabilities: BenchmarkCapability[];
}

export interface AgentConfig {
  agent_name: string;
  adapter:
    | "fixture"
    | "openmemory_http"
    | "mem0"
    | "cognee"
    | "zep"
    | "supermemory";
  output_dir: string;
  model: string;
  temperature?: number;
  input_length_limit?: number;
  buffer_length?: number;
  retrieve_num?: number;
  agent_chunk_size?: number;
  api_base_url?: string;
  api_key?: string;
  llm_provider?: "openai" | "gemini" | "siray";
  memory_api_base_url?: string;
  memory_api_key?: string;
}

export interface DatasetConfig {
  benchmark_id: BenchmarkId;
  dataset: string;
  sub_dataset: string;
  chunk_size: number;
  generation_max_length: number;
  max_test_samples: number;
  shots: number;
  debug?: boolean;
  use_chat_template?: boolean;
  context_max_length?: number;
  stop_new_line?: boolean;
  tag?: string | null;
  fixture_path?: string;
  data_path?: string;
  huggingface_dataset?: string;
  split?: string;
  source?: DatasetSource;
}

export type DatasetSource =
  | { kind: "fixture"; path: string }
  | {
      kind: "huggingface_rows";
      dataset: string;
      config?: string;
      split: string;
      source_filter?: string;
      page_size?: number;
      cache_path?: string;
    }
  | {
      kind: "huggingface_jsonl";
      dataset: string;
      path: string;
      cache_path?: string;
    }
  | {
      kind: "url_json";
      url: string;
      cache_path?: string;
    };

export interface BenchmarkConfig {
  agent: AgentConfig;
  dataset: DatasetConfig;
}

export interface BenchmarkQuery {
  id: string;
  question: string;
  answers: string[];
  type?: string;
  timestamp?: string;
  date?: string;
  previous_events?: string[];
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface BenchmarkSample {
  id: string;
  context: string;
  queries: BenchmarkQuery[];
  metadata?: Record<string, unknown>;
}

export interface MemoryBenchmarkAdapter {
  reset(sample: BenchmarkSample): Promise<void> | void;
  ingest(chunk: string, sample: BenchmarkSample): Promise<void> | void;
  answer(
    query: BenchmarkQuery,
    sample: BenchmarkSample,
  ): Promise<string | AdapterAnswer> | string | AdapterAnswer;
}

export interface AdapterAnswer {
  output: string;
  input_len?: number;
  output_len?: number;
  memory_construction_time?: number;
  query_time_len?: number;
  input_text?: unknown;
  retrieval_context?: unknown;
  raw?: unknown;
}

export interface BenchmarkRecord {
  benchmark_id: BenchmarkId;
  context_id: string;
  query_id: string;
  question: string;
  expected_answers: string[];
  predicted_answer: string;
  parsed_output?: string | null;
  query_type?: string;
  query_timestamp?: string;
  source?: string;
  exact_match: number;
  f1: number;
  substring_match: number;
  rouge_l_f1?: number;
  input_len: number;
  output_len: number;
  memory_construction_time: number;
  query_time_len: number;
  retrieval_context?: unknown;
  ingested_chunks: number;
  llm_judge?: LlmJudgeResult;
}

export interface BenchmarkSummary {
  benchmark_id: BenchmarkId;
  total_contexts: number;
  total_queries: number;
  exact_match: number;
  f1: number;
  substring_match: number;
  rouge_l_f1?: number;
  avg_input_len: number;
  avg_output_len: number;
  avg_memory_construction_time: number;
  avg_query_time_len: number;
  llm_judge_score?: number;
}

export interface BenchmarkRunResult {
  benchmark: BenchmarkDefinition;
  records: BenchmarkRecord[];
  summary: BenchmarkSummary;
}

export interface ConversationContext {
  id: string;
  chunks: string[];
  query_answer_pairs: BenchmarkQuery[];
  sample: BenchmarkSample;
}

export interface LlmJudgeResult {
  score: number;
  label: "correct" | "partially_correct" | "incorrect" | "abstained" | string;
  rationale?: string;
  raw?: unknown;
}

export type LlmJudge = (
  record: BenchmarkRecord,
) => Promise<LlmJudgeResult> | LlmJudgeResult;
