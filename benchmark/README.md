# OpenMemory Benchmarks

This folder contains TypeScript benchmark scaffolding for the public memory benchmarks OpenMemory should run against durable `/v1`.

It follows the useful structure from `MemoryAgentBench-main`: separate agent configs, dataset configs, conversation creation, adapter execution, resumable result files, and exact-match/F1/substring aggregation.

## Layout

| Path               | Purpose                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `configs/agents`   | Agent or memory-system adapter configs.                                                                      |
| `configs/datasets` | Benchmark dataset configs with chunk size, sample count, generation length, fixture fallback, and source manifest. |
| `data/fixtures`    | Small local fixtures for smoke tests and harness development. Full dataset download is opt-in.               |
| `suites`           | Benchmark definitions for LongMemEval, LongMemEval-V2, LoCoMo, and TReMu.                                    |
| `adapters`         | Memory-system adapters. `openmemory_http` calls durable `/v1`; `fixture` is deterministic for harness tests. |
| `main.ts`          | CLI runner mirroring the MemoryAgentBench `main.py` flow.                                                    |

## Active Suites

| Suite          | File                       | What it checks                                                                                     |
| -------------- | -------------------------- | -------------------------------------------------------------------------------------------------- |
| LongMemEval    | `suites/longmemeval.ts`    | Long-range recall, multi-session reasoning, temporal reasoning, knowledge updates, and abstention. |
| LongMemEval-V2 | `suites/longmemeval-v2.ts` | Agent state tracking, workflow memory, evolving premises, and long-range recall.                   |
| LoCoMo         | `suites/locomo.ts`         | Long conversation recall, temporal reasoning, and causal dialogue memory.                          |
| TReMu          | `suites/tremu.ts`          | Bitemporal and temporal reasoning over multi-session dialogue.                                     |

## Five-System Matrix

The public comparison target is OpenMemory against four memory-system alternatives:

| System      | Role        | Benchmark adapter                                                                                   |
| ----------- | ----------- | --------------------------------------------------------------------------------------------------- |
| OpenMemory  | Subject     | Calls the durable `/v1` HTTP API through `openmemory_http`.                                         |
| Mem0        | Alternative | Uses MemoryAgentBench-style memory add/search plus LLM answer generation through optional `mem0ai`. |
| Cognee      | Alternative | Uses MemoryAgentBench-style add/cognify/search through a local HTTP bridge.                         |
| Zep         | Alternative | Uses MemoryAgentBench-style thread/graph ingest and graph search through optional Zep Cloud SDK.    |
| Supermemory | Alternative | Uses the same add/search/generate memory benchmark contract through optional `supermemory`.          |

Matrix dry run:

```sh
npm run benchmark:matrix -- -- --dry_run --dataset_config benchmark/configs/datasets/longmemeval.json
```

Full matrix run over the configured public suites:

```sh
npm run benchmark:matrix -- -- --download --rerun --llm_eval
```

On Windows/npm, keep the extra `--` after the script separator so flags reach `matrixMain.ts`.

Real matrix runs perform preflight validation before producing result files. Required setup:

| System      | Required setup                                                                 |
| ----------- | ------------------------------------------------------------------------------ |
| OpenMemory  | Running server at `api_base_url`, default `http://127.0.0.1:8765/health`.      |
| Mem0        | Optional `mem0ai` package, `MEM0_API_KEY`, and answer LLM key.                 |
| Cognee      | Running HTTP bridge at `memory_api_base_url`; bridge auth if configured.       |
| Zep         | Optional `@getzep/zep-cloud` package, `ZEP_API_KEY`, and answer LLM key.       |
| Supermemory | Optional `supermemory` package, `SUPERMEMORY_API_KEY`, and answer LLM key.     |
| LLM judge   | `OM_BENCHMARK_LLM_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `SIRAY_API_KEY` depending on `--llm_provider`. |

Fixture runs and `--dry_run` prove the harness shape only. They are not benchmark scores.

## Adapter Contract

Benchmark runners use this interface:

```ts
interface MemoryBenchmarkAdapter {
  reset(sample: BenchmarkSample): Promise<void> | void;
  ingest(chunk: string, sample: BenchmarkSample): Promise<void> | void;
  answer(
    query: BenchmarkQuery,
    sample: BenchmarkSample,
  ): Promise<string> | string;
}
```

The adapter boundary keeps benchmark code separate from product runtime. A later OpenMemory adapter should call durable `/v1` to create candidate events or memories, then answer through `/v1/recall` and application-level response generation.

## Run

Fixture smoke:

```sh
npm run benchmark -- -- benchmark/configs/agents/fixture.json benchmark/configs/datasets/longmemeval.json --rerun
```

Full dataset run:

```sh
npm run benchmark -- -- benchmark/configs/agents/openmemory-http.json benchmark/configs/datasets/longmemeval.json --download --rerun
```

Optional LLM judge:

```sh
OM_BENCHMARK_LLM_API_KEY=... npm run benchmark -- -- benchmark/configs/agents/openmemory-http.json benchmark/configs/datasets/longmemeval-v2.json --download --llm_eval
```

Gemini judge:

```sh
GEMINI_API_KEY=... npm run benchmark -- -- benchmark/configs/agents/openmemory-http.json benchmark/configs/datasets/longmemeval.json --download --llm_eval --llm_provider gemini
```

Siray.ai judge:

```sh
SIRAY_API_KEY=... npm run benchmark -- -- benchmark/configs/agents/openmemory-http.json benchmark/configs/datasets/longmemeval.json --download --llm_eval --llm_provider siray
```

Against a running OpenMemory server:

```sh
npm run benchmark -- -- benchmark/configs/agents/openmemory-http.json benchmark/configs/datasets/locomo.json --rerun
```

MemoryAgentBench-style external memory adapters:

```sh
npm install mem0ai
OPENAI_API_KEY=... MEM0_API_KEY=... npm run benchmark -- -- benchmark/configs/agents/mem0.json benchmark/configs/datasets/longmemeval.json --download --rerun

npm install @getzep/zep-cloud
OPENAI_API_KEY=... ZEP_API_KEY=... npm run benchmark -- -- benchmark/configs/agents/zep.json benchmark/configs/datasets/longmemeval.json --download --rerun

npm install supermemory
OPENAI_API_KEY=... SUPERMEMORY_API_KEY=... npm run benchmark -- -- benchmark/configs/agents/supermemory.json benchmark/configs/datasets/longmemeval.json --download --rerun
```

Cognee has no stable TypeScript SDK package. Run a small HTTP bridge that exposes `/add`, `/cognify`, and `/search`, then point `benchmark/configs/agents/cognee.json#memory_api_base_url` at it.

## Dataset Sources

- LongMemEval uses the MemoryAgentBench Hugging Face rows API with `metadata.source=longmemeval_s_-1_500`.
- LongMemEval-V2 loads `questions.jsonl` from the public Hugging Face dataset repo. The large trajectory file is not pulled by default.
- LoCoMo loads the public `raw/locomo10.json` file and normalizes QA plus conversation sessions.
- TReMu keeps fixture fallback until a stable public dataset file is added to the manifest.

## Current State

The harness can download real public datasets when `--download` is passed, cache them under `benchmark-results/cache`, and run an optional JSON-only LLM judge. Do not claim public benchmark scores from fixture-only runs.

The Mem0, Cognee, and Zep adapters follow the MemoryAgentBench flow: ingest context into the memory system, search memory on query, then answer from retrieved memory with a configured LLM when the upstream benchmark does so. Supermemory follows the same add/search/generate contract because MemoryAgentBench does not include a Supermemory baseline.

Adapter-specific parity notes:

- Mem0 ingests a system/user/assistant chat triple per chunk, searches with `user_id=context_<id>_<sub_dataset>`, and then uses retrieved memories as LLM answer context.
- Cognee uses `dataset_name=default_dataset_<sub_dataset>_context_<id>`, runs `add` then `cognify` for each chunk, and returns joined search results directly.
- Zep creates user, thread, and graph IDs per context, adds both graph text and thread messages, extracts the retrieval query from the rendered prompt, searches edges/nodes/episodes separately, and formats facts/entities/episodes with edge date ranges before LLM answering.
- Supermemory is not present in MemoryAgentBench, so it uses the same add/search/generate adapter contract as the other memory APIs.
