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
 *  file  : src/core/project/project_ingest.ts
 *  usage : project events and connector plans into scoped Hydrograph plans
 */

import { hash_canonical } from '../hash/content_hash.js';
import type { open_memory } from '../create_memory.js';
import { sync_connector, type connector_sync_options, type connector_sync_report } from '../connectors/connector_ingest.js';
import type { HydrographImportPlan, planned_node } from '../connectors/source_event.js';
import { project_contract_to_memory, project_permission, type ProjectWorld, type project_world_kind } from './project_world.js';
import type { project_event, project_source_link, project_state } from './project_state.js';

const event_world: Record<project_event['kind'], project_world_kind> = {
    architecture: 'architecture', decision: 'decisions', requirement: 'constraints', goal: 'goals', constraint: 'constraints',
    task: 'tasks', bug: 'failures', failure: 'failures', preference: 'conventions', convention: 'conventions',
    deployment: 'deployments', risk: 'risks', question: 'questions', reference: 'references', agent_state: 'agent_sessions',
    code_fact: 'repositories', manual_fact: 'documents',
};

const replace_by_default = new Set<project_event['kind']>(['architecture', 'decision', 'requirement', 'goal', 'constraint', 'task', 'preference', 'convention', 'deployment', 'agent_state', 'code_fact']);

const event_plan = (project: ProjectWorld, state: project_state, event: project_event, at: number): { plan: HydrographImportPlan; event_id: string; key: string } => {
    const topic = event.topic ?? event.kind;
    const event_id = event.id ?? `project-event:${hash_canonical([project.project_id, event.kind, topic, event.text, at]).slice(0, 24)}`;
    const checksum = event.checksum ?? hash_canonical([event.text, event.metadata ?? {}, event.commit ?? null, event.file_path ?? null]);
    const key = `event:${event_id}`;
    const permission = project_permission(project.project_id);
    const world_kind = event_world[event.kind];
    const source_id = event.source_id ?? event.source_type ?? (event.subjective ? 'agent' : 'project-manual');
    const contract = {
        ...project_contract_to_memory(project.contract, project.project_id),
        requires_grounding: !event.subjective && project.contract.requires_source_citation,
        source_required: !event.subjective && project.contract.requires_source_citation,
        expires_if_unconfirmed: event.kind === 'code_fact' || project.contract.freshness_required,
    };
    const node: planned_node = {
        key,
        id: `project:${project.project_id}:${event.kind}:${hash_canonical([event_id, checksum, at]).slice(0, 32)}`,
        source_type: event.source_type ?? (event.subjective ? 'agent_inference' : 'project_fact'),
        external_id: event.external_id ?? event_id,
        title: topic,
        content: event.text,
        world_key: `project:${project.project_id}:${world_kind}`,
        zone: event.subjective ? 'endocortex' : 'exocortex',
        facet: event.kind === 'failure' || event.kind === 'bug' || event.kind === 'agent_state' ? 'reflective'
            : event.kind === 'code_fact' ? 'procedural' : 'semantic',
        valid_from: event.valid_from ?? event.observed_at ?? event.at ?? at,
        valid_to: null,
        observed_at: event.observed_at ?? event.at ?? at,
        recorded_at: at,
        version: String(event.metadata?.version ?? event.commit ?? checksum),
        checksum,
        url: event.url ?? null,
        timestamp_seconds: null,
        permission,
        contract,
        provenance: {
            connector_id: `project:${project.project_id}`,
            source_type: event.source_type ?? (event.subjective ? 'agent_inference' : 'project_fact'),
            external_id: event.external_id ?? event_id,
            url: event.url ?? null,
            version: String(event.metadata?.version ?? event.commit ?? checksum),
            checksum,
            recorded_at: at,
            metadata: { project_id: project.project_id, event_kind: event.kind },
        },
        entities: (event.entities ?? []).map((entity) => ({ ...entity, observed_at: event.observed_at ?? at, metadata: { ...entity, project_id: project.project_id } })),
        grounding_source: { id: source_id, kind: event.source_type === 'local_file' ? 'document' : event.source_type ? 'api' : 'manual', reliability: event.subjective ? 0.5 : 0.85 },
        metadata: {
            ...event.metadata,
            project_id: project.project_id,
            tenant_id: project.tenant_id,
            organization_id: project.organization_id,
            project_event_id: event_id,
            project_event_kind: event.kind,
            topic,
            status: event.status ?? null,
            priority: event.priority ?? null,
            owner: event.owner ?? null,
            rationale: event.rationale ?? null,
            alternatives_rejected: event.alternatives_rejected ?? [],
            repo: event.repo ?? null,
            branch: event.branch ?? null,
            commit: event.commit ?? null,
            file_path: event.file_path ?? null,
            line_start: event.line_start ?? null,
            line_end: event.line_end ?? null,
            checksum,
            files_touched: event.files_touched ?? [],
            next_actions: event.next_actions ?? [],
            citation: { source_type: event.source_type ?? 'project_fact', external_id: event.external_id ?? event_id, url: event.url ?? null, repo: event.repo ?? null, branch: event.branch ?? null, commit: event.commit ?? null, file_path: event.file_path ?? null, line_start: event.line_start ?? null, line_end: event.line_end ?? null, checksum },
        },
        conflict_behavior: (event.replace_current ?? replace_by_default.has(event.kind)) ? 'none' : 'contradict',
    };
    const current = state.current_by_topic.get(`${event.kind}:${topic}`);
    const should_replace = event.replace_current ?? replace_by_default.has(event.kind);
    const plan: HydrographImportPlan = {
        connector_id: `project:${project.project_id}`,
        source_type: node.source_type,
        sync_item_id: event_id,
        recorded_at: at,
        nodes_to_create: [node],
        edges_to_create: [],
        worlds_to_create: [],
        entities_to_resolve: node.entities,
        grounding_refs: node.zone === 'exocortex' ? [{ node_key: key, source: node.grounding_source, ref: node.url ?? node.external_id }] : [],
        contracts: [{ node_key: key, contract }],
        provenance: [node.provenance],
        deletion_or_supersession_actions: current && should_replace ? [{ type: 'supersede', target_node_id: current, replacement_node_key: key, external_id: node.external_id, recorded_at: at, reason: `project ${event.kind} updated` }] : [],
        checksum,
        warnings: event.subjective ? ['subjective project inference; not external truth'] : [],
    };
    return { plan, event_id, key };
};

export async function ingest_project_event(memory: open_memory, project: ProjectWorld, state: project_state, event: project_event): Promise<string> {
    const at = event.at ?? Date.now();
    const built = event_plan(project, state, event, at);
    const result = await memory.applyImportPlan(built.plan);
    const explanations = await Promise.all(result.node_ids.map((id) => memory.explain(id)));
    const imported = explanations.find((item) => item.node?.metadata.project_event_id === built.event_id)?.node;
    if (!imported) throw new Error(`project event ${built.event_id} did not produce its planned node`);
    state.record(imported, event, built.event_id);
    project.updated_at = at;
    return imported.id;
}

export function scope_connector_plan(project: ProjectWorld, link: project_source_link, plan: HydrographImportPlan): HydrographImportPlan {
    const prefix = `project:${project.project_id}:source:${link.connector_id}:`;
    const world_keys = new Set(plan.worlds_to_create.map((world) => world.key));
    const node_keys = new Set(plan.nodes_to_create.map((node) => node.key));
    const map_world = (key: string) => `${prefix}world:${key}`;
    const map_node = (key: string) => `${prefix}node:${key}`;
    const permission = project_permission(project.project_id);
    return {
        ...plan,
        connector_id: `${link.connector_id}:project:${project.project_id}`,
        sync_item_id: `${project.project_id}:${plan.sync_item_id}`,
        worlds_to_create: plan.worlds_to_create.map((world) => ({
            ...world,
            key: map_world(world.key),
            parent_key: world.parent_key ? map_world(world.parent_key) : null,
            parent_world_id: world.parent_key ? undefined : project.world_ids[link.world_kind],
            contracts: { ...world.contracts, source_permission: { scope: 'project', user_ids: [], team_ids: [], project_ids: [project.project_id], source_id: link.connector_id } },
            metadata: { ...world.metadata, project_id: project.project_id, linked_connector_id: link.connector_id },
        })),
        nodes_to_create: plan.nodes_to_create.map((node) => ({
            ...node,
            key: map_node(node.key),
            id: `project:${project.project_id}:${node.id}`,
            world_key: world_keys.has(node.world_key) ? map_world(node.world_key) : node.world_key,
            permission,
            contract: { ...node.contract, source_permission: { scope: 'project', user_ids: [], team_ids: [], project_ids: [project.project_id], source_id: link.connector_id } },
            metadata: { ...node.metadata, project_id: project.project_id, linked_connector_id: link.connector_id, source_snapshot_ref: link.current_ref },
            provenance: { ...node.provenance, connector_id: `${link.connector_id}:project:${project.project_id}`, metadata: { ...node.provenance.metadata, project_id: project.project_id } },
        })),
        edges_to_create: plan.edges_to_create.map((edge) => ({ ...edge, key: `${prefix}edge:${edge.key}`, from: node_keys.has(edge.from) ? map_node(edge.from) : edge.from, to: node_keys.has(edge.to) ? map_node(edge.to) : edge.to, metadata: { ...edge.metadata, project_id: project.project_id } })),
        contracts: plan.contracts.map((item) => ({ ...item, node_key: node_keys.has(item.node_key) ? map_node(item.node_key) : item.node_key })),
        grounding_refs: plan.grounding_refs.map((item) => ({ ...item, node_key: node_keys.has(item.node_key) ? map_node(item.node_key) : item.node_key })),
        deletion_or_supersession_actions: plan.deletion_or_supersession_actions.map((action) => ({ ...action, replacement_node_key: action.replacement_node_key && node_keys.has(action.replacement_node_key) ? map_node(action.replacement_node_key) : action.replacement_node_key })),
        provenance: plan.provenance.map((item) => ({ ...item, connector_id: `${link.connector_id}:project:${project.project_id}`, metadata: { ...item.metadata, project_id: project.project_id } })),
    };
}

export async function sync_project_source(memory: open_memory, project: ProjectWorld, state: project_state, link: project_source_link, options: connector_sync_options = {}): Promise<connector_sync_report> {
    const report = await sync_connector(link.connector, memory, {
        ...options,
        default_permission: project_permission(project.project_id),
        transform_plan: (plan) => scope_connector_plan(project, link, plan),
    });
    state.sync_reports.push(report);
    link.last_synced_at = report.completed_at;
    project.updated_at = report.completed_at;
    for (const id of report.node_ids) {
        const node = (await memory.explain(id)).node;
        if (!node) continue;
        state.nodes.set(id, { node_id: id, event_id: String(node.metadata.external_id ?? id), kind: 'connector', topic: String(node.metadata.title ?? node.content.summary), text: node.content.raw, status: node.state.status, at: node.temporal.recorded_at });
        const role = (node.metadata.analysis as Record<string, unknown> | undefined)?.role;
        if (role === 'source' || node.facets.procedural) state.code_nodes.add(id);
    }
    return report;
}