# MemoryAgentBench Full Intake

## Scope Read

- Source inspected: `MemoryAgentBench-main`.
- Full path inventory: 1,073 files.
- Top-level distribution:
  - `cognee`: 550 files, vendored Cognee implementation and tests.
  - `letta`: 305 files, vendored Letta/MemGPT implementation and server/client code.
  - `mem0`: 90 files, vendored Mem0 implementation, vector stores, graph memory, and clients.
  - `methods`: 55 files, benchmark baseline methods: embedding RAG, graph RAG, RAPTOR, Self-RAG, Zep adapter, HippoRAG, MemoRAG.
  - `configs`: 50 YAML configs for agent and dataset matrices.
  - `bash_files`: 10 launch/matrix files.
  - `utils`: 3 benchmark-owned data, template, and metric utilities.
  - `llm_based_eval`: 3 LLM-judge evaluation scripts.
  - Root benchmark-owned files: `main.py`, `initialization.py`, `conversation_creator.py`, `agent.py`, `requirements.txt`, `README.md`.

## Benchmark-Owned Architecture

- `main.py` is a resumable experiment runner, not a one-shot benchmark.
- `initialization.py` loads YAML configs, applies ablations, creates output paths, restores existing results, computes resume offsets, and creates/loads per-context agent state.
- `conversation_creator.py` converts dataset rows into:
  - one long context per sample,
  - ordered context chunks,
  - multiple query/answer pairs per context,
  - preserved IDs and metadata such as `qa_pair_ids`, `question_dates`, `question_types`, `previous_events`, and `source`.
- `agent.py` is a polymorphic benchmark adapter over:
  - long-context agents,
  - memory agents,
  - simple RAG,
  - embedding RAG,
  - structure RAG,
  - agentic memory systems.
- `utils/templates.py` is essential. Prompts vary by dataset family and agent family. A benchmark port that uses one generic prompt is not faithful.
- `utils/eval_data_utils.py` loads HuggingFace `ai-hyz/MemoryAgentBench`, filters rows by `metadata.source`, normalizes list fields, and has fallback local-file loading.
- `utils/eval_other_utils.py` defines normalization, EM/F1/substring/ROUGE metrics, dataset-specific post-processing, recommendation matching, EventQA recall, Ruler recall, and result aggregation.
- `llm_based_eval` adds separate LLM-as-judge flows for LongMemEval and summarization tasks. These are optional evaluation layers, not part of the core deterministic runner.

## Dataset Matrix

- Main benchmark categories:
  - `Accurate_Retrieval`
  - `Test_Time_Learning`
  - `Long_Range_Understanding`
  - `Conflict_Resolution`
- Configured dataset families include:
  - LongMemEval: `longmemeval_s_-1_500`, `longmemeval_s*`
  - EventQA: 64k, 128k, full
  - Ruler QA: 197k, 421k
  - FactConsolidation: single-hop and multi-hop at 6k, 32k, 64k, 262k
  - ICL: banking77, clinic150, nlu, trec coarse, trec fine
  - Recsys Redial
  - Detective QA
  - InfBench summarization
- Configs carry context budget, chunk size, generation budget, sample caps, shots, chat-template behavior, and stop-newline behavior.

## Agent Matrix

- Long-context agents:
  - GPT-4o mini, GPT-4o, GPT-4.1 mini, Gemini 2.0 Flash, Claude 3.7 Sonnet, o4-mini.
- RAG/memory agents:
  - Letta local and API modes.
  - Mem0.
  - Cognee.
  - Zep.
  - BM25.
  - OpenAI embedding RAG.
  - Contriever/Qwen/NV embedding RAG.
  - GraphRAG.
  - HippoRAG.
  - RAPTOR.
  - Self-RAG.
  - MemoRAG.

## Method Adapter Findings

- Embedding RAG builds a FAISS store once per context, extracts retrieval query from prompt wrappers, retrieves top-k chunks, and sends retrieved memories plus query to an LLM.
- GraphRAG builds a NetworkX graph over chunks using embeddings, spaCy entities, LLM concepts, similarity edges, and graph traversal; implementation is verbose and research-prototype quality.
- RAPTOR clusters embeddings with Gaussian mixtures, summarizes clusters into hierarchy levels, builds a vector store over all tree nodes, then uses compressed retrieval for answering.
- Self-RAG runs LLM gates for retrieval necessity, relevance, support, and utility; it is useful as an adapter behavior but too LLM-heavy to copy directly.
- Zep adapter composes facts/entities/episodes with valid date ranges and handles provider-specific retrieval-query trimming.
- HippoRAG performs OpenIE, entity/triple extraction, graph construction, dense retrieval, linking, and PPR-style graph search. It is a baseline dependency boundary, not code to port into OpenMemory.
- MemoRAG builds a generated memory representation plus dense retriever, with explicit `memorize`, `load`, and `generate` phases.
- Mem0 vendored code shows fact extraction, vector-store updates, history, optional graph memory, and many vector backends; OpenMemory already has a cleaner durable boundary and should not copy Mem0 internals.
- Cognee vendored code includes graph/vector/relational adapters and retrieval APIs; useful as competitive baseline behavior, not as product architecture.
- Letta vendored code includes agent state, archival memory insertion, source attachment, REST/local clients, and server surfaces; it should remain an external baseline.

## What The TypeScript Benchmark Must Copy Structurally

- Config-driven experiment matrix, not hard-coded suites.
- Agent adapter interface with explicit phases:
  - reset/load context state,
  - ingest ordered chunks once,
  - query many questions,
  - return answer, context used, input/output length, memory construction time, query time.
- Dataset loader adapters that preserve benchmark metadata and question IDs.
- Dataset-specific prompt templates and post-processing.
- Resumable result writer that can skip completed context/query pairs.
- Per-context state/output paths derived from agent config plus dataset config.
- Deterministic metrics: exact match, F1, substring match, ROUGE where relevant.
- Optional LLM judge layer for LongMemEval/summarization, separate from deterministic scoring.
- Ablation support for chunk size, max queries, model/backbone, and retrieve count.

## What Not To Port

- Do not port Python runtime code into active OpenMemory.
- Do not copy vendored Letta, Mem0, Cognee, HippoRAG, MemoRAG, RAPTOR, Self-RAG internals into product code.
- Do not claim public benchmark scores from fixtures or toy data.
- Do not treat one generic prompt as equivalent to MemoryAgentBench.
- Do not make benchmark execution depend on OpenMemory server side effects unless the adapter explicitly targets durable unprefixed api.

## Correction Plan For `benchmark/`

- Treat the current TypeScript scaffold as incomplete.
- Rebuild toward a real matrix runner:
  - typed agent config loader,
  - typed dataset config loader,
  - HuggingFace/local dataset adapters,
  - MemoryAgentBench-style conversation creator,
  - suite-specific templates for LongMemEval, LongMemEval-V2, LoCoMo, and TReMu,
  - OpenMemory unprefixed durable api adapter,
  - long-context baseline adapter,
  - resumable JSON result writer,
  - deterministic metric aggregation,
  - optional LLM-judge hook.
- Keep fixtures only as harness contract tests, not benchmark evidence.
