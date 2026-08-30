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
 *  file  : benchmarks/src/source_ref.ts
 *  usage : supports LongMemory benchmark source ref
 */

import { createHash } from "node:crypto";
import type { benchmark_event } from "./types";

export const benchmark_source_ref = (event: Pick<benchmark_event, "id" | "text">): string => createHash("sha256")
    .update(event.id)
    .update("\0")
    .update(event.text)
    .digest("hex");