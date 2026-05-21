import type {
  AdapterAnswer,
  AgentConfig,
  BenchmarkQuery,
  BenchmarkSample,
  MemoryBenchmarkAdapter,
} from "../types";
import { createExternalMemoryAdapterFromAgentConfig } from "./externalMemory";

export interface OpenMemoryHttpAdapterOptions {
  baseUrl: string;
  apiKey?: string;
  fetcher?: typeof fetch;
}

export function createOpenMemoryHttpAdapter(
  options: OpenMemoryHttpAdapterOptions,
): MemoryBenchmarkAdapter {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, "");

  async function post(path: string, body: unknown): Promise<any> {
    const response = await fetcher(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.apiKey
          ? { authorization: `Bearer ${options.apiKey}` }
          : {}),
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`OpenMemory ${path} failed with ${response.status}`);
    }
    return response.json();
  }

  return {
    reset() {},
    async ingest(chunk: string, sample: BenchmarkSample) {
      await post("/v1/memories", {
        user_id: "benchmark",
        project_id: sample.id,
        content: chunk,
        metadata: {
          benchmark_context_id: sample.id,
          benchmark: sample.metadata?.benchmark,
        },
      });
    },
    async answer(query: BenchmarkQuery, sample: BenchmarkSample): Promise<AdapterAnswer> {
      const started = Date.now();
      const result = await post("/v1/recall", {
        user_id: "benchmark",
        project_id: sample.id,
        query: query.question,
        mode: "strict",
        limit: 5,
      });
      const top =
        result.memories?.[0] ?? result.results?.[0] ?? result.data?.[0];
      const output = String(top?.content ?? top?.memory?.content ?? "");
      return {
        output,
        input_len: query.question.length,
        output_len: output.length,
        memory_construction_time: 0,
        query_time_len: (Date.now() - started) / 1000,
        retrieval_context: result.memories ?? result.results ?? result.data,
        raw: result,
      };
    },
  };
}

export function adapterFromAgentConfig(
  agent: AgentConfig,
): MemoryBenchmarkAdapter {
  if (agent.adapter === "openmemory_http") {
    return createOpenMemoryHttpAdapter({
      baseUrl: agent.api_base_url ?? "http://127.0.0.1:8765",
      apiKey: agent.api_key,
    });
  }
  if (
    agent.adapter === "mem0" ||
    agent.adapter === "cognee" ||
    agent.adapter === "zep" ||
    agent.adapter === "supermemory"
  ) {
    return createExternalMemoryAdapterFromAgentConfig(agent);
  }
  return {
    reset() {},
    ingest() {},
    answer() {
      return "";
    },
  };
}
