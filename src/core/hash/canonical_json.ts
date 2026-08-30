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
 *  file  : src/core/hash/canonical_json.ts
 *  usage : implements the LongMemory canonical json component
 */

export function canonicalize(value: unknown): string {
    return serialize(value);
}

function serialize(value: unknown): string {
    if (value === null) return 'null';

    const t = typeof value;

    if (t === 'number') {
        if (!Number.isFinite(value as number)) {
            throw new Error('canonicalize: non-finite number is not allowed');
        }
        return JSON.stringify(value);
    }

    if (t === 'string' || t === 'boolean') {
        return JSON.stringify(value);
    }

    if (t === 'bigint') {
        return JSON.stringify((value as bigint).toString());
    }

    if (Array.isArray(value)) {
        return '[' + value.map((v) => serialize(v === undefined ? null : v)).join(',') + ']';
    }

    if (t === 'object') {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj)
            .filter((k) => obj[k] !== undefined)
            .sort();
        const parts = keys.map((k) => JSON.stringify(k) + ':' + serialize(obj[k]));
        return '{' + parts.join(',') + '}';
    }

    throw new Error(`canonicalize: unsupported value of type ${t}`);
}
