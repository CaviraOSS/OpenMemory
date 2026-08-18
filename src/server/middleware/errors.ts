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
 *  file  : src/server/middleware/errors.ts
 *  usage : api errors and request validation
 */

export class api_error extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
        readonly details?: unknown,
    ) {
        super(message);
    }
}

export type clean_api_error = {
    status: number;
    body: { code: string; message: string; details?: unknown };
};

export function clean_error(error: unknown): clean_api_error {
    if (error instanceof api_error) {
        return {
            status: error.status,
            body: {
                code: error.code,
                message: error.message,
                ...(error.details === undefined ? {} : { details: error.details }),
            },
        };
    }
    return { status: 500, body: { code: 'internal_error', message: 'An internal error occurred' } };
}

export function expect_record(value: unknown, name = 'body'): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new api_error(400, 'validation_error', `${name} must be a JSON object`);
    return value as Record<string, unknown>;
}

export function required_string(value: Record<string, unknown>, key: string): string {
    const item = value[key];
    if (typeof item !== 'string' || !item.trim()) throw new api_error(400, 'validation_error', `${key} is required`);
    return item;
}

export function optional_string(value: Record<string, unknown>, key: string): void {
    if (value[key] !== undefined && typeof value[key] !== 'string') throw new api_error(400, 'validation_error', `${key} must be a string`);
}

export function optional_number(value: Record<string, unknown>, key: string, nullable = false): void {
    const item = value[key];
    if (item === undefined || (nullable && item === null)) return;
    if (typeof item !== 'number' || !Number.isFinite(item)) throw new api_error(400, 'validation_error', `${key} must be a finite number`);
}

export function optional_boolean(value: Record<string, unknown>, key: string): void {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') throw new api_error(400, 'validation_error', `${key} must be a boolean`);
}

export function optional_array(value: Record<string, unknown>, key: string, kind?: 'string' | 'number'): void {
    const item = value[key];
    if (item === undefined || item === null) return;
    if (!Array.isArray(item) || (kind && item.some((entry) => typeof entry !== kind))) {
        throw new api_error(400, 'validation_error', `${key} must be an array${kind ? ` of ${kind}s` : ''}`);
    }
}

export function optional_record(value: Record<string, unknown>, key: string): void {
    const item = value[key];
    if (item === undefined) return;
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new api_error(400, 'validation_error', `${key} must be an object`);
}