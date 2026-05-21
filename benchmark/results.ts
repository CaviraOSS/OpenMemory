import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  BenchmarkDefinition,
  BenchmarkRecord,
  BenchmarkRunResult,
  BenchmarkSummary,
} from "./types";

export interface ExistingRun {
  records: BenchmarkRecord[];
  next_query_index: number;
}

export async function loadExistingRun(
  outputPath: string,
): Promise<ExistingRun> {
  try {
    const parsed = JSON.parse(await readFile(outputPath, "utf8")) as {
      data?: BenchmarkRecord[];
    };
    const records = parsed.data ?? [];
    return { records, next_query_index: records.length };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { records: [], next_query_index: 0 };
    }
    throw error;
  }
}

export async function saveRunResult(
  outputPath: string,
  result: BenchmarkRunResult,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        benchmark: result.benchmark,
        summary: result.summary,
        data: result.records,
      },
      null,
      2,
    ),
  );
}

export function summarizeRecords(
  benchmark: BenchmarkDefinition,
  totalContexts: number,
  records: BenchmarkRecord[],
): BenchmarkSummary {
  return {
    benchmark_id: benchmark.id,
    total_contexts: totalContexts,
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
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
