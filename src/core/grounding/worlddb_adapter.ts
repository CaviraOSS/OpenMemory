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
 *  file  : src/core/grounding/worlddb_adapter.ts
 *  usage : implements the LongMemory worlddb adapter component
 */

import type { GroundedFact } from './exocortex.js';
import type { WorldUpdateEvent, WorldUpdateKind } from './world_update.js';

export interface WorldDBAdapter {
    get(ref: string): GroundedFact | null;
    search(query: string): GroundedFact[];
    validate(ref: string): boolean;
    subscribe?(handler: (event: WorldUpdateEvent) => void): () => void;
}

export type InMemoryWorldDBSnapshot = Map<string, GroundedFact>;
export type in_memory_worlddb_checkpoint = { readonly facts: Map<string, GroundedFact | undefined> };

const token_re = /[a-z0-9]+/g;

function tokens(text: string): Set<string> {
    return new Set((text || '').toLowerCase().match(token_re) ?? []);
}

export class InMemoryWorldDB implements WorldDBAdapter {
    private facts = new Map<string, GroundedFact>();
    private subscribers: Array<(event: WorldUpdateEvent) => void> = [];
    private readonly checkpoints = new Set<in_memory_worlddb_checkpoint>();

    constructor(private readonly now_fn: () => number = () => Date.now()) { }

    get(ref: string): GroundedFact | null {
        return this.facts.get(ref) ?? null;
    }

    search(query: string): GroundedFact[] {
        const q = tokens(query);
        const scored: Array<{ fact: GroundedFact; score: number }> = [];
        for (const fact of this.facts.values()) {
            const ft = tokens(fact.statement);
            let overlap = 0;
            for (const t of q) if (ft.has(t)) overlap++;
            if (overlap > 0) scored.push({ fact, score: overlap });
        }
        scored.sort((a, b) => b.score - a.score || (a.fact.ref < b.fact.ref ? -1 : 1));
        return scored.map((s) => s.fact);
    }

    validate(ref: string): boolean {
        return this.facts.has(ref);
    }

    snapshot(): InMemoryWorldDBSnapshot {
        return structuredClone(this.facts);
    }

    checkpoint(): in_memory_worlddb_checkpoint {
        const checkpoint = { facts: new Map<string, GroundedFact | undefined>() };
        this.checkpoints.add(checkpoint);
        return checkpoint;
    }

    commit(checkpoint: in_memory_worlddb_checkpoint): void {
        if (!this.checkpoints.delete(checkpoint)) throw new Error('InMemoryWorldDB: unknown checkpoint');
    }

    rollback(checkpoint: in_memory_worlddb_checkpoint): void {
        if (!this.checkpoints.delete(checkpoint)) throw new Error('InMemoryWorldDB: unknown checkpoint');
        for (const [ref, fact] of checkpoint.facts) {
            if (fact === undefined) this.facts.delete(ref);
            else this.facts.set(ref, fact);
        }
    }

    restore(snapshot: InMemoryWorldDBSnapshot): void {
        this.facts = structuredClone(snapshot);
    }

    subscribe(handler: (event: WorldUpdateEvent) => void): () => void {
        this.subscribers.push(handler);
        return () => {
            this.subscribers = this.subscribers.filter((h) => h !== handler);
        };
    }


    upsert(fact: GroundedFact): GroundedFact {
        this.track_fact(fact.ref);
        const kind: WorldUpdateKind = this.facts.has(fact.ref) ? 'updated' : 'added';
        this.facts.set(fact.ref, fact);
        this.emit({ ref: fact.ref, kind, fact, at: this.now_fn() });
        return fact;
    }


    expire(ref: string, at: number): void {
        const fact = this.facts.get(ref);
        if (!fact) return;
        this.track_fact(ref);
        const updated: GroundedFact = { ...fact, valid_to: at };
        this.facts.set(ref, updated);
        this.emit({ ref, kind: 'expired', fact: updated, at });
    }


    remove(ref: string, at: number): void {
        this.track_fact(ref);
        if (this.facts.delete(ref)) {
            this.emit({ ref, kind: 'removed', fact: null, at });
        }
    }

    private emit(event: WorldUpdateEvent): void {
        for (const handler of [...this.subscribers]) handler(event);
    }

    private track_fact(ref: string): void {
        for (const checkpoint of this.checkpoints) {
            if (!checkpoint.facts.has(ref)) checkpoint.facts.set(ref, this.facts.get(ref));
        }
    }
}
