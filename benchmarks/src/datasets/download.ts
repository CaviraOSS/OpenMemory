#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sources = [
    {
        name: "longmemeval oracle",
        url: "https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/main/longmemeval_oracle.json",
        file: "longmemeval_oracle.json",
    },
    {
        name: "locomo 10",
        url: "https://raw.githubusercontent.com/snap-research/locomo/main/data/locomo10.json",
        file: "locomo10.json",
    },
] as const;

export async function download_datasets(dir = resolve(process.cwd(), "benchmarks", "data", "external")): Promise<void> {
    mkdirSync(dir, { recursive: true });
    for (const source of sources) {
        process.stdout.write(`  ${source.name.padEnd(24)} `);
        const response = await fetch(source.url);
        if (!response.ok) throw new Error(`${source.name}: http ${response.status}`);
        const body = await response.text();
        JSON.parse(body);
        writeFileSync(resolve(dir, source.file), body, "utf8");
        console.log(`${(Buffer.byteLength(body) / 1_048_576).toFixed(2)} mib`);
    }
    writeFileSync(resolve(dir, "sources.json"), `${JSON.stringify(sources, null, 2)}\n`, "utf8");
}
