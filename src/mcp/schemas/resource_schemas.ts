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
 *  file  : src/mcp/schemas/resource_schemas.ts
 *  usage : implements the LongMemory resource schemas component
 */

import * as z from 'zod/v4';

export const project_resource_schema = z.object({ project_id: z.string().trim().min(1) });
export const entity_resource_schema = z.object({ entity_id: z.string().trim().min(1) });
export const world_resource_schema = z.object({ world_id: z.string().trim().min(1) });
export const memory_resource_schema = z.object({ node_id: z.string().trim().min(1) });