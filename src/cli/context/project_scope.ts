import type { open_memory } from '../../core/create_memory.js';
import type { World } from '../../core/types/world.js';
import { cli_error, exit_codes } from '../output/errors.js';

export type cli_project_scope = {
    root: World | null;
    world_ids: Set<string>;
    initialized: boolean;
    legacy: boolean;
};

export async function resolve_project_scope(memory: open_memory, project_id: string): Promise<cli_project_scope> {
    const worlds = await memory.listWorlds();
    const projects = worlds.filter((world) => world.metadata.hierarchy === 'project');
    const root = projects.find((world) => world.metadata.project_id === project_id) ?? null;
    if (!root) {
        if (!projects.length) return { root: null, world_ids: new Set(), initialized: false, legacy: true };
        throw new cli_error('project_not_found', `Project is not initialized: ${project_id}`, exit_codes.validation, { project_id }, 'openmemory project init', 'Initialize the project or select an existing project ID.');
    }
    const children = new Map<string, World[]>();
    for (const world of worlds) {
        if (!world.parent_world_id) continue;
        const values = children.get(world.parent_world_id) ?? [];
        values.push(world);
        children.set(world.parent_world_id, values);
    }
    const world_ids = new Set<string>();
    const stack = [root];
    while (stack.length) {
        const world = stack.pop() as World;
        if (world_ids.has(world.id)) continue;
        world_ids.add(world.id);
        stack.push(...(children.get(world.id) ?? []));
    }
    return { root, world_ids, initialized: true, legacy: false };
}

export const project_world = async (memory: open_memory, project_id: string, hierarchy = 'agent_sessions'): Promise<World | null> => {
    const scope = await resolve_project_scope(memory, project_id);
    if (!scope.root) return null;
    const worlds = await memory.listWorlds();
    return worlds.find((world) => world.metadata.project_id === project_id && world.metadata.hierarchy === hierarchy) ?? scope.root;
};