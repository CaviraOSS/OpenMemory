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
 *  file  : src/core/math/frequent_directions.ts
 *  usage : implements the LongMemory frequent directions component
 */

export type FrequentDirectionsSerialized = {
    kind: 'frequent-directions';
    version: 1;
    dimension: number;
    max_rows: number;
    updates: number;
    matrix: number[][];
};

type EigenPair = { value: number; vector: number[] };

function positive_int(value: number, name: string): number {
    if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
    return value;
}

function dot(left: readonly number[], right: readonly number[]): number {
    let out = 0;
    for (let i = 0; i < left.length; i++) out += left[i] * right[i];
    return out;
}

function norm(vector: readonly number[]): number {
    return Math.sqrt(dot(vector, vector));
}

/** Jacobi eigensolver for the small symmetric row Gram matrix. */
function eigen_symmetric(input: number[][]): EigenPair[] {
    const size = input.length;
    const matrix = input.map((row) => [...row]);
    const vectors: number[][] = Array.from({ length: size }, (_, row) =>
        Array.from({ length: size }, (_, column): number => row === column ? 1 : 0));
    const max_iterations = Math.max(16, size * size * 32);

    for (let iteration = 0; iteration < max_iterations; iteration++) {
        let p = 0;
        let q = 0;
        let largest = 0;
        for (let row = 0; row < size; row++) {
            for (let column = row + 1; column < size; column++) {
                const value = Math.abs(matrix[row][column]);
                if (value > largest) { largest = value; p = row; q = column; }
            }
        }
        if (largest < 1e-10) break;

        const angle = 0.5 * Math.atan2(2 * matrix[p][q], matrix[q][q] - matrix[p][p]);
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const pp = matrix[p][p];
        const qq = matrix[q][q];
        const pq = matrix[p][q];
        matrix[p][p] = cosine * cosine * pp - 2 * sine * cosine * pq + sine * sine * qq;
        matrix[q][q] = sine * sine * pp + 2 * sine * cosine * pq + cosine * cosine * qq;
        matrix[p][q] = 0;
        matrix[q][p] = 0;

        for (let index = 0; index < size; index++) {
            if (index !== p && index !== q) {
                const ip = matrix[index][p];
                const iq = matrix[index][q];
                matrix[index][p] = cosine * ip - sine * iq;
                matrix[p][index] = matrix[index][p];
                matrix[index][q] = sine * ip + cosine * iq;
                matrix[q][index] = matrix[index][q];
            }
            const vp = vectors[index][p];
            const vq = vectors[index][q];
            vectors[index][p] = cosine * vp - sine * vq;
            vectors[index][q] = sine * vp + cosine * vq;
        }
    }

    return Array.from({ length: size }, (_, index) => ({
        value: Math.max(0, matrix[index][index]),
        vector: vectors.map((row) => row[index]),
    })).sort((left, right) => right.value - left.value);
}

/**
 * Frequent Directions-style bounded matrix sketch. Once the row budget is
 * exceeded, singular directions are shrunk by the discarded singular value.
 */
export class FrequentDirections {
    readonly dimension: number;
    readonly max_rows: number;
    private rows: number[][] = [];
    private _updates = 0;

    constructor(dimension: number, max_rows = 8) {
        this.dimension = positive_int(dimension, 'dimension');
        this.max_rows = positive_int(max_rows, 'maxRows');
    }

    get size(): number {
        return this.rows.length;
    }

    get updates(): number {
        return this._updates;
    }

    get matrix(): number[][] {
        return this.rows.map((row) => [...row]);
    }

    update(vector: readonly number[], weight = 1): this {
        if (vector.length !== this.dimension) throw new Error('vector dimension mismatch');
        if (!vector.every(Number.isFinite)) throw new Error('vector must contain finite values');
        if (!Number.isFinite(weight) || weight < 0) throw new Error('weight must be finite and non-negative');
        if (weight === 0) return this;
        const scale = Math.sqrt(weight);
        this.rows.push(vector.map((value) => value * scale));
        this._updates++;
        if (this.rows.length > this.max_rows) this.compress();
        return this;
    }

    merge(other: FrequentDirections): this {
        if (other.dimension !== this.dimension) throw new Error('cannot merge matrix sketches with different dimensions');
        const prior_updates = this._updates;
        for (const row of other.matrix) this.update(row);
        this._updates = prior_updates + other.updates;
        return this;
    }

    /** Dominant compressed concept direction, normalized to unit length. */
    concept_vector(): number[] {
        if (this.rows.length === 0) return new Array(this.dimension).fill(0);
        const gram = this.row_gram();
        const principal = eigen_symmetric(gram)[0];
        if (!principal || principal.value <= 1e-12) return new Array(this.dimension).fill(0);
        const out = new Array<number>(this.dimension).fill(0);
        for (let row = 0; row < this.rows.length; row++) {
            for (let column = 0; column < this.dimension; column++) {
                out[column] += this.rows[row][column] * principal.vector[row];
            }
        }
        const length = norm(out);
        return length === 0 ? out : out.map((value) => value / length);
    }

    private row_gram(): number[][] {
        return this.rows.map((left) => this.rows.map((right) => dot(left, right)));
    }

    private compress(): void {
        const source = this.rows;
        const pairs = eigen_symmetric(this.row_gram());
        const delta = pairs[Math.min(this.max_rows, pairs.length - 1)]?.value ?? 0;
        const compressed: number[][] = [];
        for (const pair of pairs.slice(0, this.max_rows)) {
            if (pair.value <= 1e-12) continue;
            const right = new Array<number>(this.dimension).fill(0);
            const sigma = Math.sqrt(pair.value);
            for (let row = 0; row < source.length; row++) {
                for (let column = 0; column < this.dimension; column++) {
                    right[column] += source[row][column] * pair.vector[row] / sigma;
                }
            }
            const shrunk = Math.sqrt(Math.max(0, pair.value - delta));
            const output = right.map((value) => value * shrunk);
            if (norm(output) > 1e-10) compressed.push(output);
        }
        this.rows = compressed;
    }

    snapshot(): FrequentDirectionsSerialized {
        return {
            kind: 'frequent-directions',
            version: 1,
            dimension: this.dimension,
            max_rows: this.max_rows,
            updates: this._updates,
            matrix: this.matrix,
        };
    }

    serialize(): string {
        return JSON.stringify(this.snapshot());
    }

    static deserialize(value: string | FrequentDirectionsSerialized): FrequentDirections {
        const data = typeof value === 'string' ? JSON.parse(value) as FrequentDirectionsSerialized : value;
        if (data.kind !== 'frequent-directions' || data.version !== 1) throw new Error('unsupported matrix sketch serialization');
        if (data.matrix.length > data.max_rows || data.matrix.some((row) => row.length !== data.dimension)) {
            throw new Error('invalid matrix sketch dimensions');
        }
        const sketch = new FrequentDirections(data.dimension, data.max_rows);
        sketch.rows = data.matrix.map((row) => [...row]);
        sketch._updates = data.updates;
        return sketch;
    }
}

export { FrequentDirections as FrequentDirectionsSketch };