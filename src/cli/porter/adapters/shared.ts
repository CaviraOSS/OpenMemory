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
 *  file  : src/cli/porter/adapters/shared.ts
 *  usage : implements the LongMemory shared component
 */

import { homedir } from 'node:os';
import { posix, win32 } from 'node:path';

export type json = Record<string, any>;

export const object = (value: unknown): json => value && typeof value === 'object' && !Array.isArray(value) ? value as json : {};
export const epoch = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return undefined;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};
export const text_content = (value: unknown): string => {
    if (typeof value === 'string') return value.trim();
    if (!Array.isArray(value)) return '';
    return value.flatMap((part) => {
        if (typeof part === 'string') return [part];
        const item = object(part);
        return typeof item.text === 'string' && (!item.type || ['text', 'input_text', 'output_text'].includes(item.type)) ? [item.text] : [];
    }).join('\n').trim();
};

export const editor_storage_roots = (env: NodeJS.ProcessEnv, platform: NodeJS.Platform = process.platform): string[] => {
    const home = env.HOME ?? env.USERPROFILE ?? homedir();
    const path = platform === 'win32' ? win32 : posix;
    const base = platform === 'win32' ? env.APPDATA ?? path.join(home, 'AppData/Roaming')
        : platform === 'darwin' ? path.join(home, 'Library/Application Support') : env.XDG_CONFIG_HOME ?? path.join(home, '.config');
    return ['Code', 'Code - Insiders', 'VSCodium', 'Cursor'].map((product) => path.join(base, product, 'User'));
};