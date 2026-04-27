import { defineConfig } from "vitest/config";

// Tests run sequentially because the SQLite metadata backend is a shared
// on-disk file under data/openmemory.sqlite. Running concurrently would
// race on WAL writes / DELETE FROM cleanup statements.
export default defineConfig({
    test: {
        include: ["tests/**/*.{test,spec}.ts"],
        environment: "node",
        // 60s per test — the omnibus phases sleep up to ~1s between writes
        // and the evolutionary stability phase advances mocked time across
        // 10 generations of search() calls.
        testTimeout: 60_000,
        hookTimeout: 60_000,
        // Force sequential execution (no parallel files, no thread pool fanout).
        fileParallelism: false,
        pool: "forks",
        poolOptions: {
            forks: {
                singleFork: true,
            },
        },
        // Force synthetic embeddings + sqlite backend so no API keys or
        // external services are needed. NODE_ENV defaults to "test".
        env: {
            NODE_ENV: "test",
            OM_EMBEDDINGS: "synthetic",
            OM_EMBEDDING_FALLBACK: "synthetic",
            OM_METADATA_BACKEND: "sqlite",
            OM_VECTOR_BACKEND: "sqlite",
        },
    },
});
