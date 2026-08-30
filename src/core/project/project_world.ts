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
 *  file  : src/core/project/project_world.ts
 *  usage : implements the LongMemory project world component
 */

import type { connector_permission } from '../connectors/permission.js';
import type { planned_world } from '../connectors/source_event.js';
import type { Contract } from '../types/contract.js';

export type ProjectMemoryContract = {
    visible_to_project_agents: boolean;
    visible_to_user: boolean;
    visible_to_team: boolean;
    use_for_code_generation: boolean;
    use_for_planning: boolean;
    use_for_debugging: boolean;
    use_for_decision_making: boolean;
    requires_source_citation: boolean;
    freshness_required: boolean;
};

export type project_source_summary = {
    connector_id: string;
    source_type: string;
    label: string;
    current_ref: string | null;
    linked_at: number;
    last_synced_at: number | null;
};

export type ProjectWorld = {
    id: string;
    tenant_id: string;
    organization_id: string;
    project_id: string;
    name: string;
    description: string;
    root_world_id: string;
    world_ids: Record<project_world_kind, string>;
    linked_sources: project_source_summary[];
    active_goals: string[];
    active_constraints: string[];
    current_architecture_summary: string | null;
    current_decisions: string[];
    unresolved_questions: string[];
    open_tasks: string[];
    coding_conventions: string[];
    deployment_targets: string[];
    risk_register: string[];
    contract: ProjectMemoryContract;
    created_at: number;
    updated_at: number;
};

export type project_world_kind =
    | 'repositories'
    | 'documents'
    | 'issues'
    | 'deployments'
    | 'decisions'
    | 'agent_sessions'
    | 'architecture'
    | 'tasks'
    | 'conventions'
    | 'failures'
    | 'goals'
    | 'constraints'
    | 'questions'
    | 'risks'
    | 'references'
    | 'skills'
    | 'assets';

export const project_world_kinds: project_world_kind[] = [
    'repositories', 'documents', 'issues', 'deployments', 'decisions', 'agent_sessions', 'architecture', 'tasks',
    'conventions', 'failures', 'goals', 'constraints', 'questions', 'risks', 'references', 'skills', 'assets',
];

export type project_config = {
    tenant_id: string;
    organization_id?: string;
    project_id: string;
    name: string;
    description?: string;
    contract?: Partial<ProjectMemoryContract>;
    db_path?: string;
    store?: 'memory' | 'sqlite';
    max_context_tokens?: number;
    created_at?: number;
};

export const default_project_contract = (): ProjectMemoryContract => ({
    visible_to_project_agents: true,
    visible_to_user: true,
    visible_to_team: true,
    use_for_code_generation: true,
    use_for_planning: true,
    use_for_debugging: true,
    use_for_decision_making: true,
    requires_source_citation: true,
    freshness_required: true,
});

export const project_permission = (project_id: string): connector_permission => ({
    scope: 'project', user_ids: [], team_ids: [], project_ids: [project_id], source_id: null, inherited: true,
    raw: { project_id },
});

export function project_contract_to_memory(contract: ProjectMemoryContract, project_id: string): Partial<Contract> {
    return {
        use_for_reasoning: contract.use_for_code_generation || contract.use_for_planning || contract.use_for_debugging || contract.use_for_decision_making,
        use_for_personalization: contract.visible_to_user,
        use_for_prediction: contract.use_for_planning,
        use_for_associative_recall: true,
        requires_grounding: contract.requires_source_citation,
        expires_if_unconfirmed: contract.freshness_required,
        privacy_level: 'private',
        source_required: contract.requires_source_citation,
        source_permission: {
            scope: 'project', user_ids: [], team_ids: [], project_ids: [project_id], source_id: null,
        },
    };
}

export function project_hierarchy(config: project_config, contract: ProjectMemoryContract, at: number): planned_world[] {
    const organization_id = config.organization_id ?? config.tenant_id;
    const contracts = project_contract_to_memory(contract, config.project_id);
    const tenant_key = `tenant:${config.tenant_id}`;
    const organization_key = `organization:${organization_id}`;
    const project_key = `project:${config.project_id}`;
    return [
        { key: tenant_key, name: config.tenant_id, parent_key: null, zone: 'mixed', contracts, metadata: { hierarchy: 'tenant', tenant_id: config.tenant_id }, created_at: at },
        { key: organization_key, name: organization_id, parent_key: tenant_key, zone: 'mixed', contracts, metadata: { hierarchy: 'organization', tenant_id: config.tenant_id, organization_id }, created_at: at },
        { key: project_key, name: config.name, parent_key: organization_key, zone: 'mixed', contracts, metadata: { hierarchy: 'project', tenant_id: config.tenant_id, organization_id, project_id: config.project_id, description: config.description ?? '' }, created_at: at },
        ...project_world_kinds.map((kind): planned_world => ({
            key: `project:${config.project_id}:${kind}`,
            name: kind.replace(/_/g, ' '),
            parent_key: project_key,
            zone: kind === 'agent_sessions' ? 'endocortex' : 'mixed',
            contracts,
            metadata: { hierarchy: kind, tenant_id: config.tenant_id, organization_id, project_id: config.project_id },
            created_at: at,
        })),
    ];
}