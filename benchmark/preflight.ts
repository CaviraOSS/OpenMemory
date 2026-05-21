import { loadBenchmarkConfig } from "./config";
import type { AgentConfig } from "./types";
import type { BenchmarkMatrixJob } from "./matrix";

export interface BenchmarkPreflightOptions {
  jobs: BenchmarkMatrixJob[];
  llmEval?: boolean;
  llmProvider?: "openai" | "gemini" | "siray";
  env?: NodeJS.ProcessEnv;
  fetcher?: typeof fetch;
}

export interface BenchmarkPreflightIssue {
  system_id: string;
  agent_config: string;
  missing: string[];
  details: string[];
}

export interface BenchmarkPreflightResult {
  ok: boolean;
  issues: BenchmarkPreflightIssue[];
}

export async function validateBenchmarkMatrixPreflight(
  options: BenchmarkPreflightOptions,
): Promise<BenchmarkPreflightResult> {
  const env = options.env ?? process.env;
  const byAgentConfig = new Map<string, BenchmarkMatrixJob>();

  for (const job of options.jobs) {
    byAgentConfig.set(job.agent_config, job);
  }

  const issues: BenchmarkPreflightIssue[] = [];
  for (const job of byAgentConfig.values()) {
    const config = await loadBenchmarkConfig({
      agentConfig: job.agent_config,
      datasetConfig: job.dataset_config,
    });
    const missing = requiredForAgent(config.agent, env, options);
    const details = missing.map((name) => `${name} is required for ${job.system_name}`);
    const serviceError = await validateService(config.agent, options.fetcher ?? fetch);
    if (serviceError) {
      missing.push(serviceError);
      details.push(serviceError);
    }
    if (missing.length) {
      issues.push({
        system_id: job.system_id,
        agent_config: job.agent_config,
        missing,
        details,
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

async function validateService(agent: AgentConfig, fetcher: typeof fetch): Promise<string | undefined> {
  if (agent.adapter !== "openmemory_http") {
    return undefined;
  }
  const baseUrl = agent.api_base_url?.replace(/\/$/, "");
  if (!baseUrl) {
    return undefined;
  }
  try {
    const response = await fetcher(`${baseUrl}/health`);
    return response.ok ? undefined : `OpenMemory server health check failed with ${response.status}`;
  } catch (error) {
    return `OpenMemory server is not reachable at ${baseUrl}/health: ${(error as Error).message}`;
  }
}

export function formatBenchmarkPreflightError(result: BenchmarkPreflightResult): string {
  if (result.ok) {
    return "";
  }
  return [
    "Benchmark preflight failed. This would not be a real competitor benchmark.",
    ...result.issues.flatMap((issue) => [
      `- ${issue.system_id} (${issue.agent_config})`,
      ...issue.missing.map((name) => `  missing: ${name}`),
    ]),
    "Set the required credentials/services, or use --dry_run for planning only.",
  ].join("\n");
}

function requiredForAgent(
  agent: AgentConfig,
  env: NodeJS.ProcessEnv,
  options: Pick<BenchmarkPreflightOptions, "llmEval" | "llmProvider">,
): string[] {
  const missing: string[] = [];

  if (agent.adapter === "fixture") {
    return missing;
  }
  if (agent.adapter === "openmemory_http") {
    requireValue(agent.api_base_url, "api_base_url", missing);
  }
  if (agent.adapter === "mem0") {
    requireValue(agent.memory_api_key ?? env.MEM0_API_KEY, "MEM0_API_KEY", missing);
    requireLlmKey(agent, env, options.llmProvider, missing);
  }
  if (agent.adapter === "cognee") {
    requireValue(agent.memory_api_base_url, "memory_api_base_url for Cognee bridge", missing);
    requireValue(agent.memory_api_key ?? env.COGNEE_API_KEY ?? "local-bridge", "COGNEE_API_KEY or local bridge without auth", missing);
  }
  if (agent.adapter === "zep") {
    requireValue(agent.memory_api_key ?? env.ZEP_API_KEY, "ZEP_API_KEY", missing);
    requireLlmKey(agent, env, options.llmProvider, missing);
  }
  if (agent.adapter === "supermemory") {
    requireValue(agent.memory_api_key ?? env.SUPERMEMORY_API_KEY, "SUPERMEMORY_API_KEY", missing);
    requireLlmKey(agent, env, options.llmProvider, missing);
  }
  if (options.llmEval) {
    requireLlmKey(agent, env, options.llmProvider, missing, "LLM judge");
  }

  return [...new Set(missing)];
}

function requireLlmKey(
  agent: AgentConfig,
  env: NodeJS.ProcessEnv,
  overrideProvider: BenchmarkPreflightOptions["llmProvider"],
  missing: string[],
  label = "answer LLM",
) {
  const provider = overrideProvider ?? agent.llm_provider ?? "openai";
  if (agent.api_key || env.OM_BENCHMARK_LLM_API_KEY) {
    return;
  }
  if (provider === "gemini") {
    requireValue(env.GEMINI_API_KEY ?? env.GOOGLE_API_KEY, `GEMINI_API_KEY or GOOGLE_API_KEY for ${label}`, missing);
  } else if (provider === "siray") {
    requireValue(env.SIRAY_API_KEY, `SIRAY_API_KEY for ${label}`, missing);
  } else {
    requireValue(env.OPENAI_API_KEY, `OPENAI_API_KEY or OM_BENCHMARK_LLM_API_KEY for ${label}`, missing);
  }
}

function requireValue(value: unknown, name: string, missing: string[]) {
  if (typeof value !== "string" || value.trim() === "") {
    missing.push(name);
  }
}
