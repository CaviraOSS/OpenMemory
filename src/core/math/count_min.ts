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
 *  file  : src/core/math/count_min.ts
 *  usage : bounded approximate frequency sketch
 */


export type CountMinSerialized = {
    kind: 'count-min';
    version: 1;
    width: number;
    depth: number;
    seeds: number[];
    tables: number[][];
    total: number;
};

export type CountMinOptions = {
    width?: number;
    depth?: number;
    seeds?: number[];
};

const default_width = 1024;
const default_depth = 4;
const max_counter = 0xffff_ffff;

function seed_for(row: number): number {
    return (0x9e37_79b9 ^ Math.imul(row + 1, 0x85eb_ca6b)) >>> 0;
}


function hash(value: string, seed: number): number {
    let out = (0x811c_9dc5 ^ seed) >>> 0;
    for (let i = 0; i < value.length; i++) {
        out ^= value.charCodeAt(i);
        out = Math.imul(out, 0x0100_0193) >>> 0;
    }
    out ^= out >>> 16;
    out = Math.imul(out, 0x7feb_352d) >>> 0;
    out ^= out >>> 15;
    return out >>> 0;
}

function positive_int(value: number, name: string): number {
    if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
    return value;
}

/**
 * Bounded approximate frequency counter. Estimates never undercount, modulo
 * uint32 saturation, and merge is exact when dimensions/seeds match.
 */
export class CountMinSketch {
    readonly width: number;
    readonly depth: number;
    readonly seeds: readonly number[];
    private readonly tables: Uint32Array[];
    private _total = 0;

    constructor(width?: number, depth?: number);
    constructor(options?: CountMinOptions);
    constructor(width_or_options: number | CountMinOptions = {}, depth = default_depth) {
        const options = typeof width_or_options === 'number'
            ? { width: width_or_options, depth }
            : width_or_options;
        this.width = positive_int(options.width ?? default_width, 'width');
        this.depth = positive_int(options.depth ?? default_depth, 'depth');
        const seeds = options.seeds ?? Array.from({ length: this.depth }, (_, row) => seed_for(row));
        if (seeds.length !== this.depth) throw new Error('seeds length must equal depth');
        this.seeds = seeds.map((seed) => seed >>> 0);
        this.tables = Array.from({ length: this.depth }, () => new Uint32Array(this.width));
    }

    get total(): number {
        return this._total;
    }

    get cells(): number {
        return this.width * this.depth;
    }

    add(key: string, count = 1): this {
        if (!Number.isFinite(count) || count < 0) throw new Error('count must be finite and non-negative');
        const amount = Math.floor(count);
        if (amount === 0) return this;
        for (let row = 0; row < this.depth; row++) {
            const column = hash(key, this.seeds[row]) % this.width;
            this.tables[row][column] = Math.min(max_counter, this.tables[row][column] + amount);
        }
        this._total += amount;
        return this;
    }

    estimate(key: string): number {
        let estimate = max_counter;
        for (let row = 0; row < this.depth; row++) {
            const column = hash(key, this.seeds[row]) % this.width;
            estimate = Math.min(estimate, this.tables[row][column]);
        }
        return estimate;
    }

    merge(other: CountMinSketch): this {
        if (other.width !== this.width || other.depth !== this.depth) {
            throw new Error('cannot merge Count-Min sketches with different dimensions');
        }
        if (other.seeds.some((seed, row) => seed !== this.seeds[row])) {
            throw new Error('cannot merge Count-Min sketches with different seeds');
        }
        const data = other.snapshot();
        for (let row = 0; row < this.depth; row++) {
            for (let column = 0; column < this.width; column++) {
                this.tables[row][column] = Math.min(
                    max_counter,
                    this.tables[row][column] + data.tables[row][column],
                );
            }
        }
        this._total += other.total;
        return this;
    }

    snapshot(): CountMinSerialized {
        return {
            kind: 'count-min',
            version: 1,
            width: this.width,
            depth: this.depth,
            seeds: [...this.seeds],
            tables: this.tables.map((row) => Array.from(row)),
            total: this._total,
        };
    }

    serialize(): string {
        return JSON.stringify(this.snapshot());
    }

    static deserialize(value: string | CountMinSerialized): CountMinSketch {
        const data = typeof value === 'string' ? JSON.parse(value) as CountMinSerialized : value;
        if (data.kind !== 'count-min' || data.version !== 1) throw new Error('unsupported Count-Min serialization');
        if (data.tables.length !== data.depth || data.tables.some((row) => row.length !== data.width)) {
            throw new Error('invalid Count-Min table dimensions');
        }
        const sketch = new CountMinSketch({ width: data.width, depth: data.depth, seeds: data.seeds });
        for (let row = 0; row < data.depth; row++) sketch.tables[row].set(data.tables[row]);
        sketch._total = data.total;
        return sketch;
    }
}