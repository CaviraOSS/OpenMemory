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
 *  file  : src/core/memory/working_memory.ts
 *  usage : bounded raw-event buffer before durable ingestion
 */

import type { MemoryEvent } from '../engine/perception_parser.js';

export type WorkingMemoryEntry = {
    sequence: number;
    received_at: number;
    event: MemoryEvent;
};

export type WorkingMemorySnapshot = {
    sequence: number;
    entries: WorkingMemoryEntry[];
};

export type working_memory_checkpoint = {
    sequence: number;
    entries: readonly WorkingMemoryEntry[];
};

export class WorkingMemory {
    private entries: WorkingMemoryEntry[] = [];
    private sequence = 0;

    constructor(readonly capacity = 128) {
        if (!Number.isInteger(capacity) || capacity <= 0) throw new Error('working memory capacity must be positive');
    }

    push(event: MemoryEvent, received_at = Date.now()): WorkingMemoryEntry {
        const entry = { sequence: ++this.sequence, received_at: received_at, event: structuredClone(event) };
        this.entries.push(entry);
        if (this.entries.length > this.capacity) this.entries.shift();
        return entry;
    }

    recent(limit = this.capacity): WorkingMemoryEntry[] {
        return this.entries.slice(-Math.max(0, limit)).map((entry) => structuredClone(entry));
    }

    get size(): number {
        return this.entries.length;
    }

    snapshot(): WorkingMemorySnapshot {
        return { sequence: this.sequence, entries: structuredClone(this.entries) };
    }

    checkpoint(): working_memory_checkpoint {
        return { sequence: this.sequence, entries: this.entries.slice() };
    }

    rollback(checkpoint: working_memory_checkpoint): void {
        this.sequence = checkpoint.sequence;
        this.entries = checkpoint.entries.slice();
    }

    restore(snapshot: WorkingMemorySnapshot): void {
        this.sequence = snapshot.sequence;
        this.entries = structuredClone(snapshot.entries);
    }
}