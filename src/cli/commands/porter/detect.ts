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
 *  file  : src/cli/commands/porter/detect.ts
 *  usage : implements the LongMemory detect component
 */


import type { cli_command } from '../../context/cli_context.js';
import { command_flags } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';
import { table } from '../../output/table.js';
import { detect_harnesses } from '../../porter/detect.js';

export const detect_command: cli_command = async (context) => {
    command_flags(context, []);
    const harnesses = await detect_harnesses(context.env);
    emit(context, { ok: true, destination: { id: 'longmemory', project_id: context.project_id, db_path: context.db_path }, harnesses }, () => table(harnesses.map((item) => ({
        harness: item.harness, installed: item.installed ? 'yes' : 'no', source: item.can_import ? 'ready' : 'unavailable', path: item.source_path ?? item.note ?? '—',
    })), [{ key: 'harness', label: 'HARNESS', width: 14 }, { key: 'installed', label: 'INSTALLED', width: 9 }, { key: 'source', label: 'SOURCE', width: 11 }, { key: 'path', label: 'SESSION STORE', min: 20 }], context.colors, context.terminal_width));
};