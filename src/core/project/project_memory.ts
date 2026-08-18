/*
 *   _____                 ___  ___
 *  |  _  |                |  \/  |
 *  | | | |_ __   ___ _ __ | .  . | ___ _ __ ___   ___  _ __ _   _
 *  | | | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 *  \ \_/ / |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
 *   \___/| .__/ \___|_| |_\_|  |_/\___|_| |_| |_|\___/|_|   \__, |
 *        | |                                                 __/ |
 *        |_|                                                |___/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/core/project/project_memory.ts
 *  usage : public project-scoped Hydrograph orchestration
 */

import { create_memory, type memory_explanation, type open_memory } from '../create_memory.js';
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
    default_project_contract,
    project_hierarchy,
    type ProjectMemoryContract,
    type ProjectWorld,
    type project_config,
    type project_world_kind,
    project_world_kinds,
} from './project_world.js';

export type project_memory_config = project_config & {
    memory?: open_memory;
    connector_registry?: ConnectorRegistry;
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
    readonly memory: open_memory;
    readonly connector_registry: ConnectorRegistry;
    private readonly states = new Map<string, project_state>();
    private readonly owns_memory: boolean;
    private readonly max_context_tokens: number;

    constructor(config: project_memory_config) {
        this.memory = config.memory ?? create_memory({
            store: config.store ?? (config.db_path ? 'sqlite' : 'memory'),
            db_path: config.db_path,
            tenant_id: config.tenant_id,
            user_id: `project:${config.project_id}`,
        });
        this.owns_memory = !config.memory;
        this.connector_registry = config.connector_registry ?? default_connector_registry;
        this.max_context_tokens = config.max_context_tokens ?? 2048;
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
        project.root_world_id = root.id;
        for (const kind of project_world_kinds) {
            const world = worlds.find((item) => item.metadata.project_id === config.project_id && item.metadata.hierarchy === kind);
            if (!world) throw new Error(`project ${config.project_id} is missing ${kind} world`);
            project.world_ids[kind] = world.id;
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

    getProjectContext(project_id: string, task: string, token_budget = this.max_context_tokens): Promise<project_context_packet> {
        const state = this.state(project_id);
        return get_project_context_packet(this.memory, state.project, state, task, token_budget);
    }

    getProjectDecisions(project_id: string): Promise<project_decision[]> {
        const state = this.state(project_id);
        return get_project_decisions(this.memory, state);
    }

    getProjectTasks(project_id: string): Promise<project_task[]> {
        const state = this.state(project_id);
        return get_project_tasks(this.memory, state);
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
            }
        }
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
export const getProjectContext = (manager: project_memory, project_id: string, task: string, token_budget?: number) => manager.getProjectContext(project_id, task, token_budget);
export const getProjectDecisions = (manager: project_memory, project_id: string) => manager.getProjectDecisions(project_id);
export const getProjectTasks = (manager: project_memory, project_id: string) => manager.getProjectTasks(project_id);
export const explainProjectMemory = (manager: project_memory, project_id: string, memory_id: string) => manager.explainProjectMemory(project_id, memory_id);