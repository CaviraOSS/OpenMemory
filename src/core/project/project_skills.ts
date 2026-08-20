import { hash_canonical } from '../hash/content_hash.js';
import type { HydroNode } from '../types/hydro_node.js';
import type { project_memory } from './project_memory.js';

export type project_skill_visibility = 'private' | 'project' | 'team' | 'restricted';

export type project_skill_resource = {
    path: string;
    description?: string;
    checksum?: string;
};

export type project_skill_input = {
    skill_id?: string;
    name: string;
    description: string;
    triggers: string[];
    instructions: string[];
    validation?: string[];
    resources?: project_skill_resource[];
    agent_ids?: string[];
    visibility?: project_skill_visibility;
    owner?: string;
    source_type?: string;
    source_id?: string;
    at?: number;
};

export type project_skill = Required<Pick<project_skill_input,
    'name' | 'description' | 'triggers' | 'instructions' | 'validation' | 'resources' | 'agent_ids' | 'visibility'
>> & {
    skill_id: string;
    node_id: string;
    project_id: string;
    version: number;
    status: 'active' | 'archived';
    owner: string | null;
    created_at: number;
    updated_at: number;
};

export type project_skill_match = {
    skill: project_skill;
    score: number;
    matched_triggers: string[];
};

const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const resources = (value: unknown): project_skill_resource[] => Array.isArray(value) ? value.filter((item): item is project_skill_resource =>
    !!item && typeof item === 'object' && typeof (item as project_skill_resource).path === 'string') : [];
const tokens = (value: string): Set<string> => new Set(value.toLocaleLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? []);
const clean = (values: string[], name: string): string[] => {
    const result = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
    if (!result.length) throw new Error(`${name} must contain at least one value`);
    return result;
};

const from_node = (node: HydroNode): project_skill => ({
    skill_id: String(node.metadata.skill_id),
    node_id: node.id,
    project_id: String(node.metadata.project_id),
    name: String(node.metadata.skill_name),
    description: String(node.metadata.skill_description),
    version: Number(node.metadata.skill_version),
    status: node.metadata.skill_status === 'archived' ? 'archived' : 'active',
    triggers: strings(node.metadata.skill_triggers),
    instructions: strings(node.metadata.skill_instructions),
    validation: strings(node.metadata.skill_validation),
    resources: resources(node.metadata.skill_resources),
    agent_ids: strings(node.metadata.skill_agent_ids),
    visibility: ['private', 'project', 'team', 'restricted'].includes(String(node.metadata.skill_visibility))
        ? node.metadata.skill_visibility as project_skill_visibility : 'project',
    owner: typeof node.metadata.owner === 'string' ? node.metadata.owner : null,
    created_at: Number(node.metadata.skill_created_at ?? node.temporal.recorded_at),
    updated_at: node.temporal.recorded_at,
});

const skill_nodes = async (manager: project_memory, project_id: string): Promise<HydroNode[]> => {
    const project = manager.getProject(project_id);
    const result = await manager.memory.recall({
        text: '', mode: 'historical', now: Date.now(), valid_time: Date.now(), world_id: project.world_ids.skills,
        permission_context: { project_ids: [project_id] },
    });
    if (!('timeline' in result)) return [];
    return result.timeline.entries.map((entry) => entry.node)
        .filter((node) => node.metadata.project_id === project_id && node.metadata.project_event_kind === 'skill');
};

export const list_project_skills = async (manager: project_memory, project_id: string, include_archived = false): Promise<project_skill[]> => {
    const latest = new Map<string, project_skill>();
    for (const node of await skill_nodes(manager, project_id)) {
        const skill = from_node(node);
        const prior = latest.get(skill.skill_id);
        if (!prior || skill.version > prior.version || skill.version === prior.version && skill.updated_at > prior.updated_at) latest.set(skill.skill_id, skill);
    }
    return [...latest.values()]
        .filter((skill) => include_archived || skill.status === 'active')
        .sort((left, right) => left.name.localeCompare(right.name));
};

export const get_project_skill = async (manager: project_memory, project_id: string, skill_id: string): Promise<project_skill | null> =>
    (await list_project_skills(manager, project_id, true)).find((skill) => skill.skill_id === skill_id) ?? null;

export const create_project_skill = async (manager: project_memory, project_id: string, input: project_skill_input): Promise<project_skill> => {
    const name = input.name.trim();
    const description = input.description.trim();
    if (!name) throw new Error('skill name is required');
    if (!description) throw new Error('skill description is required');
    const skill_id = input.skill_id?.trim() || `skill:${hash_canonical([project_id, name]).slice(0, 24)}`;
    const prior = await get_project_skill(manager, project_id, skill_id);
    if (prior?.status === 'archived') throw new Error(`skill ${skill_id} is archived and cannot be versioned`);
    const version = (prior?.version ?? 0) + 1;
    const at = input.at ?? Date.now();
    const triggers = clean(input.triggers, 'skill triggers');
    const instructions = clean(input.instructions, 'skill instructions');
    const validation = [...new Set((input.validation ?? []).map((value) => value.trim()).filter(Boolean))];
    const skill_resources = (input.resources ?? []).map((resource) => ({ ...resource, path: resource.path.trim() })).filter((resource) => resource.path);
    const agent_ids = [...new Set((input.agent_ids ?? []).map((value) => value.trim()).filter(Boolean))];
    await manager.ingestProjectEvent(project_id, {
        kind: 'skill', topic: skill_id, text: `${name}\n\n${description}\n\n${instructions.map((step, index) => `${index + 1}. ${step}`).join('\n')}`,
        at, subjective: true, replace_current: true, source_type: input.source_type ?? 'skill_library', source_id: input.source_id ?? input.owner ?? 'project-skill', owner: input.owner,
        metadata: {
            skill_id, skill_name: name, skill_description: description, skill_version: version, skill_status: 'active',
            skill_triggers: triggers, skill_instructions: instructions, skill_validation: validation, skill_resources,
            skill_agent_ids: agent_ids, skill_visibility: input.visibility ?? prior?.visibility ?? 'project',
            skill_created_at: prior?.created_at ?? at,
        },
    });
    const created = await get_project_skill(manager, project_id, skill_id);
    if (!created || created.version !== version) throw new Error(`skill ${skill_id} was not persisted`);
    await manager.registerAsset(project_id, {
        asset_id: `asset:skill:${skill_id}`, type: 'skill', name, description, owner_id: input.owner ?? prior?.owner ?? 'project',
        source_type: input.source_type ?? 'skill_library', source_ref: input.source_id ?? null,
        content_ref: `openmemory://project/${encodeURIComponent(project_id)}/asset/${encodeURIComponent(`asset:skill:${skill_id}`)}`,
        status: 'approved', visibility: input.visibility ?? prior?.visibility ?? 'project', confidence: 1,
        labels: triggers, payload: { skill_id, triggers, instructions, validation, resources: skill_resources }, at,
        bindings: agent_ids.map((agent_id) => ({
            target_type: 'agent', target_id: agent_id, injection_mode: 'direct', priority: 0.9,
            required: false, enabled: true, created_by: input.owner ?? 'project',
        })),
        metadata: { skill_version: version },
    });
    return created;
};

export const bind_project_skill = async (manager: project_memory, project_id: string, skill_id: string, agent_ids: string[], at = Date.now()): Promise<project_skill> => {
    const skill = await get_project_skill(manager, project_id, skill_id);
    if (!skill || skill.status !== 'active') throw new Error(`active skill ${skill_id} was not found in project ${project_id}`);
    return create_project_skill(manager, project_id, { ...skill, owner: skill.owner ?? undefined, agent_ids, at });
};

export const archive_project_skill = async (manager: project_memory, project_id: string, skill_id: string, at = Date.now()): Promise<project_skill> => {
    const skill = await get_project_skill(manager, project_id, skill_id);
    if (!skill) throw new Error(`skill ${skill_id} was not found in project ${project_id}`);
    await manager.ingestProjectEvent(project_id, {
        kind: 'skill', topic: skill_id, text: `${skill.name}\n\nArchived skill: ${skill.description}`, at, subjective: true,
        replace_current: true, status: 'stale', source_type: 'skill_library', owner: skill.owner ?? undefined,
        metadata: {
            skill_id, skill_name: skill.name, skill_description: skill.description, skill_version: skill.version + 1,
            skill_status: 'archived', skill_triggers: skill.triggers, skill_instructions: skill.instructions,
            skill_validation: skill.validation, skill_resources: skill.resources, skill_agent_ids: [],
            skill_visibility: skill.visibility, skill_created_at: skill.created_at,
        },
    });
    const archived = await get_project_skill(manager, project_id, skill_id) as project_skill;
    const asset_id = `asset:skill:${skill_id}`;
    const asset = await manager.getAsset(project_id, asset_id);
    if (asset) await manager.governAsset(project_id, asset_id, { status: 'archived', bindings: [], at });
    else await manager.registerAsset(project_id, {
        asset_id, type: 'skill', name: archived.name, description: archived.description, owner_id: archived.owner ?? 'project',
        source_type: 'skill_library', content_ref: `openmemory://project/${encodeURIComponent(project_id)}/asset/${encodeURIComponent(asset_id)}`,
        status: 'archived', visibility: archived.visibility, confidence: 1, labels: archived.triggers,
        payload: { skill_id, triggers: archived.triggers, instructions: archived.instructions, validation: archived.validation, resources: archived.resources }, at,
    });
    return archived;
};

export const match_project_skills = async (manager: project_memory, project_id: string, query: string, agent_id?: string, limit = 5): Promise<project_skill_match[]> => {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('skill match limit must be an integer between 1 and 100');
    const query_tokens = tokens(query);
    return (await list_project_skills(manager, project_id))
        .filter((skill) => !agent_id || !skill.agent_ids.length || skill.agent_ids.includes(agent_id))
        .map((skill) => {
            const matched_triggers = skill.triggers.filter((trigger) => {
                const normalized = trigger.toLocaleLowerCase();
                const trigger_tokens = tokens(trigger);
                return query.toLocaleLowerCase().includes(normalized) || [...trigger_tokens].every((token) => query_tokens.has(token));
            });
            const description_overlap = [...tokens(`${skill.name} ${skill.description}`)].filter((token) => query_tokens.has(token)).length;
            return { skill, matched_triggers, score: matched_triggers.length * 2 + description_overlap / Math.max(1, query_tokens.size) };
        })
        .filter((match) => match.score > 0)
        .sort((left, right) => right.score - left.score || right.skill.version - left.skill.version || left.skill.name.localeCompare(right.skill.name))
        .slice(0, limit);
};