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
 *  file  : src/core/resolver/alias_index.ts
 *  usage : implements the LongMemory alias index component
 */


import { normalize_name } from './entity_score.js';

export type alias_index_checkpoint = {
    readonly values: Map<string, string | undefined>;
};

export class AliasIndex {
    private index = new Map<string, string>();
    private readonly checkpoints = new Set<alias_index_checkpoint>();

    add(alias: string, entity_id: string): void {
        const key = normalize_name(alias);
        if (key.length === 0) return;
        for (const checkpoint of this.checkpoints) {
            if (!checkpoint.values.has(key)) checkpoint.values.set(key, this.index.get(key));
        }
        this.index.set(key, entity_id);
    }

    lookup(name: string): string | undefined {
        return this.index.get(normalize_name(name));
    }

    has(name: string): boolean {
        return this.index.has(normalize_name(name));
    }

    entries_for(entity_id: string): string[] {
        const out: string[] = [];
        for (const [alias, id] of this.index) if (id === entity_id) out.push(alias);
        return out.sort();
    }

    snapshot(): Map<string, string> {
        return new Map(this.index);
    }

    checkpoint(): alias_index_checkpoint {
        const checkpoint = { values: new Map<string, string | undefined>() };
        this.checkpoints.add(checkpoint);
        return checkpoint;
    }

    commit(checkpoint: alias_index_checkpoint): void {
        if (!this.checkpoints.delete(checkpoint)) throw new Error('AliasIndex: unknown checkpoint');
    }

    rollback(checkpoint: alias_index_checkpoint): void {
        if (!this.checkpoints.delete(checkpoint)) throw new Error('AliasIndex: unknown checkpoint');
        for (const [key, value] of checkpoint.values) {
            if (value === undefined) this.index.delete(key);
            else this.index.set(key, value);
        }
    }

    restore(snap: Map<string, string>): void {
        this.index = new Map(snap);
    }
}
