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
 *  file  : src/server/middleware/auth.ts
 *  usage : implements the LongMemory auth component
 */

import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { api_error } from './errors.js';

const equal = (left: string, right: string) => {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
};

export function authorize(request: IncomingMessage, api_key: string | null): void {
    if (!api_key) return;
    const bearer = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const header = request.headers['x-api-key'];
    const supplied = bearer ?? (Array.isArray(header) ? header[0] : header);
    if (!supplied || !equal(supplied, api_key)) throw new api_error(401, 'unauthorized', 'A valid API key is required');
}