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
 *  file  : src/cli/commands/agent/manifest.ts
 *  usage : implements the LongMemory manifest component
 */

import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, positional, require_value, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';
import { loadout_flags } from '../asset/common.js';

export const agent_manifest_command: cli_command = async (context) => {
    command_flags(context, ['agent', 'query', 'task', 'framework', 'subject-user', 'teams', 'roles', 'include-unbound', 'types', 'name', 'description', 'interface-url', 'protocol-binding', 'protocol-version']);
    const agent_id = require_value(flag(context, 'agent') ?? positional(context), 'agent id');
    const query = flag(context, 'query') ?? flag(context, 'task') ?? 'current project work';
    const loadout = loadout_flags(context, query);
    const manifest = await with_project(context, (project) => project.buildAgentManifest(context.project_id, {
        ...loadout, agent_id, name: flag(context, 'name'), description: flag(context, 'description'),
        interface_url: flag(context, 'interface-url'), protocol_binding: flag(context, 'protocol-binding') as 'JSONRPC' | 'GRPC' | 'HTTP+JSON' | undefined,
        protocol_version: flag(context, 'protocol-version'),
    }));
    emit(context, { ok: true, manifest }, () => `${manifest.agent.name} · ${manifest.loadout.selected.length} assets · manifest ${manifest.version}`);
};