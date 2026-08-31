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
 *  file  : src/cli/commands/session/list.ts
 *  usage : implements the LongMemory list component
 */


import type { cli_command } from '../../context/cli_context.js';
import { command_flags, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';

export const session_list_command: cli_command = async (context) => {
    command_flags(context, []);
    const sessions = await with_project(context, (project) => project.listSessions(context.project_id));
    emit(context, { ok: true, project_id: context.project_id, count: sessions.length, sessions }, () => sessions.length
        ? sessions.map((session) => `${session.provider} · ${session.agent_id} · ${session.session_id} · ${session.message_count} messages`).join('\n')
        : 'No imported agent sessions.');
};