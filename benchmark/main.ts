#!/usr/bin/env node
import { join } from "node:path";
import { adapterFromAgentConfig } from "./adapters/openmemoryHttp";
import { createFixtureAdapter } from "./adapters/fixture";
import { BENCHMARKS } from "./index";
import { parseBenchmarkArgs } from "./cli";
import { generateOutputName, loadBenchmarkConfig } from "./config";
import { createLlmJudge } from "./llmEval";
import { loadSamples } from "./data";
import { runBenchmarkJob } from "./runner";

async function main() {
  const args = parseBenchmarkArgs(process.argv.slice(2));
  const config = await loadBenchmarkConfig(args);
  const benchmark = BENCHMARKS.find(
    (candidate) => candidate.id === config.dataset.benchmark_id,
  );
  if (!benchmark) {
    throw new Error(`Unknown benchmark: ${config.dataset.benchmark_id}`);
  }

  const samples = await loadSamples(config.dataset, {
    forceDownload: args.download,
    useCache: !args.noCache,
  });
  const outputPath = join(
    config.agent.output_dir,
    config.dataset.dataset,
    `${generateOutputName(config.agent, config.dataset)}_results.json`,
  );

  const result = await runBenchmarkJob({
    benchmark,
    samples,
    adapter:
      config.agent.adapter === "fixture"
        ? createFixtureAdapter(
            Object.fromEntries(
              samples.flatMap((sample) =>
                sample.queries.map((query) => [
                  query.id,
                  query.answers[0] ?? "",
                ]),
              ),
            ),
          )
        : adapterFromAgentConfig(config.agent),
    chunkSize: config.dataset.chunk_size,
    agent: config.agent,
    dataset: config.dataset,
    outputPath,
    maxQueries: args.maxQueries,
    force: args.force,
    llmJudge: args.llmEval
      ? createLlmJudge({ provider: args.llmProvider ?? config.agent.llm_provider })
      : undefined,
  });

  process.stdout.write(`${JSON.stringify(result.summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
});
