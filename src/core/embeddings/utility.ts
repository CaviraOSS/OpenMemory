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
 *  file  : src/core/embeddings/utility.ts
 *  usage : implements the LongMemory utility component
 */


export function normalize_embedding_vector(vector: unknown, dimension: number): number[] {
    if (!Array.isArray(vector) || !vector.length) throw new Error('embedding provider returned an empty vector');
    const values = vector.map(Number);
    if (values.some((value) => !Number.isFinite(value))) throw new Error('embedding provider returned a non-finite vector');
    const resized = values.length >= dimension ? values.slice(0, dimension) : [...values, ...new Array(dimension - values.length).fill(0)];
    const norm = Math.sqrt(resized.reduce((sum, value) => sum + value * value, 0));
    return norm ? resized.map((value) => value / norm) : resized;
}

export async function request_json(
    fetcher: typeof fetch,
    url: string,
    init: RequestInit,
    options: { timeout_ms: number; max_retries: number; retry_base_ms: number },
): Promise<any> {
    let last: unknown;
    for (let attempt = 0; attempt <= options.max_retries; attempt++) {
        try {
            const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(options.timeout_ms) });
            if (response.ok) return response.json();
            const detail = (await response.text()).slice(0, 500);
            const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
            if (!retryable || attempt === options.max_retries) throw new Error(`${response.status} ${response.statusText}${detail ? `: ${detail}` : ''}`);
            const retry_after = Number(response.headers.get('retry-after')) * 1_000;
            await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retry_after) && retry_after > 0 ? retry_after : options.retry_base_ms * 2 ** attempt));
        } catch (error) {
            last = error;
            if (attempt === options.max_retries || !(error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError'))) throw error;
            await new Promise((resolve) => setTimeout(resolve, options.retry_base_ms * 2 ** attempt));
        }
    }
    throw last;
}