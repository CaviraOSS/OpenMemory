import { existsSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

export type cwd_project = { cwd: string; root: string; project_id: string; project_name: string; source: 'openmemory' | 'git' | 'folder' };

const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'current';

export function detect_cwd_project(input = process.cwd()): cwd_project {
    const cwd = resolve(input);
    let cursor = cwd;
    let git_root: string | null = null;
    let memory_root: string | null = null;
    while (true) {
        if (!memory_root && existsSync(resolve(cursor, '.openmemory'))) memory_root = cursor;
        if (!git_root && existsSync(resolve(cursor, '.git'))) git_root = cursor;
        const parent = dirname(cursor);
        if (parent === cursor) break;
        cursor = parent;
    }
    const root = memory_root ?? git_root ?? cwd;
    return {
        cwd, root, project_id: normalize(basename(root)), project_name: basename(root),
        source: memory_root ? 'openmemory' : git_root ? 'git' : 'folder',
    };
}