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
 *  file  : tools/branding.mjs
 *  usage : finds (and optionally fixes) leftover pre-rename branding
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';

const repo_root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// term -> safe 1:1 replacement, or null if it needs a human to rewrite the sentence.
// `openmemory-js` / `openmemory-py` are intentionally excluded: they are the real,
// still-published legacy forwarding-bridge package names (see README.md "Migrating
// from openmemory-js"), not leftover pre-rename branding.
const banned_terms = [
    { term: 'OpenMemory', replacement: 'LongMemory' },
    { term: 'Cognitive Engine', replacement: null },
    { term: 'HMD v2', replacement: null },
    { term: 'Holistic Memory Descriptor', replacement: null },
];

// Files that legitimately discuss the old name (history, migration guidance, or this script).
const exempt_paths = [
    /^CHANGELOG\.md$/,
    /^MIGRATION\.md$/,
    /^docs\/migration\.md$/,
    /^docs\/decisions\.md$/,
    /^TECH_DEBT_AUDIT\.md$/,
    /^\.specs\//,
    /^tools\/branding\.mjs$/,
];

const text_extensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.md', '.json', '.yml', '.yaml', '.svelte']);

function tracked_files() {
    const output = execFileSync('git', ['ls-files'], { cwd: repo_root, encoding: 'utf8' });
    return output.split('\n').filter(Boolean);
}

function is_exempt(path) {
    return exempt_paths.some((pattern) => pattern.test(path));
}

function main() {
    const apply = process.argv.includes('--apply');
    const findings = [];
    let fixed = 0;

    for (const path of tracked_files()) {
        if (is_exempt(path) || !text_extensions.has(extname(path))) continue;
        let content;
        try {
            content = readFileSync(`${repo_root}/${path}`, 'utf8');
        } catch {
            continue; // deleted-but-still-tracked, or a binary file misreported as text
        }

        let next = content;
        for (const { term, replacement } of banned_terms) {
            if (!content.includes(term)) continue;
            const count = content.split(term).length - 1;
            if (apply && replacement) {
                next = next.split(term).join(replacement);
                fixed += count;
            } else {
                findings.push({ path, term, count });
            }
        }
        if (apply && next !== content) writeFileSync(`${repo_root}/${path}`, next);
    }

    if (apply) {
        console.log(`branding: replaced ${fixed} occurrence(s) with safe 1:1 mappings.`);
        if (findings.length) {
            console.log('branding: the following need a manual rewrite (no safe automatic replacement):');
            for (const { path, term, count } of findings) console.log(`  ${path}: "${term}" x${count}`);
            process.exitCode = 1;
        }
        return;
    }

    if (findings.length === 0) {
        console.log('branding: no leftover pre-rename strings found.');
        return;
    }
    console.error('branding: leftover pre-rename strings found:');
    for (const { path, term, count } of findings) console.error(`  ${path}: "${term}" x${count}`);
    console.error('Run `pnpm branding:apply` to fix the ones with a safe automatic replacement.');
    process.exitCode = 1;
}

main();
