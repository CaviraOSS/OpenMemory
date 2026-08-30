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
 *  file  : benchmarks/src/checkpoint.ts
 *  usage : supports LongMemory benchmark checkpoint
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { case_checkpoint, dataset_name, phase_record, run_checkpoint, run_manifest } from "./types";

const phase = (): phase_record => ({ status: "pending" });

export function new_case(case_id: string, corpus_id: string, dataset: dataset_name, category: string): case_checkpoint {
    return {
        case_id,
        corpus_id,
        dataset,
        category,
        phases: {
            ingest: phase(),
            indexing: phase(),
            search: phase(),
            evaluate: phase(),
            answer: phase(),
            judge: phase(),
        },
    };
}

const canonical = (manifest: run_manifest): string => JSON.stringify(manifest);
const retryable_codes = new Set(["EACCES", "EBUSY", "EPERM"]);
const retry_wait = new Int32Array(new SharedArrayBuffer(4));

export function load_checkpoint(path: string, run_id: string, manifest: run_manifest, resume: boolean): run_checkpoint {
    const now = new Date().toISOString();
    if (!resume || !existsSync(path)) {
        return { schema_version: 1, run_id, created_at: now, updated_at: now, manifest, providers: {} };
    }
    const checkpoint = JSON.parse(readFileSync(path, "utf8")) as run_checkpoint;
    if (checkpoint.schema_version !== 1 || checkpoint.run_id !== run_id) throw new Error(`checkpoint ${path} belongs to another run`);
    if (canonical(checkpoint.manifest) !== canonical(manifest)) throw new Error(`checkpoint ${path} has a different manifest; use --no-resume or a new --run-id`);
    return checkpoint;
}

export function save_checkpoint(path: string, checkpoint: run_checkpoint): void {
    mkdirSync(dirname(path), { recursive: true });
    checkpoint.updated_at = new Date().toISOString();
    const temporary = `${path}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
    for (let attempt = 0; ; attempt++) {
        try {
            renameSync(temporary, path);
            return;
        } catch (error) {
            const code = error instanceof Error && "code" in error ? String(error.code) : "";
            if (!retryable_codes.has(code) || attempt >= 49) throw error;
            Atomics.wait(retry_wait, 0, 0, Math.min(25 + attempt * 5, 100));
        }
    }
}

export function start_phase(item: case_checkpoint, name: keyof case_checkpoint["phases"]): void {
    item.phases[name] = { status: "running", started_at: new Date().toISOString() };
}

export function complete_phase(item: case_checkpoint, name: keyof case_checkpoint["phases"], duration_ms: number): void {
    item.phases[name] = {
        ...item.phases[name],
        status: "completed",
        completed_at: new Date().toISOString(),
        duration_ms,
    };
}

export function fail_phase(item: case_checkpoint, name: keyof case_checkpoint["phases"], duration_ms: number, error: unknown): void {
    item.phases[name] = {
        ...item.phases[name],
        status: "failed",
        completed_at: new Date().toISOString(),
        duration_ms,
        error: error instanceof Error ? error.message : String(error),
    };
}
