/*
 *   _____                 ___  ___
 *  |  _  |                |  \/  |
 *  | | | |_ __   ___ _ __ | .  . | ___ _ __ ___   ___  _ __ _   _
 *  | | | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 *  \ \_/ / |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
 *   \___/| .__/ \___|_| |_\_|  |_/\___|_| |_| |_|\___/|_|   \__, |
 *        | |                                                 __/ |
 *        |_|                                                |___/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/core/worlds/world_contracts.ts
 *  usage : resolves inherited/overridden world contracts
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
