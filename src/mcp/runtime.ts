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
 *  file  : src/mcp/runtime.ts
 *  usage : implements the LongMemory runtime component
 */


import { basename, resolve } from 'node:path';
import { create_memory, type long_memory } from '../core/create_memory.js';
import type { ConnectorRegistry } from '../core/connectors/connector_registry.js';
import { project_memory } from '../core/project/project_memory.js';
import { mcp_audit_log } from './security/audit.js';
import { create_embedding_environment } from '../core/embeddings/environment.js';
import { create_tool_allowlist, type mcp_tool_name } from './security/tool_allowlist.js';
import type { mcp_access } from './security/permissions.js';

export type mcp_runtime_config = {
    memory?: long_memory;
    db_path?: string;
    tenant_id?: string;
    user_id?: string;
    project_id?: string | null;
    team_ids?: readonly string[];
    roles?: readonly string[];
    agent_id?: string | null;
    framework?: string | null;
    cwd?: string;
    read_only?: boolean;
    allowed_tools?: readonly mcp_tool_name[];
    audit?: mcp_audit_log;
    audit_path?: string | null;
    connector_registry?: ConnectorRegistry;
    env?: NodeJS.ProcessEnv;
};

const current_project = (cwd: string) => basename(resolve(cwd)).toLowerCase().replace(/[^a-z0-9._-]+/g, '-') || 'current';

export class mcp_runtime {
    readonly memory: long_memory;
    readonly access: mcp_access;
    readonly audit: mcp_audit_log;
    readonly cwd: string;
    private readonly owns_memory: boolean;
    private readonly tenant_id: string;
    private readonly connector_registry?: ConnectorRegistry;
    private readonly projects = new Map<string, project_memory>();

    constructor(config: mcp_runtime_config = {}) {
        this.cwd = resolve(config.cwd ?? process.cwd());
        this.tenant_id = config.tenant_id ?? 'default';
        this.connector_registry = config.connector_registry;
        const embeddings = create_embedding_environment(config.env ?? process.env);
        const project_id = config.project_id === 'current' ? current_project(this.cwd) : config.project_id ?? null;
        this.memory = config.memory ?? create_memory({
            store: config.db_path ? 'sqlite' : 'memory',
            db_path: config.db_path,
            tenant_id: this.tenant_id,
            user_id: config.user_id ?? 'default',
            readonly: config.read_only ?? false,
            ...(embeddings ? { embedding_provider: embeddings.embedding_provider, multilingual_embedding_provider: embeddings.multilingual_embedding_provider, embedding_dimension: embeddings.embedding_dimension } : {}),
        });
        this.owns_memory = !config.memory;
        this.access = {
            user_id: config.user_id ?? 'default',
            project_id,
            team_ids: config.team_ids ?? [],
            roles: config.roles ?? [],
            agent_id: config.agent_id ?? null,
            framework: config.framework ?? null,
            read_only: config.read_only ?? false,
            allowed_tools: create_tool_allowlist(config.allowed_tools),
        };
        this.audit = config.audit ?? new mcp_audit_log(config.audit_path ?? (config.db_path ? `${config.db_path}.mcp-audit.jsonl` : null));
    }

    async project(project_id?: string | null): Promise<project_memory> {
        const id = this.resolve_project_id(project_id);
        const cached = this.projects.get(id);
        if (cached) return cached;
        const worlds = await this.memory.listWorlds();
        const root = worlds.find((world) => world.metadata.hierarchy === 'project' && world.metadata.project_id === id);
        if (this.access.read_only && !root) {
            throw new Error(`MCP server is read-only; unknown project cannot be created: ${id}`);
        }
        const name = root?.name ?? id;
        const description = String(root?.metadata.description ?? `LongMemory project ${id}`);
        const manager = new project_memory({
            memory: this.memory,
            tenant_id: this.tenant_id,
            project_id: id,
            name,
            description,
            connector_registry: this.connector_registry,
            readonly: this.access.read_only,
        });
        await manager.createProject({ tenant_id: this.tenant_id, project_id: id, name, description });
        this.projects.set(id, manager);
        return manager;
    }

    resolve_project_id(project_id?: string | null): string {
        return project_id ?? this.access.project_id ?? current_project(this.cwd);
    }

    async list_projects(): Promise<Array<Record<string, unknown>>> {
        const worlds = await this.memory.listWorlds();
        const allowed = this.access.project_id;
        const roots = worlds.filter((world) => world.metadata.hierarchy === 'project' && (!allowed || world.metadata.project_id === allowed));
        return roots.map((world) => ({
            tenant_id: String(world.metadata.tenant_id ?? this.tenant_id),
            organization_id: String(world.metadata.organization_id ?? this.tenant_id),
            project_id: String(world.metadata.project_id),
            name: world.name,
            description: String(world.metadata.description ?? ''),
            root_world_id: world.id,
            world_ids: Object.fromEntries(worlds.filter((child) => child.parent_world_id === world.id).map((child) => [String(child.metadata.hierarchy), child.id])),
            created_at: world.created_at,
            updated_at: world.updated_at,
        }));
    }

    async close(): Promise<void> {
        for (const manager of this.projects.values()) await manager.close();
        if (this.owns_memory) await this.memory.close();
    }
}