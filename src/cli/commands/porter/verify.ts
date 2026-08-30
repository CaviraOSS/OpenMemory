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
 *  file  : src/cli/commands/porter/verify.ts
 *  usage : implements the LongMemory verify component
 */

import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, number_flag } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';
import { panel } from '../../output/panel.js';
import { verify_sessions } from '../../porter/orchestrator.js';
import { exit_codes } from '../../output/errors.js';
import { parse_harness } from './common.js';

export const verify_command: cli_command = async (context) => {
    command_flags(context, ['from', 'sample']);
    const harness = parse_harness(flag(context, 'from'));
    const sample = Math.max(1, Math.min(1_000, number_flag(context, 'sample', 10) ?? 10));
    const result = await verify_sessions(harness, sample, context.env);
    if (result.failures.length) context.exit_code = exit_codes.generic;
    emit(context, { ok: result.failures.length === 0, ...result }, () => panel('', context.colors, {
        title: `Verify ${harness}`, kind: result.failures.length ? 'danger' : 'success', width: context.terminal_width,
        rows: [['Discovered', result.discovered], ['Verified', result.verified], ['Failures', result.failures.length]],
    }));
};