<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : Why.md
 usage : supports LongMemory why
-->

# Why LongMemory

Language models are stateless. Most products called memory compensate by embedding text and returning nearby chunks. That is useful retrieval, but it does not answer the harder questions: what was true then, what is true now, which source is authoritative, what changed, who may see it, and why a memory was selected.

LongMemory treats those questions as the memory system itself.

## What is different

- Immutable content with recorded-time and valid-time history.
- Executable typed edges, entities, worlds, grounding, contradiction, and provenance.
- Strict, historical, associative, world-grounded, and multilingual recall.
- Deterministic decay and explicit reinforcement without rewriting source truth.
- Project-scoped decisions, tasks, Skills, Chat Memory, LLM-Wiki, and CodeGraph assets.
- Explainable evidence selection under token budgets and access policy.
- One local-first engine across npm, CLI, HTTP, MCP, dashboard, and editor workflows.

## What LongMemory is not

It is not a hosted black box, a transcript dump, an autonomous permission system, or a replacement for model context. It is a governed evidence layer that lets applications and agents carry durable state without surrendering ownership or auditability.

The model can remain stateless. The application no longer has to be amnesiac.
