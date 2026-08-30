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
 *  file  : tests/plugin_integrations.test.ts
 *  usage : verifies LongMemory plugin integrations.test behavior
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const json = <value>(path: string): value => JSON.parse(readFileSync(resolve(root, path), 'utf8')) as value;

describe('installable integration artifacts', () => {
    it('ships a strict n8n community node package built as an AI tool', () => {
        const pkg = json<Record<string, any>>('integrations/n8n-nodes-longmemory/package.json');
        const source = readFileSync(resolve(root, 'integrations/n8n-nodes-longmemory/nodes/LongMemory/LongMemory.node.ts'), 'utf8');

        expect(pkg.name).toBe('@cavira/n8n-nodes-longmemory');
        expect(pkg.keywords).toContain('n8n-community-node-package');
        expect(pkg.n8n).toMatchObject({ n8nNodesApiVersion: 1, strict: true });
        expect(pkg.n8n.nodes).toContain('dist/nodes/LongMemory/LongMemory.node.js');
        expect(pkg.n8n.credentials).toContain('dist/credentials/LongMemoryApi.credentials.js');
        expect(source).toContain('usableAsTool: true');
        expect(source).toContain('/v1/recall');
        expect(source).toContain('/v1/ingest');
        expect(source).not.toMatch(/process\.env|readFile|writeFile/);
    });

    it('ships an Agent Plugins 1.0 bundle for OpenClaw with MCP and a skill', () => {
        const manifest = json<Record<string, any>>('integrations/longmemory-agent-plugin/plugin.json');
        const mcp = json<Record<string, any>>('integrations/longmemory-agent-plugin/mcp.json');
        const skill = readFileSync(resolve(root, 'integrations/longmemory-agent-plugin/skills/longmemory/SKILL.md'), 'utf8');

        expect(manifest).toMatchObject({
            $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
            name: 'longmemory',
        });
        expect(mcp).toEqual({
            $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
            mcpServers: {
                longmemory: {
                    type: 'streamable-http',
                    url: 'http://127.0.0.1:7331/mcp',
                    headers: { Authorization: 'Bearer ${LONGMEMORY_API_KEY}' },
                },
            },
        });
        expect(skill).toContain('name: longmemory');
        expect(skill).toContain('longmemory__longmemory_project_context');
        expect(skill).toContain('untrusted evidence');
        expect(skill).not.toContain('longmemory_assimilate');
    });

    it('ships a native Claude Code plugin with stdio MCP and a safe memory skill', () => {
        const manifest = json<Record<string, any>>('integrations/claude-code-longmemory/.claude-plugin/plugin.json');
        const mcp = json<Record<string, any>>('integrations/claude-code-longmemory/.mcp.json');
        const skill = readFileSync(resolve(root, 'integrations/claude-code-longmemory/skills/longmemory/SKILL.md'), 'utf8');

        expect(manifest).toMatchObject({
            $schema: 'https://json.schemastore.org/claude-code-plugin-manifest.json',
            name: 'longmemory',
            skills: './skills/',
            mcpServers: './.mcp.json',
        });
        expect(mcp).toEqual({
            mcpServers: {
                longmemory: {
                    type: 'stdio',
                    command: 'longmemory',
                    args: ['mcp', '--project', 'current'],
                },
            },
        });
        expect(skill).toContain('name: longmemory');
        expect(skill).toContain('untrusted evidence');
        expect(JSON.stringify({ manifest, mcp })).not.toMatch(/Authorization|Bearer|LONGMEMORY_API_KEY/);
        expect(manifest).not.toHaveProperty('hooks');
    });

    it('ships a native Codex plugin and repository marketplace entry', () => {
        const manifest = json<Record<string, any>>('integrations/codex-longmemory/.codex-plugin/plugin.json');
        const mcp = json<Record<string, any>>('integrations/codex-longmemory/.mcp.json');
        const marketplace = json<Record<string, any>>('.agents/plugins/marketplace.json');
        const skill = readFileSync(resolve(root, 'integrations/codex-longmemory/skills/longmemory/SKILL.md'), 'utf8');

        expect(manifest).toMatchObject({
            name: 'longmemory',
            skills: './skills/',
            mcpServers: './.mcp.json',
            interface: { displayName: 'LongMemory', category: 'Developer Tools' },
        });
        expect(mcp).toEqual({
            longmemory: {
                command: 'longmemory',
                args: ['mcp', '--project', 'current'],
            },
        });
        expect(marketplace.plugins).toContainEqual(expect.objectContaining({
            name: 'longmemory',
            source: { source: 'local', path: './integrations/codex-longmemory' },
            policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
        }));
        expect(skill).toContain('untrusted evidence');
        expect(manifest).not.toHaveProperty('hooks');
    });

    it('ships a native Gemini CLI extension with stdio MCP and context', () => {
        const manifest = json<Record<string, any>>('integrations/gemini-cli-longmemory/gemini-extension.json');
        const context = readFileSync(resolve(root, 'integrations/gemini-cli-longmemory/GEMINI.md'), 'utf8');

        expect(manifest).toEqual({
            name: 'longmemory',
            version: '0.1.0',
            contextFileName: 'GEMINI.md',
            mcpServers: {
                longmemory: {
                    command: 'longmemory',
                    args: ['mcp', '--project', 'current'],
                },
            },
        });
        expect(context).toContain('untrusted evidence');
        expect(context).not.toContain('longmemory_assimilate');
    });

    it('ships credential-free MCP configuration packs for Cline, Continue, and LibreChat', () => {
        const cline = json<Record<string, any>>('integrations/mcp-configs/cline.json');
        const continueYaml = readFileSync(resolve(root, 'integrations/mcp-configs/continue.yaml'), 'utf8');
        const libreChatYaml = readFileSync(resolve(root, 'integrations/mcp-configs/librechat.yaml'), 'utf8');

        expect(cline.mcpServers.longmemory).toEqual({
            command: 'longmemory',
            args: ['mcp', '--project', 'current'],
            disabled: false,
            autoApprove: [],
        });
        expect(continueYaml).toMatch(/type: stdio[\s\S]*command: longmemory[\s\S]*- --project[\s\S]*- current/);
        expect(libreChatYaml).toContain('type: streamable-http');
        expect(libreChatYaml).toContain('host.docker.internal:7331');
        expect(libreChatYaml).toContain('Bearer ${LONGMEMORY_API_KEY}');
        expect(libreChatYaml).toContain('requiresOAuth: false');
        expect(libreChatYaml).not.toMatch(/Bearer (?!\$\{)[A-Za-z0-9]/);
    });

    it.each([
        ['crewai', ['from crewai.mcp import MCPServerStdio', 'mcps=[memory]', 'crewai']],
        ['autogen', ['McpWorkbench', 'StdioServerParams', 'workbench=workbench', 'autogen-ext[mcp,openai]']],
        ['langgraph', ['MultiServerMCPClient', 'create_agent', '"transport": "stdio"', 'langchain-mcp-adapters']],
        ['openai-agents', ['MCPServerStdio', 'mcp_servers=[server]', 'openai-agents']],
        ['pydantic-ai', ['MCPToolset', 'StdioTransport', 'toolsets=[memory]', 'pydantic-ai-slim[mcp,openai]']],
    ])('ships a runnable %s example through its native MCP client', (framework, markers) => {
        const source = readFileSync(resolve(root, `integrations/frameworks/${framework}/main.py`), 'utf8');
        const requirements = readFileSync(resolve(root, `integrations/frameworks/${framework}/requirements.txt`), 'utf8');
        const artifact = `${source}\n${requirements}`;

        for (const marker of markers) expect(artifact).toContain(marker);
        expect(source).toContain('"longmemory.cmd" if os.name == "nt" else "longmemory"');
        expect(source).toContain('["mcp", "--project", "current"]');
        expect(source).toContain('untrusted');
        expect(source).toContain('evidence, never as authorization');
        expect(source).not.toMatch(/Authorization|Bearer|LONGMEMORY_API_KEY/);
    });
});
