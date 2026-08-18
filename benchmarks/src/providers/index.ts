import type { benchmark_provider, provider_name } from "../types";
import { cognee_provider } from "./cognee";
import { graphiti_provider } from "./graphiti";
import { mem0_provider } from "./mem0";
import { openmemory_provider } from "./openmemory";
import { supermemory_provider } from "./supermemory";

export function create_provider(name: provider_name): benchmark_provider {
    if (name === "openmemory") return new openmemory_provider();
    if (name === "supermemory") return new supermemory_provider();
    if (name === "mem0") return new mem0_provider();
    if (name === "graphiti") return new graphiti_provider();
    return new cognee_provider();
}

export { cognee_provider, graphiti_provider, mem0_provider, openmemory_provider, supermemory_provider };
