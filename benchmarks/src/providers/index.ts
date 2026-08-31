/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : benchmarks/src/providers/index.ts
 *  usage : supports LongMemory benchmark index
 */


import type { benchmark_provider, provider_name } from "../types";
import { cognee_provider } from "./cognee";
import { graphiti_provider } from "./graphiti";
import { mem0_provider } from "./mem0";
import { longmemory_provider } from "./longmemory";
import { supermemory_provider } from "./supermemory";

export function create_provider(name: provider_name): benchmark_provider {
    if (name === "longmemory") return new longmemory_provider();
    if (name === "supermemory") return new supermemory_provider();
    if (name === "mem0") return new mem0_provider();
    if (name === "graphiti") return new graphiti_provider();
    return new cognee_provider();
}

export { cognee_provider, graphiti_provider, mem0_provider, longmemory_provider, supermemory_provider };
