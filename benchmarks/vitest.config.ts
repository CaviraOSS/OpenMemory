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
 *  file  : benchmarks/vitest.config.ts
 *  usage : supports LongMemory benchmark vitest.config
 */

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
