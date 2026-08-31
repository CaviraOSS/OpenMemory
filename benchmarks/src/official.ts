#!/usr/bin/env node
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
 *  file  : benchmarks/src/official.ts
 *  usage : supports LongMemory benchmark official
 */


import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

export { };

const env_file = resolve(dirname(fileURLToPath(import.meta.url)), "..", "comparative.env");
if (existsSync(env_file)) Object.assign(process.env, parseEnv(readFileSync(env_file, "utf8")));

const answerer = process.env.BENCH_OFFICIAL_ANSWERER;
const judge = process.env.BENCH_OFFICIAL_JUDGE;

if (!answerer || !judge) {
    console.error("official benchmarks require BENCH_OFFICIAL_ANSWERER and BENCH_OFFICIAL_JUDGE in provider:model format");
    process.exit(1);
}

process.argv = [
    process.argv[0],
    process.argv[1],
    "run",
    ...process.argv.slice(2),
    "--providers=longmemory",
    "--datasets=longmemeval,locomo",
    `--answerer=${answerer}`,
    `--judge=${judge}`,
];

await import("./cli.js");