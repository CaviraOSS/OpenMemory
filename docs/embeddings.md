<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/embeddings.md
 usage : documents LongMemory embeddings
-->

# Embedding providers

LongMemory supports real semantic embedding providers without changing recall
admission rules. Embeddings rank candidates only after temporal, contract,
permission, contradiction, confidence, and grounding gates.

## Providers

| Provider          | Environment                      | Default model                      |
| ----------------- | -------------------------------- | ---------------------------------- |
| OpenAI-compatible | `OPENAI_API_KEY`                 | `text-embedding-3-small`           |
| Gemini            | `GEMINI_API_KEY`                 | `gemini-embedding-001`             |
| AWS Bedrock       | standard AWS credential chain    | `amazon.titan-embed-text-v2:0`     |
| Ollama            | `LONGMEMORY_OLLAMA_URL`          | `nomic-embed-text`                 |
| Local HTTP        | `LONGMEMORY_LOCAL_EMBEDDING_URL` | `local-model`                      |
| Siray             | `SIRAY_API_TOKEN`                | `text-embedding-3-small`           |
| Synthetic         | no credentials                   | deterministic multilingual hashing |

All provider vectors are validated, resized to the configured dimension, and
L2 normalized. The same dimension configures world embeddings, Frequent
Directions sketches, and entity drift tracking for new stores.

## Configuration

```env
LONGMEMORY_EMBEDDING_PROVIDER=openai
LONGMEMORY_EMBEDDING_TIER=deep
LONGMEMORY_EMBEDDING_FALLBACK=ollama,synthetic
LONGMEMORY_EMBEDDING_DIMENSION=1536
LONGMEMORY_EMBEDDING_TIMEOUT_MS=30000
LONGMEMORY_EMBEDDING_MAX_RETRIES=2

OPENAI_API_KEY=...
LONGMEMORY_OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

The archived `OM_*` names remain accepted. New deployments should prefer the
`LONGMEMORY_*` names documented in `.env.example`.

## Tiers

- `hybrid`: deterministic multilingual vectors plus Hydrograph lexical/BM25
  relevance. No external call.
- `fast`: deterministic multilingual vectors. No external call.
- `smart`: blends deterministic and semantic vectors at the same dimension.
- `deep`: uses the semantic provider directly.

Provider failure proceeds through the configured fallback chain. Synthetic is
always appended as the final local fallback, so an unavailable external API
does not make memory unusable.

## Programmatic use

```ts
import {
  createMemory,
  openai_embedding_provider,
  load_embedding_environment,
} from "longmemory";

const providerConfig = load_embedding_environment(process.env)!;
const provider = new openai_embedding_provider(providerConfig, {});

const memory = createMemory({
  embedding_provider: provider,
  embedding_dimension: provider.dimension,
});
```

The server, CLI, and MCP runtime automatically load embedding configuration
from their environment.
