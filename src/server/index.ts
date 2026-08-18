/*
 *   _____                 ___  ___
 *  |  _  |                |  \/  |
 *  | | | |_ __   ___ _ __ | .  . | ___ _ __ ___   ___  _ __ _   _
 *  | | | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 *  \ \_/ / |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
 *   \___/| .__/ \___|_| |_\_|  |_/\___|_| |_| |_|\___/|_|   \__, |
 *        | |                                                 __/ |
 *        |_|                                                |___/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/server/index.ts
 *  usage : self-hosted http server sharing the createMemory engine
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { create_open_memory_server } from './app.js';
import { load_server_config } from './config.js';

export * from './app.js';
export * from './config.js';

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    const config = load_server_config();
    create_open_memory_server({ config }).listen(config.port, config.host, () => {
        console.log(`openmemory server listening on http://${config.host}:${config.port}`);
    });
}
