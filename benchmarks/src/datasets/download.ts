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
 *  file  : benchmarks/src/datasets/download.ts
 *  usage : supports LongMemory benchmark download
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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

const beam_repo = "https://raw.githubusercontent.com/mohammadtavakoli78/BEAM/main/chats";
const beam_buckets: Array<{ bucket: "1M" | "10M"; conversations: number }> = [
    { bucket: "1M", conversations: 35 },
    { bucket: "10M", conversations: 10 },
];

const fetch_json = async (url: string, label: string): Promise<string> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${label}: http ${response.status} (${url})`);
    const body = await response.text();
    JSON.parse(body);
    return body;
};

export async function download_datasets(dir = resolve(process.cwd(), "benchmarks", "data", "external")): Promise<void> {
    mkdirSync(dir, { recursive: true });
    for (const source of sources) {
        process.stdout.write(`  ${source.name.padEnd(24)} `);
        const body = await fetch_json(source.url, source.name);
        writeFileSync(resolve(dir, source.file), body, "utf8");
        console.log(`${(Buffer.byteLength(body) / 1_048_576).toFixed(2)} mib`);
    }
    for (const { bucket, conversations } of beam_buckets) {
        console.log(`  beam ${bucket.toLowerCase()} (${conversations} conversations)`);
        for (let id = 1; id <= conversations; id++) {
            const directory = resolve(dir, "beam", bucket, String(id));
            mkdirSync(directory, { recursive: true });
            const chat_path = resolve(directory, "chat.json");
            const questions_path = resolve(directory, "probing_questions.json");
            if (existsSync(chat_path) && existsSync(questions_path)) { console.log(`    ${bucket}/${id} cached`); continue; }
            const chat = await fetch_json(`${beam_repo}/${bucket}/${id}/chat.json`, `beam ${bucket}/${id} chat`);
            writeFileSync(chat_path, chat, "utf8");
            const questions = await fetch_json(`${beam_repo}/${bucket}/${id}/probing_questions/probing_questions.json`, `beam ${bucket}/${id} questions`);
            writeFileSync(questions_path, questions, "utf8");
            console.log(`    ${bucket}/${id} ${(Buffer.byteLength(chat) / 1_048_576).toFixed(2)} mib`);
        }
    }
    writeFileSync(resolve(dir, "sources.json"), `${JSON.stringify([...sources, { name: "beam", url: "https://github.com/mohammadtavakoli78/BEAM", file: "beam/" }], null, 2)}\n`, "utf8");
}
