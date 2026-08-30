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
 *  file  : src/core/math/oja.ts
 *  usage : implements the LongMemory oja component
 */

export type OjaOptions = {
    learning_rate?: number;
    initial?: number[];
    normalize?: boolean;
};

export type OjaSerialized = {
    kind: 'oja';
    version: 1;
    dimension: number;
    learning_rate: number;
    normalize: boolean;
    observations: number;
    vector: number[];
};

function length(vector: readonly number[]): number {
    return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

function unit(vector: readonly number[]): number[] {
    const norm = length(vector);
    return norm === 0 ? [...vector] : vector.map((value) => value / norm);
}


export class OjaTracker {
    readonly dimension: number;
    readonly learning_rate: number;
    readonly normalize: boolean;
    private concept: number[];
    private _observations = 0;

    constructor(dimension: number, options: OjaOptions = {}) {
        if (!Number.isInteger(dimension) || dimension <= 0) throw new Error('dimension must be a positive integer');
        const rate = options.learning_rate ?? 0.05;
        if (!Number.isFinite(rate) || rate <= 0 || rate > 1) throw new Error('learningRate must be in (0,1]');
        const initial = options.initial ?? new Array<number>(dimension).fill(1 / Math.sqrt(dimension));
        if (initial.length !== dimension || !initial.every(Number.isFinite)) throw new Error('invalid initial concept vector');
        this.dimension = dimension;
        this.learning_rate = rate;
        this.normalize = options.normalize ?? true;
        this.concept = this.normalize ? unit(initial) : [...initial];
    }

    get vector(): number[] {
        return [...this.concept];
    }

    get observations(): number {
        return this._observations;
    }

    update(input: readonly number[], weight = 1): this {
        if (input.length !== this.dimension) throw new Error('vector dimension mismatch');
        if (!input.every(Number.isFinite)) throw new Error('vector must contain finite values');
        if (!Number.isFinite(weight) || weight < 0) throw new Error('weight must be finite and non-negative');
        if (weight === 0) return this;
        let projection = 0;
        for (let i = 0; i < this.dimension; i++) projection += this.concept[i] * input[i];
        const rate = this.learning_rate * weight;
        const next = this.concept.map((value, index) =>
            value + rate * projection * (input[index] - projection * value));
        this.concept = this.normalize ? unit(next) : next;
        this._observations++;
        return this;
    }

    merge(other: OjaTracker, other_weight?: number): this {
        if (other.dimension !== this.dimension) throw new Error('cannot merge Oja trackers with different dimensions');
        const right = other_weight ?? other.observations;
        const left = this.observations;
        const total = left + right;
        if (total <= 0) return this;
        const mixed = this.concept.map((value, index) =>
            (value * left + other.concept[index] * right) / total);
        this.concept = this.normalize ? unit(mixed) : mixed;
        this._observations += other.observations;
        return this;
    }

    snapshot(): OjaSerialized {
        return {
            kind: 'oja',
            version: 1,
            dimension: this.dimension,
            learning_rate: this.learning_rate,
            normalize: this.normalize,
            observations: this._observations,
            vector: this.vector,
        };
    }

    serialize(): string {
        return JSON.stringify(this.snapshot());
    }

    static deserialize(value: string | OjaSerialized): OjaTracker {
        const data = typeof value === 'string' ? JSON.parse(value) as OjaSerialized : value;
        if (data.kind !== 'oja' || data.version !== 1) throw new Error('unsupported Oja serialization');
        const tracker = new OjaTracker(data.dimension, {
            learning_rate: data.learning_rate,
            initial: data.vector,
            normalize: data.normalize,
        });
        tracker.concept = [...data.vector];
        tracker._observations = data.observations;
        return tracker;
    }
}

export { OjaTracker as OjaSketch };