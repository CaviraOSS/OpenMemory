import * as z from 'zod/v4';

export const project_resource_schema = z.object({ project_id: z.string().trim().min(1) });
export const entity_resource_schema = z.object({ entity_id: z.string().trim().min(1) });
export const world_resource_schema = z.object({ world_id: z.string().trim().min(1) });
export const memory_resource_schema = z.object({ node_id: z.string().trim().min(1) });