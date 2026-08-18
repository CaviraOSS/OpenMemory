import { mkdtemp, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { run_benchmark } from '../benchmarks/src/runner.js';
import { create_memory } from '../src/index.js';

const root = fileURLToPath(new URL('..', import.meta.url));

async function exists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

describe('phase 1 acceptance', () => {
    it('exports the ready public memory engine', () => {
        const memory = create_memory();
        expect(memory.status()).toEqual({ name: 'openmemory-hydrograph', phase: 'phase-19-public-api', ready: true, store: 'memory' });
    });

    it('declares required scripts and cli binary', () => {
        for (const script of ['build', 'dev', 'test', 'bench', 'serve', 'typecheck', 'release:check']) {
            expect(pkg.scripts).toHaveProperty(script);
        }
        expect(pkg.bin.openmemory).toBe('dist/cli/index.js');
    });

    it('has required docs', async () => {
        for (const doc of ['architecture.md', 'invariants.md', 'formulas.md', 'benchmarks.md']) {
            expect(await exists(join(root, 'docs', doc))).toBe(true);
        }
    });

    it('has benchmark command behavior', async () => {
        const output_dir = await mkdtemp(join(tmpdir(), 'openmemory-acceptance-'));
        try {
            const result = await run_benchmark({
                providers: ['openmemory'],
                datasets: ['smoke'],
                run_id: 'acceptance',
                output_dir,
                resume: false,
            });
            expect(result.report.gates.passed).toBe(true);
        } finally {
            await rm(output_dir, { recursive: true, force: true });
        }
    });
});
