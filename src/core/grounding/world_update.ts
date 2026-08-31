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
 *  file  : src/core/grounding/world_update.ts
 *  usage : implements the LongMemory world update component
 */


import type { GroundedFact } from './exocortex.js';

export type WorldUpdateKind = 'added' | 'updated' | 'expired' | 'removed';

export type WorldUpdateEvent = {
    ref: string;
    kind: WorldUpdateKind;
    
    fact: GroundedFact | null;
    at: number;
};
