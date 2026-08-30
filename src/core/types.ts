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
 *  file  : src/core/types.ts
 *  usage : implements the LongMemory types component
 */

export type MemoryMode = 'strict' | 'historical' | 'associative' | 'grounded';

export type MemoryStatus = {
    name: 'longmemory-hydrograph';
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
