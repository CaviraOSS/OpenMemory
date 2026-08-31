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
 *  file  : src/core/project/project_agent_manifest.ts
 *  usage : implements the LongMemory project agent manifest component
 */


import { hash_canonical } from '../hash/content_hash.js';
import type { project_memory } from './project_memory.js';
import type { memory_asset_loadout, memory_asset_loadout_input, memory_asset_type } from './project_assets.js';

export type agent_memory_manifest_input = Omit<memory_asset_loadout_input, 'agent_id'> & {
    agent_id: string;
    name?: string;
    description?: string;
    interface_url?: string;
    protocol_binding?: 'JSONRPC' | 'GRPC' | 'HTTP+JSON';
    protocol_version?: string;
};

export type agent_memory_manifest = {
    schema: 'https://longmemory.dev/schemas/agent-memory-manifest/v1';
    manifest_id: string;
    version: string;
    generated_at: string;
    project_id: string;
    agent: {
        id: string;
        name: string;
        description: string;
        framework: string | null;
        task_id: string | null;
    };
    capabilities: {
        asset_types: Record<memory_asset_type, number>;
        context_budget: number;
        mcp: boolean;
        a2a_agent_card: boolean;
    };
    loadout: memory_asset_loadout;
    mcp: {
        catalog_tool: 'longmemory_asset_catalog';
        context_tool: 'longmemory_project_context';
        assets_resource: string;
        manifest_resource: string;
    };
    a2a_extension: {
        uri: 'https://longmemory.dev/extensions/memory-assets/v1';
        required: false;
        params: { manifest_id: string; project_id: string; asset_types: memory_asset_type[] };
    };
    agent_card: {
        name: string;
        description: string;
        supportedInterfaces: Array<{ url: string; protocolBinding: string; protocolVersion: string }>;
        version: string;
        capabilities: { streaming: false; pushNotifications: false; extendedAgentCard: true; extensions: Array<{ uri: string; description: string; required: false }> };
        defaultInputModes: ['text/plain', 'application/json'];
        defaultOutputModes: ['text/plain', 'application/json'];
        skills: Array<{ id: string; name: string; description: string; tags: string[]; examples: string[]; inputModes: ['text/plain', 'application/json']; outputModes: ['text/plain', 'application/json'] }>;
    } | null;
};

export async function build_agent_memory_manifest(manager: project_memory, project_id: string, input: agent_memory_manifest_input): Promise<agent_memory_manifest> {
    const agent_id = input.agent_id.trim();
    if (!agent_id) throw new Error('agent manifest agent_id is required');
    if (input.interface_url) {
        let parsed: URL;
        try { parsed = new URL(input.interface_url); }
        catch { throw new Error('agent manifest interface_url must be an absolute URL'); }
        if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('agent manifest interface_url must use HTTP or HTTPS');
    }
    const loadout = await manager.resolveAssetLoadout(project_id, input);
    const asset_types: Record<memory_asset_type, number> = { chat_memory: 0, skill: 0, llm_wiki: 0, code_graph: 0 };
    for (const item of loadout.selected) asset_types[item.asset.type]++;
    const name = input.name?.trim() || agent_id;
    const description = input.description?.trim() || `LongMemory-equipped agent for project ${project_id}`;
    const manifest_id = `agent-memory:${hash_canonical([project_id, agent_id, input.framework ?? null, input.task_id ?? null]).slice(0, 24)}`;
    const version = hash_canonical(loadout.selected.map((item) => [item.asset.asset_id, item.asset.version, item.binding?.target_type, item.binding?.target_id, item.binding?.injection_mode])).slice(0, 16);
    const extension_uri = 'https://longmemory.dev/extensions/memory-assets/v1' as const;
    const manifest_resource = `longmemory://project/${encodeURIComponent(project_id)}/agent/${encodeURIComponent(agent_id)}/manifest`;
    const skill_assets = loadout.selected.filter((item) => item.asset.type === 'skill');
    return {
        schema: 'https://longmemory.dev/schemas/agent-memory-manifest/v1', manifest_id, version,
        generated_at: new Date(input.now ?? Date.now()).toISOString(), project_id,
        agent: { id: agent_id, name, description, framework: input.framework ?? null, task_id: input.task_id ?? null },
        capabilities: { asset_types, context_budget: loadout.token_budget, mcp: true, a2a_agent_card: Boolean(input.interface_url) },
        loadout,
        mcp: {
            catalog_tool: 'longmemory_asset_catalog', context_tool: 'longmemory_project_context',
            assets_resource: `longmemory://project/${encodeURIComponent(project_id)}/assets`, manifest_resource,
        },
        a2a_extension: { uri: extension_uri, required: false, params: { manifest_id, project_id, asset_types: Object.entries(asset_types).filter(([, count]) => count > 0).map(([type]) => type as memory_asset_type) } },
        agent_card: input.interface_url ? {
            name, description,
            supportedInterfaces: [{ url: input.interface_url, protocolBinding: input.protocol_binding ?? 'HTTP+JSON', protocolVersion: input.protocol_version ?? '1.0' }],
            version,
            capabilities: {
                streaming: false, pushNotifications: false, extendedAgentCard: true,
                extensions: [{ uri: extension_uri, description: 'Authenticated LongMemory asset loadout discovery', required: false }],
            },
            defaultInputModes: ['text/plain', 'application/json'], defaultOutputModes: ['text/plain', 'application/json'],
            skills: skill_assets.map((item) => ({
                id: String(item.asset.payload.skill_id ?? item.asset.asset_id), name: item.asset.name, description: item.asset.description,
                tags: item.asset.labels, examples: Array.isArray(item.asset.payload.triggers) ? item.asset.payload.triggers.filter((value): value is string => typeof value === 'string') : [],
                inputModes: ['text/plain', 'application/json'], outputModes: ['text/plain', 'application/json'],
            })),
        } : null,
    };
}