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
 *  file  : tools/check-integrations.mjs
 *  usage : validates integration package/plugin manifests
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo_root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const errors = [];

// n8n is already lint+build checked by `integration:check` before this script runs;
// everything else here only ships a declarative manifest, so parse+required-field
// validation is the meaningful check.
const manifests = [
    'integrations/claude-code-longmemory/.claude-plugin/plugin.json',
    'integrations/codex-longmemory/.codex-plugin/plugin.json',
    'integrations/longmemory-agent-plugin/plugin.json',
    'integrations/gemini-cli-longmemory/gemini-extension.json',
    'integrations/n8n-nodes-longmemory/package.json',
];

for (const relative_path of manifests) {
    const full_path = join(repo_root, relative_path);
    if (!existsSync(full_path)) {
        errors.push(`${relative_path} is missing`);
        continue;
    }
    let manifest;
    try {
        manifest = JSON.parse(readFileSync(full_path, 'utf8'));
    } catch (error) {
        errors.push(`${relative_path} is not valid JSON: ${error.message}`);
        continue;
    }
    if (!manifest.name) errors.push(`${relative_path} is missing "name"`);
    if (!manifest.version) errors.push(`${relative_path} is missing "version"`);
}

const mcp_configs = [
    'integrations/claude-code-longmemory/.mcp.json',
    'integrations/codex-longmemory/.mcp.json',
    'integrations/longmemory-agent-plugin/mcp.json',
];
for (const relative_path of mcp_configs) {
    const full_path = join(repo_root, relative_path);
    if (!existsSync(full_path)) {
        errors.push(`${relative_path} is missing`);
        continue;
    }
    try {
        JSON.parse(readFileSync(full_path, 'utf8'));
    } catch (error) {
        errors.push(`${relative_path} is not valid JSON: ${error.message}`);
    }
}

if (errors.length) {
    console.error('integration:check failed:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
}
console.log(`integration:check: ${manifests.length + mcp_configs.length} manifest(s) valid.`);
