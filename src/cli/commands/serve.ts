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
 *  file  : src/cli/commands/serve.ts
 *  usage : implements the LongMemory serve component
 */


import type { AddressInfo } from 'node:net';
import { createMemory as create_memory } from '../../core/create_memory.js';
import { create_long_memory_server } from '../../server/app.js';
import { load_server_config } from '../../server/config.js';
import type { cli_command } from '../context/cli_context.js';
import { command_flags, flag, has, memory_config, number_flag } from '../context/cli_context.js';
import { cli_error, exit_codes } from '../output/errors.js';
import { emit } from '../output/pretty.js';
import { panel } from '../output/panel.js';

export const serve_command: cli_command = async (context) => {
    command_flags(context, ['host', 'port', 'mcp-http']);
    const base = load_server_config(context.env);
    const port = number_flag(context, 'port', base.port)!;
    if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new cli_error('validation_error', '--port must be an integer between 0 and 65535', exit_codes.validation);
    const config = {
        ...base,
        host: flag(context, 'host') ?? base.host,
        port,
        mcp_http: has(context, 'mcp-http') || base.mcp_http,
        memory: { ...base.memory, ...memory_config(context), store: 'sqlite' as const },
    };
    if (context.dry_run) {
        const result = { ok: true, command: 'serve', dry_run: true, url: `http://${config.host}:${config.port}`, db_path: context.db_path, project: context.project_id, auth: Boolean(config.api_key), mcp_http: config.mcp_http };
        emit(context, result, () => panel('Server configuration is valid; no listener was started.', context.colors, { title: 'Server preview', kind: 'warning', width: context.terminal_width, rows: [['Address', result.url], ['Database', result.db_path], ['Project', result.project], ['Auth', result.auth ? 'enabled' : 'disabled'], ['MCP HTTP', result.mcp_http ? 'enabled' : 'disabled']] }));
        return;
    }
    const memory = create_memory(config.memory);
    const server = create_long_memory_server({ config, memory });
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(config.port, config.host, resolve);
    });
    const address = server.address() as AddressInfo;
    const result = {
        ok: true,
        command: 'serve',
        ready: true,
        url: `http://${config.host}:${address.port}`,
        db_path: context.db_path,
        store: 'sqlite',
        pid: process.pid,
        ...(config.mcp_http ? { mcp_url: `http://${config.host}:${address.port}/mcp` } : {}),
    };
    emit(context, result, () => panel('', context.colors, {
        title: 'LongMemory server', kind: 'success', width: context.terminal_width, rows: [
            ['Address', result.url], ['Database', result.db_path], ['Project', context.project_id], ['Auth', config.api_key ? 'enabled' : 'disabled'], ['MCP HTTP', config.mcp_http ? result.mcp_url : 'disabled'],
        ]
    }));
    await new Promise<void>((resolve) => {
        const stop = () => server.close(() => resolve());
        process.once('SIGINT', stop);
        process.once('SIGTERM', stop);
    });
    await memory.close();
};