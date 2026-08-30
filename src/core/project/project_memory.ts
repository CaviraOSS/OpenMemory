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
 *  file  : src/core/project/project_memory.ts
 *  usage : implements the LongMemory project memory component
 */

import { create_memory, type memory_explanation, type long_memory } from '../create_memory.js';
import type { Connector, connector_config } from '../connectors/connector.js';
import type { ConnectorRegistry } from '../connectors/connector_registry.js';
import type { connector_sync_options, connector_sync_report } from '../connectors/connector_ingest.js';
import type { HydrographImportPlan } from '../connectors/source_event.js';
import { default_connector_registry } from '../../connectors/registry.js';
import { get_project_context_packet, type project_context_packet } from './project_context.js';
import { get_project_decisions, type project_decision } from './project_decisions.js';
import { ingest_project_event, sync_project_source } from './project_ingest.js';
import { recall_project_memory, type project_recall_mode, type project_recall_query, type project_recall_result } from './project_recall.js';
import { project_state, type project_event, type project_source_link } from './project_state.js';
import { get_project_tasks, type project_task } from './project_tasks.js';
import {
    archive_project_skill, bind_project_skill, create_project_skill, get_project_skill, list_project_skills, match_project_skills,
    type project_skill, type project_skill_input, type project_skill_match,
} from './project_skills.js';
import {
    code_callers, code_callees, code_impact, code_symbols_from_nodes, search_code_symbols,
    type project_code_impact, type project_code_relation, type project_code_symbol,
} from './project_code_index.js';
import { import_project_session, list_project_sessions, type project_session, type project_session_input } from './project_sessions.js';
import {
    decide_memory_asset_access, get_memory_asset, govern_memory_asset, list_memory_assets, register_memory_asset, resolve_memory_asset_loadout,
    type memory_asset, type memory_asset_access, type memory_asset_decision, type memory_asset_input, type memory_asset_loadout, type memory_asset_loadout_input, type memory_asset_permission,
} from './project_assets.js';
import { build_agent_memory_manifest, type agent_memory_manifest, type agent_memory_manifest_input } from './project_agent_manifest.js';
import {
    default_project_contract,
    project_contract_to_memory,
    project_hierarchy,
    type ProjectMemoryContract,
    type ProjectWorld,
    type project_config,
    type project_world_kind,
    project_world_kinds,
} from './project_world.js';

export type project_memory_config = project_config & {
    memory?: long_memory;
    connector_registry?: ConnectorRegistry;
    readonly?: boolean;
};

export type project_source_input = {
    connector_id: string;
    connector?: Connector;
    config?: connector_config;
    label?: string;
    current_ref?: string | null;
    world_kind?: project_world_kind;
};

export type project_sync_options = connector_sync_options & { current_ref?: string | null };

const source_world = (connector_id: string): project_world_kind => {
    if (connector_id === 'github' || ['gitlab', 'bitbucket', 'azure_devops', 'gitea', 'forgejo', 'codeberg'].includes(connector_id)) return 'repositories';
    if (['jira', 'linear', 'asana', 'trello', 'monday', 'clickup'].includes(connector_id)) return 'issues';
    if (connector_id.includes('deploy')) return 'deployments';
    return 'documents';
};

const empty_project = (config: project_config, contract: ProjectMemoryContract, at: number): ProjectWorld => ({
    id: `project:${config.project_id}`,
    tenant_id: config.tenant_id,
    organization_id: config.organization_id ?? config.tenant_id,
    project_id: config.project_id,
    name: config.name,
    description: config.description ?? '',
    root_world_id: '',
    world_ids: Object.fromEntries(project_world_kinds.map((kind) => [kind, ''])) as Record<project_world_kind, string>,
    linked_sources: [],
    active_goals: [],
    active_constraints: [],
    current_architecture_summary: null,
    current_decisions: [],
    unresolved_questions: [],
    open_tasks: [],
    coding_conventions: [],
    deployment_targets: [],
    risk_register: [],
    contract,
    created_at: at,
    updated_at: at,
});

export class project_memory {
    readonly memory: long_memory;
    readonly connector_registry: ConnectorRegistry;
    private readonly states = new Map<string, project_state>();
    private readonly owns_memory: boolean;
    private readonly max_context_tokens: number;
    private readonly readonly: boolean;

    constructor(config: project_memory_config) {
        this.memory = config.memory ?? create_memory({
            store: config.store ?? (config.db_path ? 'sqlite' : 'memory'),
            db_path: config.db_path,
            tenant_id: config.tenant_id,
            user_id: `project:${config.project_id}`,
            readonly: config.readonly,
        });
        this.owns_memory = !config.memory;
        this.connector_registry = config.connector_registry ?? default_connector_registry;
        this.max_context_tokens = config.max_context_tokens ?? 2048;
        this.readonly = config.readonly ?? false;
    }

    async createProject(config: project_config): Promise<ProjectWorld> {
        if (this.states.has(config.project_id)) return this.states.get(config.project_id)!.project;
        const at = config.created_at ?? Date.now();
        const contract = { ...default_project_contract(), ...(config.contract ?? {}) };
        let worlds = await this.memory.listWorlds();
        const existing = worlds.some((world) => world.metadata.project_id === config.project_id && world.metadata.hierarchy === 'project');
        if (!existing) {
            const plan: HydrographImportPlan = {
                connector_id: `project:${config.project_id}`,
                source_type: 'project_system',
                sync_item_id: `project-create:${config.project_id}`,
                recorded_at: at,
                nodes_to_create: [],
                edges_to_create: [],
                worlds_to_create: project_hierarchy(config, contract, at),
                entities_to_resolve: [],
                grounding_refs: [],
                contracts: [],
                provenance: [],
                deletion_or_supersession_actions: [],
                checksum: `project:${config.project_id}:${at}`,
                warnings: [],
            };
            await this.memory.applyImportPlan(plan);
            worlds = await this.memory.listWorlds();
        }
        const project = empty_project(config, contract, at);
        const root = worlds.find((world) => world.metadata.project_id === config.project_id && world.metadata.hierarchy === 'project');
        if (!root) throw new Error(`project hierarchy was not created: ${config.project_id}`);
        const missing_kinds = project_world_kinds.filter((kind) => !worlds.some((world) => world.metadata.project_id === config.project_id && world.metadata.hierarchy === kind));
        if (missing_kinds.length && !this.readonly) {
            const contracts = project_contract_to_memory(contract, config.project_id);
            await this.memory.applyImportPlan({
                connector_id: `project:${config.project_id}`,
                source_type: 'project_system',
                sync_item_id: `project-upgrade:${config.project_id}:${missing_kinds.join(',')}`,
                recorded_at: at,
                nodes_to_create: [], edges_to_create: [], entities_to_resolve: [], grounding_refs: [], contracts: [], provenance: [],
                worlds_to_create: missing_kinds.map((kind) => ({
                    key: `project:${config.project_id}:${kind}`, name: kind.replace(/_/g, ' '), parent_key: null,
                    parent_world_id: root.id, zone: kind === 'agent_sessions' ? 'endocortex' : 'mixed', contracts,
                    metadata: { hierarchy: kind, tenant_id: config.tenant_id, organization_id: config.organization_id ?? config.tenant_id, project_id: config.project_id },
                    created_at: at,
                })),
                deletion_or_supersession_actions: [], checksum: `project-upgrade:${config.project_id}:${missing_kinds.join(',')}`, warnings: [],
            });
            worlds = await this.memory.listWorlds();
        }
        project.root_world_id = root.id;
        for (const kind of project_world_kinds) {
            const world = worlds.find((item) => item.metadata.project_id === config.project_id && item.metadata.hierarchy === kind);
            if (!world && !this.readonly) throw new Error(`project ${config.project_id} is missing ${kind} world`);
            project.world_ids[kind] = world?.id ?? root.id;
        }
        const state = new project_state(project);
        this.states.set(config.project_id, state);
        await this.hydrate(state);
        return project;
    }

    getProject(project_id: string): ProjectWorld {
        return this.state(project_id).project;
    }

    async linkSourceToProject(project_id: string, source: project_source_input): Promise<ProjectWorld> {
        const state = this.state(project_id);
        if (state.sources.has(source.connector_id)) throw new Error(`connector already linked to project ${project_id}: ${source.connector_id}`);
        const connector = source.connector ?? this.connector_registry.load(source.connector_id, source.config ?? {});
        await connector.connect(source.config ?? {});
        if (!await connector.testConnection()) throw new Error(`connector connection failed: ${source.connector_id}`);
        const linked_at = Date.now();
        const link: project_source_link = {
            connector_id: source.connector_id,
            source_type: connector.source_type,
            label: source.label ?? source.connector_id,
            current_ref: source.current_ref ?? null,
            linked_at,
            last_synced_at: null,
            connector,
            world_kind: source.world_kind ?? source_world(source.connector_id),
        };
        state.sources.set(source.connector_id, link);
        state.project.linked_sources.push({ connector_id: link.connector_id, source_type: link.source_type, label: link.label, current_ref: link.current_ref, linked_at, last_synced_at: null });
        state.project.updated_at = linked_at;
        return state.project;
    }

    async ingestProjectEvent(project_id: string, event: project_event): Promise<string> {
        const state = this.state(project_id);
        const prior = state.current_by_topic.get(`${event.kind}:${event.topic ?? event.kind}`);
        const prior_text = prior ? state.nodes.get(prior)?.text : null;
        const id = await ingest_project_event(this.memory, state.project, state, event);
        this.update_summary(state, event, prior_text ?? null);
        return id;
    }

    async syncProjectSource(project_id: string, connector_id: string, options: project_sync_options = {}): Promise<connector_sync_report> {
        const state = this.state(project_id);
        const link = state.sources.get(connector_id);
        if (!link) throw new Error(`connector is not linked to project ${project_id}: ${connector_id}`);
        if (options.current_ref !== undefined) link.current_ref = options.current_ref;
        const report = await sync_project_source(this.memory, state.project, state, link, options);
        const summary = state.project.linked_sources.find((item) => item.connector_id === connector_id);
        if (summary) {
            summary.current_ref = link.current_ref;
            summary.last_synced_at = report.completed_at;
        }
        if (!report.dry_run && report.node_ids.length && (link.world_kind === 'documents' || link.world_kind === 'repositories')) {
            const type = link.world_kind === 'documents' ? 'llm_wiki' as const : 'code_graph' as const;
            const asset_id = `asset:${type}:${connector_id}`;
            const prior = await this.getAsset(project_id, asset_id);
            await this.registerAsset(project_id, {
                asset_id, type, name: link.label, description: link.world_kind === 'documents'
                    ? `Structured document pages and linkable project knowledge from ${link.label}`
                    : `Repository symbols, files, calls, and impact paths from ${link.label}`,
                owner_id: 'project', source_type: link.source_type, source_ref: link.current_ref ?? connector_id,
                content_ref: `longmemory://project/${encodeURIComponent(project_id)}/asset/${encodeURIComponent(asset_id)}`,
                status: prior?.status ?? 'candidate', visibility: prior?.visibility ?? 'project', confidence: report.failures.length ? 0.6 : 0.9,
                labels: [connector_id, link.source_type, link.world_kind],
                payload: {
                    connector_id, world_id: state.project.world_ids[link.world_kind], snapshot_ref: link.current_ref,
                    node_count: report.node_ids.length, tool_name: type === 'llm_wiki' ? 'longmemory_project_context' : 'longmemory_code_graph',
                },
                metadata: { sync_completed_at: report.completed_at, failure_count: report.failures.length }, at: report.completed_at,
            });
        }
        return report;
    }

    setProjectSourceRef(project_id: string, connector_id: string, current_ref: string): void {
        const state = this.state(project_id);
        const link = state.sources.get(connector_id);
        if (!link) throw new Error(`connector is not linked to project ${project_id}: ${connector_id}`);
        link.current_ref = current_ref;
        const summary = state.project.linked_sources.find((item) => item.connector_id === connector_id);
        if (summary) summary.current_ref = current_ref;
        state.project.updated_at = Date.now();
    }

    recallProject(project_id: string, query: project_recall_query, mode: project_recall_mode): Promise<project_recall_result> {
        const state = this.state(project_id);
        return recall_project_memory(this.memory, state.project, state, query, mode);
    }

    async getProjectContext(
        project_id: string,
        task: string,
        token_budget = this.max_context_tokens,
        agent_id?: string,
        framework?: string,
        access: Partial<Pick<memory_asset_loadout_input, 'user_id' | 'team_ids' | 'roles' | 'task_id'>> = {},
    ): Promise<project_context_packet> {
        const state = this.state(project_id);
        const loadout = await this.resolveAssetLoadout(project_id, { ...access, query: task, agent_id, framework, include_unbound: true, token_budget });
        const selected_skill_ids = new Set(loadout.selected.filter((item) => item.asset.type === 'skill').map((item) => String(item.asset.payload.skill_id ?? '')));
        const skills = (await this.matchSkills(project_id, task, agent_id)).filter((match) => selected_skill_ids.has(match.skill.skill_id));
        return get_project_context_packet(this.memory, state.project, state, task, token_budget, skills, loadout);
    }

    getProjectDecisions(project_id: string): Promise<project_decision[]> {
        const state = this.state(project_id);
        return get_project_decisions(this.memory, state);
    }

    getProjectTasks(project_id: string): Promise<project_task[]> {
        const state = this.state(project_id);
        return get_project_tasks(this.memory, state);
    }

    createSkill(project_id: string, input: project_skill_input): Promise<project_skill> {
        this.state(project_id);
        return create_project_skill(this, project_id, input);
    }

    getSkill(project_id: string, skill_id: string): Promise<project_skill | null> {
        this.state(project_id);
        return get_project_skill(this, project_id, skill_id);
    }

    listSkills(project_id: string, include_archived = false): Promise<project_skill[]> {
        this.state(project_id);
        return list_project_skills(this, project_id, include_archived);
    }

    matchSkills(project_id: string, query: string, agent_id?: string, limit = 5): Promise<project_skill_match[]> {
        this.state(project_id);
        return match_project_skills(this, project_id, query, agent_id, limit);
    }

    bindSkill(project_id: string, skill_id: string, agent_ids: string[], at?: number): Promise<project_skill> {
        this.state(project_id);
        return bind_project_skill(this, project_id, skill_id, agent_ids, at);
    }

    archiveSkill(project_id: string, skill_id: string, at?: number): Promise<project_skill> {
        this.state(project_id);
        return archive_project_skill(this, project_id, skill_id, at);
    }

    async searchCodeSymbols(project_id: string, query: string, limit = 20): Promise<project_code_symbol[]> {
        return search_code_symbols(await this.code_symbols(project_id), query, limit);
    }

    async getCodeCallers(project_id: string, symbol: string): Promise<project_code_relation[]> {
        return code_callers(await this.code_symbols(project_id), symbol);
    }

    async getCodeCallees(project_id: string, symbol: string): Promise<project_code_relation[]> {
        return code_callees(await this.code_symbols(project_id), symbol);
    }

    async getCodeImpact(project_id: string, symbol: string, max_depth = 5): Promise<project_code_impact[]> {
        return code_impact(await this.code_symbols(project_id), symbol, max_depth);
    }

    async importSession(project_id: string, input: project_session_input): Promise<project_session> {
        const state = this.state(project_id);
        const session = await import_project_session(this.memory, state.project, state, input);
        const asset_id = input.asset_id ?? `asset:chat_memory:${session.session_id}`;
        await this.registerAsset(project_id, {
            asset_id, type: 'chat_memory', name: input.asset_name ?? `${session.provider} session ${session.session_id}`,
            description: `${session.message_count} imported conversation turns for ${session.agent_id}`,
            owner_id: session.agent_id, source_type: session.provider, source_ref: session.source_ref,
            content_ref: `longmemory://project/${encodeURIComponent(project_id)}/asset/${encodeURIComponent(asset_id)}`,
            status: input.asset_status ?? 'candidate', visibility: input.asset_visibility ?? 'agent', confidence: 0.7, labels: [session.provider, session.agent_id],
            bindings: [{ target_type: 'agent', target_id: session.agent_id, injection_mode: 'summary', priority: 0.6, required: false, enabled: true, created_by: session.agent_id }],
            payload: { session_id: session.session_id, agent_id: session.agent_id, provider: session.provider, message_count: session.message_count, summary: `${session.message_count} imported turns from ${session.provider}` },
            metadata: { ...input.metadata, started_at: session.started_at, ended_at: session.ended_at }, at: session.ended_at,
        });
        return session;
    }

    listSessions(project_id: string): Promise<project_session[]> {
        return list_project_sessions(this.memory, this.state(project_id));
    }

    registerAsset(project_id: string, input: memory_asset_input): Promise<memory_asset> {
        this.state(project_id);
        return register_memory_asset(this, project_id, input);
    }

    getAsset(project_id: string, asset_id: string): Promise<memory_asset | null> {
        this.state(project_id);
        return get_memory_asset(this, project_id, asset_id);
    }

    listAssets(project_id: string, include_terminal = false): Promise<memory_asset[]> {
        this.state(project_id);
        return list_memory_assets(this, project_id, include_terminal);
    }

    governAsset(project_id: string, asset_id: string, patch: Parameters<typeof govern_memory_asset>[3]): Promise<memory_asset> {
        this.state(project_id);
        return govern_memory_asset(this, project_id, asset_id, patch);
    }

    resolveAssetLoadout(project_id: string, input: memory_asset_loadout_input): Promise<memory_asset_loadout> {
        this.state(project_id);
        return resolve_memory_asset_loadout(this, project_id, input);
    }

    async decideAssetAccess(project_id: string, asset_id: string, context: memory_asset_access, permission: memory_asset_permission): Promise<memory_asset_decision> {
        const asset = await this.getAsset(project_id, asset_id);
        if (!asset) return { allowed: false, permission, reason: `asset ${asset_id} was not found in project ${project_id}`, matched_acl: null };
        return decide_memory_asset_access(asset, context, permission);
    }

    buildAgentManifest(project_id: string, input: agent_memory_manifest_input): Promise<agent_memory_manifest> {
        this.state(project_id);
        return build_agent_memory_manifest(this, project_id, input);
    }

    async explainProjectMemory(project_id: string, memory_id: string): Promise<memory_explanation> {
        const state = this.state(project_id);
        if (!state.nodes.has(memory_id)) throw new Error(`memory ${memory_id} does not belong to project ${project_id}`);
        return this.memory.explain(memory_id);
    }

    async close(): Promise<void> {
        if (this.owns_memory) await this.memory.close();
    }

    private state(project_id: string): project_state {
        const state = this.states.get(project_id);
        if (!state) throw new Error(`unknown project: ${project_id}`);
        return state;
    }

    private async hydrate(state: project_state): Promise<void> {
        const recalled = await this.memory.recall({
            text: '', mode: 'historical', now: Date.now(), valid_time: Date.now(), world_id: state.project.root_world_id,
            permission_context: { project_ids: [state.project.project_id] },
        });
        if (!('timeline' in recalled)) return;
        for (const entry of recalled.timeline.entries) {
            const node = entry.node;
            if (node.metadata.project_id !== state.project.project_id) continue;
            const kind = node.metadata.project_event_kind;
            if (typeof kind === 'string') {
                const event: project_event = {
                    id: String(node.metadata.project_event_id ?? node.id),
                    kind: kind as project_event['kind'],
                    text: node.content.raw,
                    topic: String(node.metadata.topic ?? kind),
                    at: node.temporal.recorded_at,
                    status: typeof node.metadata.status === 'string' ? node.metadata.status as project_event['status'] : undefined,
                    files_touched: Array.isArray(node.metadata.files_touched) ? node.metadata.files_touched as string[] : [],
                    next_actions: Array.isArray(node.metadata.next_actions) ? node.metadata.next_actions as string[] : [],
                    alternatives_rejected: Array.isArray(node.metadata.alternatives_rejected) ? node.metadata.alternatives_rejected as string[] : [],
                    repo: typeof node.metadata.repo === 'string' ? node.metadata.repo : undefined,
                    branch: typeof node.metadata.branch === 'string' ? node.metadata.branch : undefined,
                    commit: typeof node.metadata.commit === 'string' ? node.metadata.commit : undefined,
                    file_path: typeof node.metadata.file_path === 'string' ? node.metadata.file_path : undefined,
                    line_start: typeof node.metadata.line_start === 'number' ? node.metadata.line_start : undefined,
                    line_end: typeof node.metadata.line_end === 'number' ? node.metadata.line_end : undefined,
                    checksum: typeof node.metadata.checksum === 'string' ? node.metadata.checksum : undefined,
                    rationale: typeof node.metadata.rationale === 'string' ? node.metadata.rationale : undefined,
                    owner: typeof node.metadata.owner === 'string' ? node.metadata.owner : undefined,
                    priority: typeof node.metadata.priority === 'string' ? node.metadata.priority as project_event['priority'] : undefined,
                    metadata: node.metadata,
                };
                const prior = state.current_by_topic.get(`${event.kind}:${event.topic ?? event.kind}`);
                const prior_text = prior ? state.nodes.get(prior)?.text ?? null : null;
                state.record(node, event, event.id as string);
                if (node.state.status === 'active' && node.temporal.superseded_at === null) this.update_summary(state, event, prior_text);
            } else {
                state.nodes.set(node.id, { node_id: node.id, event_id: String(node.metadata.external_id ?? node.id), kind: 'connector', topic: String(node.metadata.title ?? node.content.summary), text: node.content.raw, status: node.state.status, at: node.temporal.recorded_at });
                const analysis = node.metadata.analysis as Record<string, unknown> | undefined;
                if (analysis?.role === 'source' || node.facets.procedural) state.code_nodes.add(node.id);
            }
        }
    }

    private async code_symbols(project_id: string): Promise<project_code_symbol[]> {
        const state = this.state(project_id);
        const nodes = await Promise.all([...state.code_nodes].map(async (id) => (await this.memory.explain(id)).node));
        return code_symbols_from_nodes(nodes.filter((node): node is NonNullable<typeof node> => !!node && node.state.status === 'active'));
    }

    private update_summary(state: project_state, event: project_event, prior_text: string | null): void {
        const replace = (values: string[]) => {
            const next = prior_text ? values.filter((value) => value !== prior_text) : [...values];
            if (!next.includes(event.text)) next.push(event.text);
            return next;
        };
        if (event.kind === 'goal') state.project.active_goals = replace(state.project.active_goals);
        if (event.kind === 'constraint' || event.kind === 'requirement') state.project.active_constraints = replace(state.project.active_constraints);
        if (event.kind === 'architecture') state.project.current_architecture_summary = event.text;
        if (event.kind === 'decision') state.project.current_decisions = replace(state.project.current_decisions);
        if (event.kind === 'question') state.project.unresolved_questions = replace(state.project.unresolved_questions);
        if (event.kind === 'task' && !['completed', 'resolved', 'stale'].includes(event.status ?? 'open')) state.project.open_tasks = replace(state.project.open_tasks);
        if (event.kind === 'convention' || event.kind === 'preference') state.project.coding_conventions = replace(state.project.coding_conventions);
        if (event.kind === 'deployment') state.project.deployment_targets = replace(state.project.deployment_targets);
        if (event.kind === 'risk') state.project.risk_register = replace(state.project.risk_register);
        state.project.updated_at = event.at ?? Date.now();
    }
}

export async function create_project_memory(config: project_memory_config): Promise<project_memory> {
    const manager = new project_memory(config);
    await manager.createProject(config);
    return manager;
}

export { create_project_memory as createProjectMemory };

export const linkSourceToProject = (manager: project_memory, project_id: string, source: project_source_input) => manager.linkSourceToProject(project_id, source);
export const ingestProjectEvent = (manager: project_memory, project_id: string, event: project_event) => manager.ingestProjectEvent(project_id, event);
export const syncProjectSource = (manager: project_memory, project_id: string, connector_id: string, options?: project_sync_options) => manager.syncProjectSource(project_id, connector_id, options);
export const recallProject = (manager: project_memory, project_id: string, query: project_recall_query, mode: project_recall_mode) => manager.recallProject(project_id, query, mode);
export const getProjectContext = (manager: project_memory, project_id: string, task: string, token_budget?: number, agent_id?: string, framework?: string, access?: Partial<Pick<memory_asset_loadout_input, 'user_id' | 'team_ids' | 'roles' | 'task_id'>>) => manager.getProjectContext(project_id, task, token_budget, agent_id, framework, access);
export const getProjectDecisions = (manager: project_memory, project_id: string) => manager.getProjectDecisions(project_id);
export const getProjectTasks = (manager: project_memory, project_id: string) => manager.getProjectTasks(project_id);
export const createProjectSkill = (manager: project_memory, project_id: string, input: project_skill_input) => manager.createSkill(project_id, input);
export const getProjectSkill = (manager: project_memory, project_id: string, skill_id: string) => manager.getSkill(project_id, skill_id);
export const listProjectSkills = (manager: project_memory, project_id: string, include_archived?: boolean) => manager.listSkills(project_id, include_archived);
export const matchProjectSkills = (manager: project_memory, project_id: string, query: string, agent_id?: string, limit?: number) => manager.matchSkills(project_id, query, agent_id, limit);
export const bindProjectSkill = (manager: project_memory, project_id: string, skill_id: string, agent_ids: string[], at?: number) => manager.bindSkill(project_id, skill_id, agent_ids, at);
export const archiveProjectSkill = (manager: project_memory, project_id: string, skill_id: string, at?: number) => manager.archiveSkill(project_id, skill_id, at);
export const searchProjectCodeSymbols = (manager: project_memory, project_id: string, query: string, limit?: number) => manager.searchCodeSymbols(project_id, query, limit);
export const getProjectCodeCallers = (manager: project_memory, project_id: string, symbol: string) => manager.getCodeCallers(project_id, symbol);
export const getProjectCodeCallees = (manager: project_memory, project_id: string, symbol: string) => manager.getCodeCallees(project_id, symbol);
export const getProjectCodeImpact = (manager: project_memory, project_id: string, symbol: string, max_depth?: number) => manager.getCodeImpact(project_id, symbol, max_depth);
export const importProjectSession = (manager: project_memory, project_id: string, input: project_session_input) => manager.importSession(project_id, input);
export const listProjectSessions = (manager: project_memory, project_id: string) => manager.listSessions(project_id);
export const registerMemoryAsset = (manager: project_memory, project_id: string, input: memory_asset_input) => manager.registerAsset(project_id, input);
export const getMemoryAsset = (manager: project_memory, project_id: string, asset_id: string) => manager.getAsset(project_id, asset_id);
export const listMemoryAssets = (manager: project_memory, project_id: string, include_terminal?: boolean) => manager.listAssets(project_id, include_terminal);
export const governMemoryAsset = (manager: project_memory, project_id: string, asset_id: string, patch: Parameters<typeof govern_memory_asset>[3]) => manager.governAsset(project_id, asset_id, patch);
export const resolveMemoryAssetLoadout = (manager: project_memory, project_id: string, input: memory_asset_loadout_input) => manager.resolveAssetLoadout(project_id, input);
export const decideMemoryAssetAccess = (manager: project_memory, project_id: string, asset_id: string, context: memory_asset_access, permission: memory_asset_permission) => manager.decideAssetAccess(project_id, asset_id, context, permission);
export const buildAgentMemoryManifest = (manager: project_memory, project_id: string, input: agent_memory_manifest_input) => manager.buildAgentManifest(project_id, input);
export const explainProjectMemory = (manager: project_memory, project_id: string, memory_id: string) => manager.explainProjectMemory(project_id, memory_id);