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
 *  file  : src/core/worlds/world_contracts.ts
 *  usage : implements the LongMemory world contracts component
 */

import { default_contract, type Contract } from '../types/contract.js';
import type { World } from '../types/world.js';





export function resolve_world_contracts(chain: readonly World[], base: Contract = default_contract()): Contract {
    let effective: Contract = { ...base };
    for (const world of chain) {
        effective = { ...effective, ...world.contracts };
    }
    return effective;
}
