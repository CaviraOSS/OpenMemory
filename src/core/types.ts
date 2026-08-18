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
 *  file  : src/core/types.ts
 *  usage : phase 1 engine handle types (mode, status, options)
 */

export type MemoryMode = 'strict' | 'historical' | 'associative' | 'grounded';

export type MemoryStatus = {
    name: 'openmemory-hydrograph';
    phase: 'phase-19-public-api';
    ready: boolean;
    store: 'memory' | 'sqlite';
};

export type MemoryEngine = {
    status(): MemoryStatus;
    invariants(): readonly string[];
};

export type CreateMemoryOptions = {
    readonly store?: 'memory' | 'sqlite';
    readonly db_path?: string;
};
