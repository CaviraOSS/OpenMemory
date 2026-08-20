import { hash_canonical } from '../hash/content_hash.js';
import { count_tokens } from '../recall/context_builder.js';
import type { HydroNode } from '../types/hydro_node.js';
import type { project_memory } from './project_memory.js';

export type memory_asset_type = 'chat_memory' | 'skill' | 'llm_wiki' | 'code_graph';
export type memory_asset_status = 'draft' | 'candidate' | 'approved' | 'deprecated' | 'archived' | 'failed';
export type memory_asset_visibility = 'private' | 'project' | 'team' | 'restricted' | 'agent' | 'task';
export type memory_asset_permission = 'read' | 'use' | 'assign' | 'share' | 'manage';
export type memory_asset_subject = 'user' | 'team' | 'role' | 'agent' | 'task' | 'framework';
export type memory_asset_injection_mode = 'direct' | 'summary' | 'tool' | 'reference';
export type memory_asset_target = 'agent' | 'task' | 'framework';

export type memory_asset_acl = {
    subject_type: memory_asset_subject;
    subject_id: string;
    permissions: memory_asset_permission[];
    effect: 'allow' | 'deny';
};

export type memory_asset_binding = {
    target_type: memory_asset_target;
    target_id: string;
    injection_mode: memory_asset_injection_mode;
    priority: number;
    required: boolean;
    enabled: boolean;
    created_by: string;
};

export type memory_asset_input = {
    asset_id?: string;
    type: memory_asset_type;
    name: string;
    description: string;
    owner_id: string;
    source_type: string;
    source_ref?: string | null;
    content_ref: string;
    status?: memory_asset_status;
    visibility?: memory_asset_visibility;
    team_ids?: string[];
    acl?: memory_asset_acl[];
    bindings?: memory_asset_binding[];
    confidence?: number;
    expires_at?: number | null;
    labels?: string[];
    payload?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    at?: number;
};

export type memory_asset = Required<Pick<memory_asset_input,
    'type' | 'name' | 'description' | 'owner_id' | 'source_type' | 'content_ref' | 'status' | 'visibility' |
    'team_ids' | 'acl' | 'bindings' | 'confidence' | 'labels' | 'payload' | 'metadata'
>> & {
    asset_id: string;
    node_id: string;
    project_id: string;
    source_ref: string | null;
    version: number;
    expires_at: number | null;
    created_at: number;
    updated_at: number;
};

export type memory_asset_access = {
    user_id?: string;
    team_ids?: string[];
    roles?: string[];
    agent_id?: string;
    task_id?: string;
    framework?: string;
};

export type memory_asset_decision = {
    allowed: boolean;
    permission: memory_asset_permission;
    reason: string;
    matched_acl: memory_asset_acl | null;
};

export type memory_asset_loadout_input = memory_asset_access & {
    query: string;
    token_budget?: number;
    include_unbound?: boolean;
    asset_types?: memory_asset_type[];
    now?: number;
};

export type memory_asset_loadout_item = {
    asset: memory_asset;
    binding: memory_asset_binding | null;
    score: number;
    estimated_tokens: number;
    context: Record<string, unknown>;
    annotations: { audience: ['assistant']; priority: number; last_modified: string };
};

export type memory_asset_loadout = {
    project_id: string;
    query: string;
    selected: memory_asset_loadout_item[];
    excluded: Array<{ asset_id: string; reason: string }>;
    tokens_used: number;
    token_budget: number;
    within_budget: boolean;
};

const asset_types: memory_asset_type[] = ['chat_memory', 'skill', 'llm_wiki', 'code_graph'];
const asset_statuses: memory_asset_status[] = ['draft', 'candidate', 'approved', 'deprecated', 'archived', 'failed'];
const visibilities: memory_asset_visibility[] = ['private', 'project', 'team', 'restricted', 'agent', 'task'];
const permissions: memory_asset_permission[] = ['read', 'use', 'assign', 'share', 'manage'];
const subjects: memory_asset_subject[] = ['user', 'team', 'role', 'agent', 'task', 'framework'];
const injection_modes: memory_asset_injection_mode[] = ['direct', 'summary', 'tool', 'reference'];
const targets: memory_asset_target[] = ['agent', 'task', 'framework'];

const transitions: Record<memory_asset_status, ReadonlySet<memory_asset_status>> = {
    draft: new Set(['draft', 'candidate', 'approved', 'archived', 'failed']),
    candidate: new Set(['draft', 'candidate', 'approved', 'archived', 'failed']),
    approved: new Set(['approved', 'deprecated', 'archived', 'failed']),
    deprecated: new Set(['approved', 'deprecated', 'archived']),
    archived: new Set(['archived']),
    failed: new Set(['draft', 'candidate', 'failed', 'archived']),
};

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const clean_strings = (values: string[] = []): string[] => [...new Set(values.map((value) => value.trim()).filter(Boolean))];
const clamp = (value: number, name: string): number => {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${name} must be between 0 and 1`);
    return value;
};
const enum_value = <T extends string>(value: unknown, values: readonly T[], fallback: T): T => values.includes(value as T) ? value as T : fallback;
const required_enum = <T extends string>(value: unknown, values: readonly T[], name: string): T => {
    if (!values.includes(value as T)) throw new Error(`${name} must be one of ${values.join(', ')}`);
    return value as T;
};

const normalize_acl = (values: memory_asset_acl[] = []): memory_asset_acl[] => values.map((acl, index) => {
    const subject_type = required_enum(acl.subject_type, subjects, `asset ACL ${index} subject_type`);
    const subject_id = acl.subject_id?.trim();
    if (!subject_id) throw new Error(`asset ACL ${index} subject_id is required`);
    const acl_permissions = clean_strings(acl.permissions).map((permission) => required_enum(permission, permissions, `asset ACL ${index} permission`));
    if (!acl_permissions.length) throw new Error(`asset ACL ${index} permissions are required`);
    if (!['allow', 'deny'].includes(acl.effect)) throw new Error(`asset ACL ${index} effect must be allow or deny`);
    return { subject_type, subject_id, permissions: acl_permissions, effect: acl.effect };
});

const normalize_bindings = (values: memory_asset_binding[] = []): memory_asset_binding[] => values.map((binding, index) => {
    const target_type = required_enum(binding.target_type, targets, `asset binding ${index} target_type`);
    const target_id = binding.target_id?.trim();
    if (!target_id) throw new Error(`asset binding ${index} target_id is required`);
    return {
        target_type, target_id, injection_mode: required_enum(binding.injection_mode, injection_modes, `asset binding ${index} injection_mode`),
        priority: clamp(binding.priority, `asset binding ${index} priority`), required: Boolean(binding.required),
        enabled: binding.enabled !== false, created_by: binding.created_by?.trim() || 'system',
    };
});

const acls_from = (value: unknown): memory_asset_acl[] => Array.isArray(value) ? value.flatMap((item) => {
    const acl = record(item);
    const subject_type = enum_value(acl.subject_type, subjects, 'user');
    const subject_id = typeof acl.subject_id === 'string' ? acl.subject_id : '';
    const acl_permissions = strings(acl.permissions).map((permission) => enum_value(permission, permissions, 'read'));
    if (!subject_id || !acl_permissions.length) return [];
    return [{ subject_type, subject_id, permissions: acl_permissions, effect: acl.effect === 'deny' ? 'deny' as const : 'allow' as const }];
}) : [];

const bindings_from = (value: unknown): memory_asset_binding[] => Array.isArray(value) ? value.flatMap((item) => {
    const binding = record(item);
    if (typeof binding.target_id !== 'string') return [];
    return [{
        target_type: enum_value(binding.target_type, targets, 'agent'), target_id: binding.target_id,
        injection_mode: enum_value(binding.injection_mode, injection_modes, 'reference'),
        priority: typeof binding.priority === 'number' ? binding.priority : 0.5,
        required: Boolean(binding.required), enabled: binding.enabled !== false,
        created_by: typeof binding.created_by === 'string' ? binding.created_by : 'system',
    }];
}) : [];

const from_node = (node: HydroNode): memory_asset => ({
    asset_id: String(node.metadata.asset_id), node_id: node.id, project_id: String(node.metadata.project_id),
    type: enum_value(node.metadata.asset_type, asset_types, 'chat_memory'), name: String(node.metadata.asset_name ?? ''),
    description: String(node.metadata.asset_description ?? ''), owner_id: String(node.metadata.asset_owner_id ?? ''),
    source_type: String(node.metadata.asset_source_type ?? ''), source_ref: typeof node.metadata.asset_source_ref === 'string' ? node.metadata.asset_source_ref : null,
    content_ref: String(node.metadata.asset_content_ref ?? ''), version: Number(node.metadata.asset_version ?? 1),
    status: enum_value(node.metadata.asset_status, asset_statuses, 'draft'), visibility: enum_value(node.metadata.asset_visibility, visibilities, 'private'),
    team_ids: strings(node.metadata.asset_team_ids), acl: acls_from(node.metadata.asset_acl), bindings: bindings_from(node.metadata.asset_bindings),
    confidence: typeof node.metadata.asset_confidence === 'number' ? node.metadata.asset_confidence : 0.5,
    expires_at: typeof node.metadata.asset_expires_at === 'number' ? node.metadata.asset_expires_at : null,
    labels: strings(node.metadata.asset_labels), payload: record(node.metadata.asset_payload), metadata: record(node.metadata.asset_metadata),
    created_at: Number(node.metadata.asset_created_at ?? node.temporal.recorded_at), updated_at: node.temporal.recorded_at,
});

const asset_nodes = async (manager: project_memory, project_id: string): Promise<HydroNode[]> => {
    const project = manager.getProject(project_id);
    const result = await manager.memory.recall({
        text: '', mode: 'historical', now: Date.now(), valid_time: Date.now(), world_id: project.world_ids.assets,
        permission_context: { project_ids: [project_id] },
    });
    if (!('timeline' in result)) return [];
    return result.timeline.entries.map((entry) => entry.node)
        .filter((node) => node.metadata.project_id === project_id && node.metadata.project_event_kind === 'asset');
};

export async function list_memory_assets(manager: project_memory, project_id: string, include_terminal = false): Promise<memory_asset[]> {
    const latest = new Map<string, memory_asset>();
    for (const node of await asset_nodes(manager, project_id)) {
        const asset = from_node(node);
        const prior = latest.get(asset.asset_id);
        if (!prior || asset.version > prior.version || asset.version === prior.version && asset.updated_at > prior.updated_at) latest.set(asset.asset_id, asset);
    }
    return [...latest.values()]
        .filter((asset) => include_terminal || !['archived', 'failed'].includes(asset.status))
        .sort((left, right) => left.type.localeCompare(right.type) || left.name.localeCompare(right.name));
}

export const get_memory_asset = async (manager: project_memory, project_id: string, asset_id: string): Promise<memory_asset | null> =>
    (await list_memory_assets(manager, project_id, true)).find((asset) => asset.asset_id === asset_id) ?? null;

export async function register_memory_asset(manager: project_memory, project_id: string, input: memory_asset_input): Promise<memory_asset> {
    const type = required_enum(input.type, asset_types, 'asset type');
    const name = input.name.trim();
    const description = input.description.trim();
    const owner_id = input.owner_id.trim();
    const content_ref = input.content_ref.trim();
    if (!name || !description || !owner_id || !content_ref) throw new Error('asset name, description, owner_id, and content_ref are required');
    const asset_id = input.asset_id?.trim() || `asset:${type}:${hash_canonical([project_id, type, name, content_ref]).slice(0, 24)}`;
    const prior = await get_memory_asset(manager, project_id, asset_id);
    const status = required_enum(input.status ?? prior?.status ?? 'draft', asset_statuses, 'asset status');
    if (prior && !transitions[prior.status].has(status)) throw new Error(`invalid asset status transition: ${prior.status} -> ${status}`);
    const at = input.at ?? Date.now();
    if (!Number.isFinite(at)) throw new Error('asset timestamp must be finite');
    const expires_at = input.expires_at === undefined ? prior?.expires_at ?? null : input.expires_at;
    if (expires_at !== null && (!Number.isFinite(expires_at) || expires_at <= at)) throw new Error('asset expires_at must be after its update time');
    const asset: Omit<memory_asset, 'node_id'> = {
        asset_id, project_id, type, name, description, owner_id, source_type: input.source_type.trim() || prior?.source_type || 'asset_registry',
        source_ref: input.source_ref === undefined ? prior?.source_ref ?? null : input.source_ref,
        content_ref, version: (prior?.version ?? 0) + 1, status,
        visibility: required_enum(input.visibility ?? prior?.visibility ?? 'private', visibilities, 'asset visibility'), team_ids: clean_strings(input.team_ids ?? prior?.team_ids),
        acl: normalize_acl(input.acl ?? prior?.acl), bindings: normalize_bindings(input.bindings ?? prior?.bindings),
        confidence: clamp(input.confidence ?? prior?.confidence ?? 0.5, 'asset confidence'), expires_at,
        labels: clean_strings(input.labels ?? prior?.labels), payload: input.payload ?? prior?.payload ?? {}, metadata: input.metadata ?? prior?.metadata ?? {},
        created_at: prior?.created_at ?? at, updated_at: at,
    };
    await manager.ingestProjectEvent(project_id, {
        kind: 'asset', topic: asset_id, text: `${type}: ${name}\n\n${description}`, at, subjective: true, replace_current: true,
        source_type: 'asset_registry', source_id: asset.source_type, owner: owner_id,
        metadata: {
            asset_id, asset_type: type, asset_name: name, asset_description: description, asset_owner_id: owner_id,
            asset_source_type: asset.source_type, asset_source_ref: asset.source_ref, asset_content_ref: content_ref,
            asset_version: asset.version, asset_status: status, asset_visibility: asset.visibility, asset_team_ids: asset.team_ids,
            asset_acl: asset.acl, asset_bindings: asset.bindings, asset_confidence: asset.confidence, asset_expires_at: expires_at,
            asset_labels: asset.labels, asset_payload: asset.payload, asset_metadata: asset.metadata, asset_created_at: asset.created_at,
        },
    });
    const created = await get_memory_asset(manager, project_id, asset_id);
    if (!created || created.version !== asset.version) throw new Error(`asset ${asset_id} was not persisted`);
    return created;
}

export const govern_memory_asset = async (
    manager: project_memory,
    project_id: string,
    asset_id: string,
    patch: Partial<Pick<memory_asset_input, 'status' | 'visibility' | 'team_ids' | 'acl' | 'bindings' | 'confidence' | 'expires_at' | 'labels' | 'metadata' | 'description'>> & { at?: number },
): Promise<memory_asset> => {
    const asset = await get_memory_asset(manager, project_id, asset_id);
    if (!asset) throw new Error(`asset ${asset_id} was not found in project ${project_id}`);
    return register_memory_asset(manager, project_id, {
        ...asset, ...patch, asset_id, source_ref: asset.source_ref, owner_id: asset.owner_id,
    });
};

const subject_match = (acl: memory_asset_acl, context: memory_asset_access): boolean => {
    if (acl.subject_type === 'user') return acl.subject_id === context.user_id;
    if (acl.subject_type === 'team') return context.team_ids?.includes(acl.subject_id) ?? false;
    if (acl.subject_type === 'role') return context.roles?.includes(acl.subject_id) ?? false;
    if (acl.subject_type === 'agent') return acl.subject_id === context.agent_id;
    if (acl.subject_type === 'task') return acl.subject_id === context.task_id;
    return acl.subject_id.toLocaleLowerCase() === context.framework?.toLocaleLowerCase();
};

const binding_match = (binding: memory_asset_binding, context: memory_asset_access): boolean => binding.enabled && (
    binding.target_type === 'agent' ? binding.target_id === context.agent_id
        : binding.target_type === 'task' ? binding.target_id === context.task_id
            : binding.target_id.toLocaleLowerCase() === context.framework?.toLocaleLowerCase()
);

export function decide_memory_asset_access(asset: memory_asset, context: memory_asset_access, permission: memory_asset_permission): memory_asset_decision {
    const matched = asset.acl.filter((acl) => acl.permissions.includes(permission) && subject_match(acl, context));
    const denied = matched.find((acl) => acl.effect === 'deny');
    if (denied) return { allowed: false, permission, reason: `denied by ${denied.subject_type}:${denied.subject_id}`, matched_acl: denied };
    if (context.user_id && context.user_id === asset.owner_id) return { allowed: true, permission, reason: 'asset owner', matched_acl: null };
    const allowed = matched.find((acl) => acl.effect === 'allow');
    if (allowed) return { allowed: true, permission, reason: `allowed by ${allowed.subject_type}:${allowed.subject_id}`, matched_acl: allowed };
    if (!['read', 'use'].includes(permission)) return { allowed: false, permission, reason: `${permission} requires owner or explicit ACL`, matched_acl: null };
    if (asset.visibility === 'project') return { allowed: true, permission, reason: 'project visibility', matched_acl: null };
    if (asset.visibility === 'team' && asset.team_ids.some((team_id) => context.team_ids?.includes(team_id))) return { allowed: true, permission, reason: 'team visibility', matched_acl: null };
    if (asset.visibility === 'agent' && asset.bindings.some((binding) => binding.target_type === 'agent' && binding_match(binding, context))) return { allowed: true, permission, reason: 'agent binding', matched_acl: null };
    if (asset.visibility === 'task' && asset.bindings.some((binding) => binding.target_type === 'task' && binding_match(binding, context))) return { allowed: true, permission, reason: 'task binding', matched_acl: null };
    return { allowed: false, permission, reason: `${asset.visibility} visibility did not grant access`, matched_acl: null };
}

const tokenize = (value: string): Set<string> => new Set(value.toLocaleLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? []);
const context_for = (asset: memory_asset, binding: memory_asset_binding | null): Record<string, unknown> => {
    const mode = binding?.injection_mode ?? 'reference';
    const base = { asset_id: asset.asset_id, type: asset.type, name: asset.name, description: asset.description, content_ref: asset.content_ref, version: asset.version };
    if (mode === 'direct') return { ...base, mode, payload: asset.payload };
    if (mode === 'summary') return { ...base, mode, summary: asset.payload.summary ?? asset.description };
    if (mode === 'tool') return { ...base, mode, instruction: 'Discover and call the referenced OpenMemory tool only when needed.' };
    return { ...base, mode };
};

export async function resolve_memory_asset_loadout(manager: project_memory, project_id: string, input: memory_asset_loadout_input): Promise<memory_asset_loadout> {
    const token_budget = input.token_budget ?? 2_048;
    if (!Number.isInteger(token_budget) || token_budget < 64 || token_budget > 32_768) throw new Error('asset loadout token_budget must be an integer between 64 and 32768');
    const now = input.now ?? Date.now();
    const query_tokens = tokenize(input.query);
    const excluded: memory_asset_loadout['excluded'] = [];
    const candidates: memory_asset_loadout_item[] = [];
    for (const asset of await list_memory_assets(manager, project_id, true)) {
        if (input.asset_types?.length && !input.asset_types.includes(asset.type)) { excluded.push({ asset_id: asset.asset_id, reason: 'asset type not requested' }); continue; }
        if (asset.status !== 'approved') { excluded.push({ asset_id: asset.asset_id, reason: `asset status is ${asset.status}` }); continue; }
        if (asset.expires_at !== null && asset.expires_at <= now) { excluded.push({ asset_id: asset.asset_id, reason: 'asset expired' }); continue; }
        const access = decide_memory_asset_access(asset, input, 'use');
        if (!access.allowed) { excluded.push({ asset_id: asset.asset_id, reason: access.reason }); continue; }
        const matching = asset.bindings.filter((binding) => binding_match(binding, input)).sort((left, right) => Number(right.required) - Number(left.required) || right.priority - left.priority);
        const binding = matching[0] ?? null;
        const asset_tokens = tokenize(`${asset.name} ${asset.description} ${asset.labels.join(' ')}`);
        const overlap = [...asset_tokens].filter((token) => query_tokens.has(token)).length / Math.max(1, query_tokens.size);
        if (!binding && asset.bindings.some((candidate) => candidate.enabled)) { excluded.push({ asset_id: asset.asset_id, reason: 'asset is bound to a different target' }); continue; }
        if (!binding && !input.include_unbound) { excluded.push({ asset_id: asset.asset_id, reason: 'asset is not bound to this target' }); continue; }
        if (!binding && overlap === 0) { excluded.push({ asset_id: asset.asset_id, reason: 'unbound asset is not relevant to the query' }); continue; }
        const context = context_for(asset, binding);
        const estimated_tokens = count_tokens(JSON.stringify(context));
        const priority = binding?.priority ?? 0.25;
        candidates.push({
            asset, binding, score: priority + overlap + (binding?.required ? 1 : 0) + asset.confidence * 0.25,
            estimated_tokens, context,
            annotations: { audience: ['assistant'], priority, last_modified: new Date(asset.updated_at).toISOString() },
        });
    }
    candidates.sort((left, right) => Number(right.binding?.required) - Number(left.binding?.required) || right.score - left.score || left.asset.asset_id.localeCompare(right.asset.asset_id));
    const selected: memory_asset_loadout_item[] = [];
    let tokens_used = 0;
    for (const item of candidates) {
        if (tokens_used + item.estimated_tokens > token_budget) { excluded.push({ asset_id: item.asset.asset_id, reason: 'token budget exceeded' }); continue; }
        selected.push(item);
        tokens_used += item.estimated_tokens;
    }
    return { project_id, query: input.query, selected, excluded, tokens_used, token_budget, within_budget: tokens_used <= token_budget };
}