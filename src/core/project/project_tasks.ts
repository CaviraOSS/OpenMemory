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
 *  file  : src/core/project/project_tasks.ts
 *  usage : implements the LongMemory project tasks component
 */

import type { long_memory } from '../create_memory.js';
import type { project_state } from './project_state.js';

export type project_task = {
    memory_id: string;
    task: string;
    status: string;
    priority: string | null;
    owner: string | null;
    issue_url: string | null;
    updated_at: number;
};

export async function get_project_tasks(memory: long_memory, state: project_state): Promise<project_task[]> {
    const explanations = await Promise.all([...state.task_nodes].map((id) => memory.explain(id)));
    return explanations.flatMap((item) => item.node ? [{
        memory_id: item.node.id,
        task: item.node.content.raw,
        status: String(item.node.metadata.status ?? (item.node.state.status === 'active' ? 'open' : item.node.state.status)),
        priority: typeof item.node.metadata.priority === 'string' ? item.node.metadata.priority : null,
        owner: typeof item.node.metadata.owner === 'string' ? item.node.metadata.owner : null,
        issue_url: typeof item.node.metadata.url === 'string' ? item.node.metadata.url : null,
        updated_at: item.node.temporal.recorded_at,
    }] : []);
}