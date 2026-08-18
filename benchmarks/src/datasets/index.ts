import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { dataset_load, dataset_name } from "../types";
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
        const path = resolve(data_dir, name === "longmemeval" ? "longmemeval_oracle.json" : "locomo10.json");
        if (!existsSync(path)) throw new Error(`${name} data is missing at ${path}; run pnpm bench:data`);
        return name === "longmemeval" ? load_longmemeval(path, per_category, sample_offset) : load_locomo(path, per_category, sample_offset);
    });
}

export { load_locomo, load_longmemeval, smoke_cases };
