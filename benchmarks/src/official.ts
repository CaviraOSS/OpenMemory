#!/usr/bin/env node

export { };

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
    "--datasets=longmemeval,locomo",
    `--answerer=${answerer}`,
    `--judge=${judge}`,
];

await import("./cli.js");