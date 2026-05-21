#!/usr/bin/env node
import { createBenchmarkMatrixPlan, runBenchmarkMatrix, type BenchmarkSystemId } from "./matrix";

interface MatrixCliArgs {
  systems?: BenchmarkSystemId[];
  datasetConfigs?: string[];
  force?: boolean;
  maxQueries?: number;
  download?: boolean;
  noCache?: boolean;
  llmEval?: boolean;
  llmProvider?: "openai" | "gemini" | "siray";
  dryRun?: boolean;
}

async function main() {
  const args = parseMatrixArgs(process.argv.slice(2));
  if (args.dryRun) {
    process.stdout.write(
      `${JSON.stringify(createBenchmarkMatrixPlan(args), null, 2)}\n`,
    );
    return;
  }

  const results = await runBenchmarkMatrix(args);
  process.stdout.write(
    `${JSON.stringify(
      results.map(({ job, result }) => ({
        system_id: job.system_id,
        system_name: job.system_name,
        dataset_config: job.dataset_config,
        summary: result.summary,
      })),
      null,
      2,
    )}\n`,
  );
}

export function parseMatrixArgs(args: string[]): MatrixCliArgs {
  const parsed: MatrixCliArgs = {};
  const datasets: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--force" || arg === "--rerun") parsed.force = true;
    else if (arg === "--download") parsed.download = true;
    else if (arg === "--no_cache" || arg === "--no-cache") parsed.noCache = true;
    else if (arg === "--llm_eval" || arg === "--llm-eval") parsed.llmEval = true;
    else if (arg === "--dry_run" || arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--systems") {
      parsed.systems = nextValue(args, ++index, arg).split(",") as BenchmarkSystemId[];
    } else if (arg === "--dataset_config") {
      datasets.push(nextValue(args, ++index, arg));
    } else if (arg === "--max_test_queries_ablation") {
      parsed.maxQueries = Number(nextValue(args, ++index, arg));
    } else if (arg === "--llm_provider" || arg === "--llm-provider") {
      parsed.llmProvider = nextValue(args, ++index, arg) as MatrixCliArgs["llmProvider"];
    } else if (!arg.startsWith("--")) {
      datasets.push(arg);
    } else {
      throw new Error(`Unknown matrix argument: ${arg}`);
    }
  }

  if (datasets.length) {
    parsed.datasetConfigs = datasets;
  }
  return parsed;
}

function nextValue(args: string[], index: number, name: string): string {
  const value = args[index];
  if (!value) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
});
