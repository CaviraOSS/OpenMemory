import { readFile } from "node:fs/promises";
import type { AgentConfig, BenchmarkConfig, DatasetConfig } from "./types";

export interface LoadBenchmarkConfigOptions {
  agentConfig: string;
  datasetConfig: string;
  chunkSize?: number;
  maxTestSamples?: number;
}

export async function loadBenchmarkConfig(
  options: LoadBenchmarkConfigOptions,
): Promise<BenchmarkConfig> {
  const agent = await readJson<AgentConfig>(options.agentConfig);
  const dataset = await readJson<DatasetConfig>(options.datasetConfig);

  if (options.chunkSize && options.chunkSize > 0) {
    dataset.chunk_size = options.chunkSize;
  }
  if (options.maxTestSamples && options.maxTestSamples > 0) {
    dataset.max_test_samples = options.maxTestSamples;
  }

  return { agent, dataset };
}

export function generateOutputName(
  agent: AgentConfig,
  dataset: DatasetConfig,
): string {
  const tag = dataset.tag ?? "none";
  const memoryAgentParts = isMemoryAgent(agent)
    ? [`k${agent.retrieve_num ?? "unknown"}`, `chunk${agent.agent_chunk_size ?? dataset.chunk_size}`]
    : [];
  return [
    dataset.sub_dataset,
    tag,
    `size${dataset.generation_max_length}`,
    `shots${dataset.shots}`,
    `max_samples${dataset.max_test_samples}`,
    ...memoryAgentParts,
    agent.agent_name,
    agent.model,
  ].join("_");
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function isMemoryAgent(agent: AgentConfig): boolean {
  return (
    agent.adapter === "mem0" ||
    agent.adapter === "cognee" ||
    agent.adapter === "zep" ||
    agent.adapter === "supermemory" ||
    /mem0|cognee|zep|supermemory/i.test(agent.agent_name)
  );
}
