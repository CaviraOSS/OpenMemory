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
 *  file  : src/core/project/project_conventions.ts
 *  usage : project coding and release convention views
 */

import type { open_memory } from '../create_memory.js';
import type { project_state } from './project_state.js';

export type project_convention = { memory_id: string; convention: string; source: string | null; current: boolean };

export async function get_project_conventions(memory: open_memory, state: project_state): Promise<project_convention[]> {
    const explanations = await Promise.all([...state.convention_nodes].map((id) => memory.explain(id)));
    return explanations.flatMap((item) => item.node ? [{
        memory_id: item.node.id,
        convention: item.node.content.raw,
        source: item.node.provenance.source_trace[0]?.ref ?? null,
        current: item.node.state.status === 'active' && item.node.temporal.superseded_at === null,
    }] : []);
}