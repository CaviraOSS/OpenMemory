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
 *  file  : src/core/recall/matrix_fusion.ts
 *  usage : implements the LongMemory matrix fusion component
 */


export type matrix_feature = {
    name: string;
    values: ArrayLike<number>;
    weight: number;
};

export type matrix_fusion_options = {
    regularization?: number;
    temperature?: number;
    clip?: number;
};

export type matrix_fusion_result = {
    scores: Float64Array;
    calibrated: number[][];
    whitened: number[][];
    covariance: number[][];
    active_features: string[];
    regularization: number;
    temperature: number;
};

export type sparse_seed_options = {
    quantile?: number;
    max_seeds?: number;
    max_density?: number;
};

export type sparse_seed_result = {
    seeds: Map<string, number>;
    threshold: number;
    density: number;
};

const epsilon = 1e-9;

export function select_sparse_seeds(
    ids: readonly string[],
    scores: ArrayLike<number>,
    options: sparse_seed_options = {},
): sparse_seed_result {
    if (ids.length !== scores.length) throw new Error('seed ids and scores must have equal lengths');
    if (ids.length === 0) return { seeds: new Map(), threshold: 0, density: 0 };
    const quantile = Math.max(0, Math.min(1, options.quantile ?? 0.9));
    const max_seeds = Math.max(1, Math.floor(options.max_seeds ?? 32));
    const max_density = Math.max(0, Math.min(1, options.max_density ?? 0.15));
    const quantile_count = Math.max(1, Math.ceil(ids.length * (1 - quantile)));
    const density_count = Math.max(1, Math.floor(ids.length * max_density));
    const count = Math.min(ids.length, max_seeds, quantile_count, density_count);
    const ranked = ids.map((id, index) => ({ id, index, score: Number(scores[index]) || 0 }))
        .sort((left, right) => right.score - left.score || left.index - right.index);
    const threshold = ranked[count]?.score ?? ranked[count - 1].score;
    const seeds = new Map<string, number>();
    for (const item of ranked.slice(0, count)) seeds.set(item.id, Math.max(epsilon, item.score - threshold));
    return { seeds, threshold, density: seeds.size / ids.length };
}

function median(values: readonly number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    const middle = sorted.length >>> 1;
    return sorted.length % 2 ? sorted[middle] : 0.5 * (sorted[middle - 1] + sorted[middle]);
}

function empirical(values: readonly number[]): number[] {
    if (values.length <= 1) return values.map(() => 0);
    const order = values.map((value, index) => ({ value, index })).sort((left, right) => left.value - right.value || left.index - right.index);
    const output = new Array<number>(values.length).fill(0);
    let start = 0;
    while (start < order.length) {
        let end = start + 1;
        while (end < order.length && order[end].value === order[start].value) end++;
        const rank = 0.5 * (start + end - 1);
        const value = 2 * rank / (order.length - 1) - 1;
        for (let index = start; index < end; index++) output[order[index].index] = value;
        start = end;
    }
    return output;
}

function calibrate(values: readonly number[], clip: number): number[] {
    const center = median(values);
    const mad = median(values.map((value) => Math.abs(value - center)));
    if (mad <= epsilon) return empirical(values);
    const scale = 1.4826 * mad + epsilon;
    return values.map((value) => Math.max(-clip, Math.min(clip, (value - center) / scale)));
}

function identity(size: number): number[][] {
    return Array.from({ length: size }, (_, row) =>
        Array.from({ length: size }, (_, column) => row === column ? 1 : 0));
}

function covariance(matrix: readonly (readonly number[])[], regularization: number): number[][] {
    const rows = matrix.length;
    const columns = matrix[0]?.length ?? 0;
    const output = Array.from({ length: columns }, () => new Array<number>(columns).fill(0));
    const denominator = Math.max(1, rows - 1);
    for (let left = 0; left < columns; left++) {
        for (let right = left; right < columns; right++) {
            let value = 0;
            for (let row = 0; row < rows; row++) value += matrix[row][left] * matrix[row][right];
            value /= denominator;
            output[left][right] = value;
            output[right][left] = value;
        }
        output[left][left] += regularization;
    }
    return output;
}

type eigen_pair = { value: number; vector: number[] };

function eigen_symmetric(input: readonly (readonly number[])[]): eigen_pair[] {
    const size = input.length;
    const matrix = input.map((row) => [...row]);
    const vectors = identity(size);
    const iterations = Math.max(24, size * size * 48);
    for (let iteration = 0; iteration < iterations; iteration++) {
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
        value: Math.max(epsilon, matrix[index][index]),
        vector: vectors.map((row) => row[index]),
    })).sort((left, right) => right.value - left.value);
}

function inverse_square_root(matrix: readonly (readonly number[])[]): number[][] {
    const pairs = eigen_symmetric(matrix);
    const size = matrix.length;
    const output = Array.from({ length: size }, () => new Array<number>(size).fill(0));
    for (const pair of pairs) {
        const scale = 1 / Math.sqrt(pair.value);
        for (let row = 0; row < size; row++) {
            for (let column = 0; column < size; column++) {
                output[row][column] += scale * pair.vector[row] * pair.vector[column];
            }
        }
    }
    return output;
}

function multiply(left: readonly (readonly number[])[], right: readonly (readonly number[])[]): number[][] {
    const rows = left.length;
    const inner = right.length;
    const columns = right[0]?.length ?? 0;
    const output = Array.from({ length: rows }, () => new Array<number>(columns).fill(0));
    for (let row = 0; row < rows; row++) {
        for (let middle = 0; middle < inner; middle++) {
            const value = left[row][middle];
            if (value === 0) continue;
            for (let column = 0; column < columns; column++) output[row][column] += value * right[middle][column];
        }
    }
    return output;
}

export function matrix_fusion(features: readonly matrix_feature[], options: matrix_fusion_options = {}): matrix_fusion_result {
    const regularization = options.regularization ?? 0.2;
    const temperature = options.temperature ?? 0.65;
    const clip = options.clip ?? 4;
    if (!Number.isFinite(regularization) || regularization <= 0) throw new Error('regularization must be positive');
    if (!Number.isFinite(temperature) || temperature <= 0) throw new Error('temperature must be positive');
    const active = features.filter((feature) => feature.weight > 0 && feature.values.length > 0);
    const rows = active[0]?.values.length ?? 0;
    if (active.some((feature) => feature.values.length !== rows)) throw new Error('matrix feature row counts must match');
    if (rows === 0 || active.length === 0) return {
        scores: new Float64Array(rows), calibrated: [], whitened: [], covariance: [],
        active_features: [], regularization, temperature,
    };
    const columns = active.map((feature) => calibrate(Array.from(feature.values), clip));
    const calibrated = Array.from({ length: rows }, (_, row) => columns.map((column) => column[row]));
    const feature_covariance = covariance(calibrated, regularization);
    const whitened = multiply(calibrated, inverse_square_root(feature_covariance));
    const adjusted_weights = active.map((feature, column) => {
        let redundancy = 1;
        for (let other = 0; other < active.length; other++) {
            if (other === column) continue;
            const denominator = Math.sqrt(feature_covariance[column][column] * feature_covariance[other][other]);
            const correlation = denominator > 0 ? feature_covariance[column][other] / denominator : 0;
            redundancy += Math.max(0, correlation);
        }
        return feature.weight / redundancy;
    });
    const weight_total = adjusted_weights.reduce((sum, weight) => sum + weight, 0);
    const weights = adjusted_weights.map((weight) => weight / weight_total);
    const fused = new Float64Array(rows);
    for (let row = 0; row < rows; row++) {
        let maximum = Number.NEGATIVE_INFINITY;
        for (let column = 0; column < active.length; column++) {
            const value = calibrated[row][column] / temperature + Math.log(weights[column]);
            if (value > maximum) maximum = value;
        }
        let mass = 0;
        for (let column = 0; column < active.length; column++) {
            mass += Math.exp(calibrated[row][column] / temperature + Math.log(weights[column]) - maximum);
        }
        fused[row] = temperature * (maximum + Math.log(mass));
    }
    const low = Math.min(...fused);
    const high = Math.max(...fused);
    const scores = new Float64Array(rows);
    if (high - low <= epsilon) scores.fill(0.5);
    else for (let row = 0; row < rows; row++) scores[row] = (fused[row] - low) / (high - low);
    return {
        scores,
        calibrated,
        whitened,
        covariance: feature_covariance,
        active_features: active.map((feature) => feature.name),
        regularization,
        temperature,
    };
}
