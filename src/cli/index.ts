#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { run_cli_app } from './cli_app.js';
import { is_cli_main } from './main.js';

export { run_cli_app, run_cli_app as run_cli } from './cli_app.js';

if (is_cli_main(fileURLToPath(import.meta.url), process.argv[1])) {
    process.exitCode = await run_cli_app();
}
