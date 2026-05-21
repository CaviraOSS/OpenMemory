export interface CliArgs {
  agentConfig: string;
  datasetConfig: string;
  chunkSize?: number;
  maxTestSamples?: number;
  maxQueries?: number;
  force?: boolean;
  llmEval?: boolean;
  llmProvider?: "openai" | "gemini" | "siray";
  download?: boolean;
  noCache?: boolean;
}

export function parseBenchmarkArgs(args: string[]): CliArgs {
  const parsed: Partial<CliArgs> = {};
  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--force" || arg === "--rerun") {
      parsed.force = true;
      continue;
    }
    if (arg === "--llm_eval" || arg === "--llm-eval") {
      parsed.llmEval = true;
      continue;
    }
    if (arg === "--download") {
      parsed.download = true;
      continue;
    }
    if (arg === "--no_cache" || arg === "--no-cache") {
      parsed.noCache = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const value = args[index + 1];
    if (!value) {
      throw new Error(`Missing value for ${arg}`);
    }
    index += 1;

    if (arg === "--agent_config") parsed.agentConfig = value;
    else if (arg === "--dataset_config") parsed.datasetConfig = value;
    else if (arg === "--chunk_size_ablation") parsed.chunkSize = Number(value);
    else if (arg === "--max_test_samples_ablation")
      parsed.maxTestSamples = Number(value);
    else if (arg === "--max_test_queries_ablation")
      parsed.maxQueries = Number(value);
    else if (arg === "--llm_provider" || arg === "--llm-provider")
      parsed.llmProvider = value as CliArgs["llmProvider"];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  parsed.agentConfig ??= positional[0];
  parsed.datasetConfig ??= positional[1];

  if (!parsed.agentConfig || !parsed.datasetConfig) {
    throw new Error(
      "agent and dataset configs are required, either positionally or with --agent_config/--dataset_config",
    );
  }

  return parsed as CliArgs;
}
