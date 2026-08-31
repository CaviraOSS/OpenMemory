<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/architecture.md
 usage : documents LongMemory architecture
-->

# LongMemory Hydrograph architecture

LongMemory Hydrograph ships as one TypeScript npm package named `longmemory`.

The package has three public entry modes:

- library import from `src/index.ts`
- CLI binary named `longmemory`
- self-hosted API server from `src/server`

There is no separate SDK package. The package itself is the SDK.

## Phase 1 boundaries

Phase 1 creates the foundation only:

- package scripts
- CLI and server entry points
- `createMemory` placeholder
- invariants
- docs
- acceptance tests
- benchmark placeholder command

Phase 1 does not include production memory storage, dashboard, hosted service, graph visualization, vector database integration, or external connectors.

## Shared engine rule

The API server and CLI must both call `createMemory`. They must not construct separate engine paths.
