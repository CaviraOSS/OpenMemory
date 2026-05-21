import { join } from "node:path";
import { adapterFromAgentConfig } from "./adapters/openmemoryHttp";
import { createFixtureAdapter } from "./adapters/fixture";
import { BENCHMARKS } from "./index";
import { generateOutputName, loadBenchmarkConfig } from "./config";
import { loadSamples, type LoadSamplesOptions } from "./data";
import { createLlmJudge } from "./llmEval";
import {
  formatBenchmarkPreflightError,
  validateBenchmarkMatrixPreflight,
} from "./preflight";
import { runBenchmarkJob } from "./runner";
import type {
  AgentConfig,
  BenchmarkRunResult,
  DatasetConfig,
  MemoryBenchmarkAdapter,
} from "./types";

export type BenchmarkSystemId =
  | "openmemory"
  | "mem0"
  | "cognee"
  | "zep"
  | "supermemory";

export interface BenchmarkSystem {
  id: BenchmarkSystemId;
  name: string;
  role: "subject" | "alternative";
  agent_config: string;
}

export interface BenchmarkMatrixJob {
  system_id: BenchmarkSystemId;
  system_name: string;
  agent_config: string;
  dataset_config: string;
}

export interface BenchmarkMatrixPlan {
  systems: BenchmarkSystem[];
  jobs: BenchmarkMatrixJob[];
}

export interface BenchmarkMatrixRunResult {
  job: BenchmarkMatrixJob;
  result: BenchmarkRunResult;
}

export interface BenchmarkMatrixOptions {
  systems?: BenchmarkSystemId[];
  agentConfigs?: string[];
  datasetConfigs?: string[];
}

export interface RunBenchmarkMatrixOptions extends BenchmarkMatrixOptions {
  force?: boolean;
  maxQueries?: number;
  download?: boolean;
  noCache?: boolean;
  llmEval?: boolean;
  llmProvider?: "openai" | "gemini" | "siray";
  adapterFactory?: (agent: AgentConfig, samples: Awaited<ReturnType<typeof loadSamples>>) => MemoryBenchmarkAdapter;
  loadSamplesOptions?: LoadSamplesOptions;
}

export const BENCHMARK_SYSTEMS: BenchmarkSystem[] = [
  {
    id: "openmemory",
    name: "OpenMemory",
    role: "subject",
    agent_config: "benchmark/configs/agents/openmemory-http.json",
  },
  {
    id: "mem0",
    name: "Mem0",
    role: "alternative",
    agent_config: "benchmark/configs/agents/mem0.json",
  },
  {
    id: "cognee",
    name: "Cognee",
    role: "alternative",
    agent_config: "benchmark/configs/agents/cognee.json",
  },
  {
    id: "zep",
    name: "Zep",
    role: "alternative",
    agent_config: "benchmark/configs/agents/zep.json",
  },
  {
    id: "supermemory",
    name: "Supermemory",
    role: "alternative",
    agent_config: "benchmark/configs/agents/supermemory.json",
  },
];

export const DEFAULT_MATRIX_DATASETS = [
  "benchmark/configs/datasets/longmemeval.json",
  "benchmark/configs/datasets/longmemeval-v2.json",
  "benchmark/configs/datasets/locomo.json",
  "benchmark/configs/datasets/tremu.json",
];

export function createBenchmarkMatrixPlan(
  options: BenchmarkMatrixOptions = {},
): BenchmarkMatrixPlan {
  const systems = selectSystems(options.systems);
  const agentConfigs = options.agentConfigs ?? systems.map((system) => system.agent_config);
  const datasetConfigs = options.datasetConfigs ?? DEFAULT_MATRIX_DATASETS;
  const jobs: BenchmarkMatrixJob[] = [];

  for (const datasetConfig of datasetConfigs) {
    for (let index = 0; index < agentConfigs.length; index += 1) {
      const system = systems[index] ?? systemFromAgentConfig(agentConfigs[index]);
      jobs.push({
        system_id: system.id,
        system_name: system.name,
        agent_config: agentConfigs[index],
        dataset_config: datasetConfig,
      });
    }
  }

  return { systems, jobs };
}

export async function runBenchmarkMatrix(
  options: RunBenchmarkMatrixOptions = {},
): Promise<BenchmarkMatrixRunResult[]> {
  const plan = createBenchmarkMatrixPlan(options);
  const preflight = await validateBenchmarkMatrixPreflight({
    jobs: plan.jobs,
    llmEval: options.llmEval,
    llmProvider: options.llmProvider,
  });
  if (!preflight.ok) {
    throw new Error(formatBenchmarkPreflightError(preflight));
  }
  const results: BenchmarkMatrixRunResult[] = [];

  for (const job of plan.jobs) {
    const config = await loadBenchmarkConfig({
      agentConfig: job.agent_config,
      datasetConfig: job.dataset_config,
    });
    const benchmark = BENCHMARKS.find(
      (candidate) => candidate.id === config.dataset.benchmark_id,
    );
    if (!benchmark) {
      throw new Error(`Unknown benchmark: ${config.dataset.benchmark_id}`);
    }

    const samples = await loadSamples(config.dataset, {
      forceDownload: options.download,
      useCache: !options.noCache,
      ...options.loadSamplesOptions,
    });
    const outputPath = matrixOutputPath(job.system_id, config.agent, config.dataset);
    const adapter =
      options.adapterFactory?.(config.agent, samples) ??
      defaultAdapter(config.agent, samples);

    const result = await runBenchmarkJob({
        benchmark,
        samples,
        adapter,
        chunkSize: config.agent.agent_chunk_size ?? config.dataset.chunk_size,
        agent: config.agent,
        dataset: config.dataset,
        outputPath,
        maxQueries: options.maxQueries,
        force: options.force,
        llmJudge: options.llmEval
          ? createLlmJudge({
              provider: options.llmProvider ?? config.agent.llm_provider,
            })
          : undefined,
      });
    results.push({ job, result });
  }

  return results;
}

export function matrixOutputPath(
  systemId: BenchmarkSystemId,
  agent: AgentConfig,
  dataset: DatasetConfig,
): string {
  return join(
    agent.output_dir,
    "matrix",
    systemId,
    dataset.dataset,
    `${generateOutputName(agent, dataset)}_results.json`,
  );
}

function selectSystems(systemIds?: BenchmarkSystemId[]): BenchmarkSystem[] {
  if (!systemIds?.length) {
    return BENCHMARK_SYSTEMS;
  }
  const byId = new Map(BENCHMARK_SYSTEMS.map((system) => [system.id, system]));
  return systemIds.map((id) => {
    const system = byId.get(id);
    if (!system) {
      throw new Error(`Unknown benchmark system: ${id}`);
    }
    return system;
  });
}

function systemFromAgentConfig(agentConfig: string): BenchmarkSystem {
  return (
    BENCHMARK_SYSTEMS.find((system) => system.agent_config === agentConfig) ?? {
      id: "openmemory",
      name: agentConfig,
      role: "alternative",
      agent_config: agentConfig,
    }
  );
}

function defaultAdapter(
  agent: AgentConfig,
  samples: Awaited<ReturnType<typeof loadSamples>>,
): MemoryBenchmarkAdapter {
  if (agent.adapter === "fixture") {
    return createFixtureAdapter(
      Object.fromEntries(
        samples.flatMap((sample) =>
          sample.queries.map((query) => [query.id, query.answers[0] ?? ""]),
        ),
      ),
    );
  }
  return adapterFromAgentConfig(agent);
}
