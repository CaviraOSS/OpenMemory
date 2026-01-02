// Export core functionality for use as a package

// Client library (library-style usage without server)
export { OpenMemory, createMemory } from "./client";
export type {
    OpenMemoryConfig,
    AddMemoryOptions,
    QueryOptions,
    UpdateMemoryOptions,
    hsg_q_result,
} from "./client";

// Core memory functions (for advanced usage)
export * from "./core/memory";

// Server exports (for running as a backend service)
export * from "./server/index";

// Ingestion operations
export * from "./ops/ingest";

// Data sources
export * as sources from "./sources";
