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
 *  file  : src/cli/context/cwd_project.ts
 *  usage : implements the LongMemory cwd project component
 */


import { existsSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

export type cwd_project = { cwd: string; root: string; project_id: string; project_name: string; source: 'longmemory' | 'git' | 'folder' };

const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'current';

export function detect_cwd_project(input = process.cwd()): cwd_project {
    const cwd = resolve(input);
    let cursor = cwd;
    let git_root: string | null = null;
    let memory_root: string | null = null;
    while (true) {
        if (!memory_root && existsSync(resolve(cursor, '.longmemory'))) memory_root = cursor;
        if (!git_root && existsSync(resolve(cursor, '.git'))) git_root = cursor;
        const parent = dirname(cursor);
        if (parent === cursor) break;
        cursor = parent;
    }
    const root = memory_root ?? git_root ?? cwd;
    return {
        cwd, root, project_id: normalize(basename(root)), project_name: basename(root),
        source: memory_root ? 'longmemory' : git_root ? 'git' : 'folder',
    };
}