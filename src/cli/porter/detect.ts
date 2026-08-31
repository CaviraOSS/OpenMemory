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
 *  file  : src/cli/porter/detect.ts
 *  usage : implements the LongMemory detect component
 */


import { claude_code_adapter } from './adapters/claude_code.js';
import { codex_adapter } from './adapters/codex.js';
import { opencode_adapter } from './adapters/opencode.js';
import { gemini_cli_adapter } from './adapters/gemini_cli.js';
import { copilot_chat_adapter } from './adapters/copilot_chat.js';
import { cline_adapter } from './adapters/cline.js';
import { deepseek_harness_adapter } from './adapters/deepseek_harness.js';
import type { harness_capability, harness_id, import_adapter } from './types.js';

const adapters = new Map<harness_id, import_adapter>([
    ['claude-code', claude_code_adapter], ['codex', codex_adapter], ['opencode', opencode_adapter],
    ['gemini-cli', gemini_cli_adapter], ['copilot-chat', copilot_chat_adapter], ['cline', cline_adapter],
    ['deepseek-harness', deepseek_harness_adapter],
]);

export const get_import_adapter = (harness: harness_id): import_adapter => {
    const adapter = adapters.get(harness);
    if (!adapter) throw new Error(`unsupported coding harness: ${harness}`);
    return adapter;
};

export const detect_harnesses = async (env: NodeJS.ProcessEnv = process.env): Promise<harness_capability[]> => Promise.all([...adapters.values()].map(async (adapter) => {
    try { return await adapter.detect(env); }
    catch (error) { return { harness: adapter.harness, installed: false, can_import: false, source_path: null, note: error instanceof Error ? error.message : String(error) }; }
}));