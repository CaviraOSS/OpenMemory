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
 *  file  : src/core/project/project_tasks.ts
 *  usage : project task memory views
 */

import type { open_memory } from '../create_memory.js';
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

export async function get_project_tasks(memory: open_memory, state: project_state): Promise<project_task[]> {
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