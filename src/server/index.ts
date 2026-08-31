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
 *  file  : src/server/index.ts
 *  usage : implements the LongMemory index component
 */


import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { create_long_memory_server } from './app.js';
import { load_server_config } from './config.js';

export * from './app.js';
export * from './config.js';

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    const config = load_server_config();
    create_long_memory_server({ config }).listen(config.port, config.host, () => {
        console.log(`longmemory server listening on http://${config.host}:${config.port}`);
    });
}
