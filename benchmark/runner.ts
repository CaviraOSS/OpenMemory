import { scoreAnswer } from "./metrics";
import { createConversation } from "./conversation";
import { loadExistingRun, saveRunResult, summarizeRecords } from "./results";
import { renderTemplate } from "./templates";
import type {
  AdapterAnswer,
  AgentConfig,
  BenchmarkDefinition,
  BenchmarkRecord,
  BenchmarkRunResult,
  BenchmarkSample,
  LlmJudge,
  DatasetConfig,
  MemoryBenchmarkAdapter,
} from "./types";

export interface RunBenchmarkOptions {
  samples: BenchmarkSample[];
  adapter: MemoryBenchmarkAdapter;
  chunkSize?: number;
  agent?: AgentConfig;
  dataset?: DatasetConfig;
  llmJudge?: LlmJudge;
}

export interface RunBenchmarkJobOptions extends RunBenchmarkOptions {
  outputPath: string;
  force?: boolean;
  maxQueries?: number;
}

export async function runBenchmark(
  benchmark: BenchmarkDefinition,
  options: RunBenchmarkOptions,
): Promise<BenchmarkRunResult> {
  const records: BenchmarkRunResult["records"] = [];
  const dataset = options.dataset ?? defaultDataset(benchmark, options.chunkSize);
  const agent = options.agent ?? defaultAgent();
  const conversations = createConversation(options.samples, {
    chunkSize: options.chunkSize ?? dataset.chunk_size,
  });

  for (const conversation of conversations) {
    const sample = conversation.sample;
    await options.adapter.reset(sample);

    for (const chunk of conversation.chunks) {
      await options.adapter.ingest(
        renderTemplate("memorize", { agent, dataset, sample, chunk }),
        sample,
      );
    }

    for (const query of conversation.query_answer_pairs) {
      const answer = normalizeAdapterAnswer(
        await options.adapter.answer(
          { ...query, question: renderTemplate("query", { agent, dataset, sample, query }) },
          sample,
        ),
      );
      const score = scoreAnswer(answer.output, query.answers, dataset.sub_dataset);

      const record: BenchmarkRecord = {
        benchmark_id: benchmark.id,
        context_id: sample.id,
        query_id: query.id,
        question: query.question,
        expected_answers: query.answers,
        predicted_answer: answer.output,
        query_type: query.type,
        query_timestamp: query.timestamp ?? query.date,
        source: query.source,
        input_len: answer.input_len ?? 0,
        output_len: answer.output_len ?? answer.output.length,
        memory_construction_time: answer.memory_construction_time ?? 0,
        query_time_len: answer.query_time_len ?? 0,
        retrieval_context: answer.retrieval_context,
        ingested_chunks: conversation.chunks.length,
        ...score,
      };
      if (options.llmJudge) {
        record.llm_judge = await options.llmJudge(record);
      }
      records.push(record);
    }
  }

  return {
    benchmark,
    records,
    summary: {
      benchmark_id: benchmark.id,
      total_contexts: options.samples.length,
      total_queries: records.length,
      exact_match: average(records.map((record) => record.exact_match)),
      f1: average(records.map((record) => record.f1)),
      substring_match: average(records.map((record) => record.substring_match)),
      rouge_l_f1: average(
        records
          .map((record) => record.rouge_l_f1)
          .filter((value): value is number => typeof value === "number"),
      ),
      avg_input_len: average(records.map((record) => record.input_len)),
      avg_output_len: average(records.map((record) => record.output_len)),
      avg_memory_construction_time: average(
        records.map((record) => record.memory_construction_time),
      ),
      avg_query_time_len: average(records.map((record) => record.query_time_len)),
      llm_judge_score: average(
        records
          .map((record) => record.llm_judge?.score)
          .filter((score): score is number => typeof score === "number"),
      ),
    },
  };
}

export async function runBenchmarkJob(
  options: RunBenchmarkJobOptions & { benchmark: BenchmarkDefinition },
): Promise<BenchmarkRunResult> {
  const existing = options.force
    ? { records: [] as BenchmarkRecord[], next_query_index: 0 }
    : await loadExistingRun(options.outputPath);
  const records = [...existing.records];
  const dataset =
    options.dataset ?? defaultDataset(options.benchmark, options.chunkSize);
  const agent = options.agent ?? defaultAgent();
  const conversations = createConversation(options.samples, {
    chunkSize: options.chunkSize ?? dataset.chunk_size,
  });
  let queryIndex = 0;
  let processedThisRun = 0;

  for (const conversation of conversations) {
    const sample = conversation.sample;
    await options.adapter.reset(sample);

    if (!shouldSkipContext(sample, queryIndex, existing.next_query_index)) {
      for (const chunk of conversation.chunks) {
        await options.adapter.ingest(
          renderTemplate("memorize", { agent, dataset, sample, chunk }),
          sample,
        );
      }
    }

    for (const query of conversation.query_answer_pairs) {
      if (queryIndex++ < existing.next_query_index) {
        continue;
      }
      if (options.maxQueries && processedThisRun >= options.maxQueries) {
        return writeResult(options, records);
      }

      const answer = normalizeAdapterAnswer(
        await options.adapter.answer(
          { ...query, question: renderTemplate("query", { agent, dataset, sample, query }) },
          sample,
        ),
      );
      const score = scoreAnswer(answer.output, query.answers, dataset.sub_dataset);
      const record: BenchmarkRecord = {
        benchmark_id: options.benchmark.id,
        context_id: sample.id,
        query_id: query.id,
        question: query.question,
        expected_answers: query.answers,
        predicted_answer: answer.output,
        query_type: query.type,
        query_timestamp: query.timestamp ?? query.date,
        source: query.source,
        input_len: answer.input_len ?? 0,
        output_len: answer.output_len ?? answer.output.length,
        memory_construction_time: answer.memory_construction_time ?? 0,
        query_time_len: answer.query_time_len ?? 0,
        retrieval_context: answer.retrieval_context,
        ingested_chunks: conversation.chunks.length,
        ...score,
      };
      if (options.llmJudge) {
        record.llm_judge = await options.llmJudge(record);
      }
      records.push(record);
      processedThisRun += 1;

      await writeResult(options, records);
    }
  }

  return writeResult(options, records);
}

function normalizeAdapterAnswer(answer: string | AdapterAnswer): AdapterAnswer {
  if (typeof answer === "string") {
    return { output: answer };
  }
  return answer;
}

function defaultAgent(): AgentConfig {
  return {
    agent_name: "fixture",
    adapter: "fixture",
    output_dir: "benchmark-results",
    model: "fixture",
  };
}

function defaultDataset(
  benchmark: BenchmarkDefinition,
  chunkSize = 4096,
): DatasetConfig {
  return {
    benchmark_id: benchmark.id,
    dataset: benchmark.task,
    sub_dataset: benchmark.default_split,
    chunk_size: chunkSize,
    generation_max_length: 0,
    max_test_samples: 0,
    shots: 0,
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function shouldSkipContext(
  sample: BenchmarkSample,
  firstQueryIndex: number,
  nextQueryIndex: number,
): boolean {
  return firstQueryIndex + sample.queries.length <= nextQueryIndex;
}

async function writeResult(
  options: RunBenchmarkJobOptions & { benchmark: BenchmarkDefinition },
  records: BenchmarkRecord[],
): Promise<BenchmarkRunResult> {
  const result = {
    benchmark: options.benchmark,
    records,
    summary: summarizeRecords(
      options.benchmark,
      options.samples.length,
      records,
    ),
  };
  await saveRunResult(options.outputPath, result);
  return result;
}
