export default {
    test: {
        include: ["benchmarks/tests/**/*.test.ts"],
        environment: "node",
        testTimeout: 120_000,
        hookTimeout: 120_000,
        fileParallelism: false,
        pool: "forks",
        poolOptions: { forks: { singleFork: true } },
    },
};
