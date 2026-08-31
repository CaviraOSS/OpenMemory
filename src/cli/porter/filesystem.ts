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
 *  file  : src/cli/porter/filesystem.ts
 *  usage : implements the LongMemory filesystem component
 */


import { accessSync, constants, existsSync, readdirSync, statSync, type Dirent } from 'node:fs';
import { delimiter, join } from 'node:path';

export const is_directory = (path: string): boolean => {
    try { return statSync(path).isDirectory(); } catch { return false; }
};

export const is_file = (path: string): boolean => {
    try { return statSync(path).isFile(); } catch { return false; }
};

export const is_readable = (path: string): boolean => {
    try { accessSync(path, constants.R_OK); return true; } catch { return false; }
};

export const walk_files = (root: string, accept: (path: string) => boolean): string[] => {
    if (!is_directory(root)) return [];
    const found: string[] = [];
    const pending = [root];
    while (pending.length) {
        const dir = pending.pop() as string;
        let entries: Dirent[];
        try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
        for (const entry of entries) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) pending.push(path);
            else if (entry.isFile() && accept(path)) found.push(path);
        }
    }
    return found.sort();
};

export const command_on_path = (name: string, env: NodeJS.ProcessEnv): string | null => {
    const extensions = process.platform === 'win32' ? (env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';') : [''];
    for (const dir of (env.PATH ?? '').split(delimiter).filter(Boolean)) {
        for (const extension of extensions) {
            const path = join(dir, process.platform === 'win32' ? `${name}${extension.toLocaleLowerCase()}` : name);
            if (existsSync(path)) return path;
        }
    }
    return null;
};