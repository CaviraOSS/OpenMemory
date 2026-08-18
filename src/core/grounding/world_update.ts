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
 *  file  : src/core/grounding/world_update.ts
 *  usage : external world update events for regrounding
 */






import type { GroundedFact } from './exocortex.js';

export type WorldUpdateKind = 'added' | 'updated' | 'expired' | 'removed';

export type WorldUpdateEvent = {
    ref: string;
    kind: WorldUpdateKind;
    
    fact: GroundedFact | null;
    at: number;
};
