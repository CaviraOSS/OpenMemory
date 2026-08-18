#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run_cli_app } from './cli_app.js';

export { run_cli_app, run_cli_app as run_cli } from './cli_app.js';

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    process.exitCode = await run_cli_app();
}
