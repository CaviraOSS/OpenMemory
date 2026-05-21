import type {
  AdapterAnswer,
  BenchmarkQuery,
  BenchmarkSample,
  MemoryBenchmarkAdapter,
} from "../types";

export function createFixtureAdapter(
  answersByQueryId: Record<string, string>,
): MemoryBenchmarkAdapter {
  return {
    reset() {},
    ingest() {},
    answer(query: BenchmarkQuery, _sample: BenchmarkSample): AdapterAnswer {
      const output = answersByQueryId[query.id] ?? "";
      return {
        output,
        input_len: query.question.length,
        output_len: output.length,
        memory_construction_time: 0,
        query_time_len: 0,
      };
    },
  };
}
