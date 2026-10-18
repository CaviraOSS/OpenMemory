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
 *  file  : tools/check-python-sdk.mjs
 *  usage : validates the Python HTTP SDK package structure and syntax
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const repo_root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const sdk_root = join(repo_root, 'packages/longmemory-py');
const errors = [];

const pyproject_path = join(sdk_root, 'pyproject.toml');
if (!existsSync(pyproject_path)) errors.push('packages/longmemory-py/pyproject.toml is missing');
else {
    const pyproject = readFileSync(pyproject_path, 'utf8');
    if (!/name\s*=\s*"[^"]+"/.test(pyproject)) errors.push('pyproject.toml is missing [project].name');
    if (!/version\s*=\s*"[^"]+"/.test(pyproject)) errors.push('pyproject.toml is missing [project].version');
}

const src_root = join(sdk_root, 'src');
function list_py_files(dir) {
    if (!existsSync(dir)) return [];
    const files = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) files.push(...list_py_files(full));
        else if (entry.endsWith('.py')) files.push(full);
    }
    return files;
}

const py_files = list_py_files(src_root);
if (py_files.length === 0) errors.push('packages/longmemory-py/src contains no .py files');

function find_python() {
    for (const candidate of ['python3', 'python']) {
        try {
            execFileSync(candidate, ['--version'], { stdio: 'ignore' });
            return candidate;
        } catch {
            // try the next candidate
        }
    }
    return null;
}

const python = find_python();
if (!python) {
    console.warn('sdk:python:check: no python interpreter found on PATH; skipping syntax check.');
} else {
    for (const file of py_files) {
        try {
            execFileSync(python, ['-m', 'py_compile', file], { stdio: 'pipe' });
        } catch (error) {
            errors.push(
                `${file.slice(repo_root.length + 1)} failed to compile: ${error.stderr?.toString().trim() || error.message}`,
            );
        }
    }
}

if (errors.length) {
    console.error('sdk:python:check failed:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
}
console.log(`sdk:python:check: ${py_files.length} file(s) valid.`);
