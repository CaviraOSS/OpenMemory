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
 *  file  : benchmarks/src/datasets/index.ts
 *  usage : supports LongMemory benchmark index
 */


import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { dataset_load, dataset_name } from "../types";
import { load_beam } from "./beam";
import { load_locomo, load_longmemeval } from "./public";
import { smoke_cases } from "./smoke";

export function load_datasets(names: dataset_name[], per_category: number, sample_offset = 0, data_dir = resolve(process.cwd(), "benchmarks", "data", "external")): dataset_load[] {
    return names.map((name): dataset_load => {
        if (name === "smoke") return {
            name,
            official: false,
            source: "embedded deterministic fixtures",
            path: null,
            cases: smoke_cases,
        };
        if (name === "beam-1m" || name === "beam-10m") return load_beam(resolve(data_dir, "beam"), name === "beam-1m" ? "1M" : "10M", per_category, sample_offset);
        const path = resolve(data_dir, name === "longmemeval" ? "longmemeval_oracle.json" : "locomo10.json");
        if (!existsSync(path)) throw new Error(`${name} data is missing at ${path}; run pnpm bench:data`);
        return name === "longmemeval" ? load_longmemeval(path, per_category, sample_offset) : load_locomo(path, per_category, sample_offset);
    });
}

export { load_beam, load_locomo, load_longmemeval, smoke_cases };
