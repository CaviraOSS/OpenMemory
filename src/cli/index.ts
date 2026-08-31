#!/usr/bin/env node
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
 *  file  : src/cli/index.ts
 *  usage : implements the LongMemory index component
 */


import { fileURLToPath } from 'node:url';
import { run_cli_app } from './cli_app.js';
import { is_cli_main } from './main.js';

export { run_cli_app, run_cli_app as run_cli } from './cli_app.js';

if (is_cli_main(fileURLToPath(import.meta.url), process.argv[1])) {
    process.exitCode = await run_cli_app();
}
