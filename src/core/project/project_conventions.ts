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
 *  file  : src/core/project/project_conventions.ts
 *  usage : implements the LongMemory project conventions component
 */


import type { long_memory } from '../create_memory.js';
import type { project_state } from './project_state.js';

export type project_convention = { memory_id: string; convention: string; source: string | null; current: boolean };

export async function get_project_conventions(memory: long_memory, state: project_state): Promise<project_convention[]> {
    const explanations = await Promise.all([...state.convention_nodes].map((id) => memory.explain(id)));
    return explanations.flatMap((item) => item.node ? [{
        memory_id: item.node.id,
        convention: item.node.content.raw,
        source: item.node.provenance.source_trace[0]?.ref ?? null,
        current: item.node.state.status === 'active' && item.node.temporal.superseded_at === null,
    }] : []);
}