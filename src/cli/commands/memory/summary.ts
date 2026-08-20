import type { HydroNode } from '../../../core/types/hydro_node.js';

export const memory_summary = (node: HydroNode) => ({
    id: node.id,
    text: node.content.summary || node.content.raw,
    status: node.state.status,
    world_id: node.world.world_id,
    observed_at: node.temporal.observed_at,
    recorded_at: node.temporal.recorded_at,
    confidence: node.state.confidence,
    salience: node.state.salience,
    activation: node.state.activation,
    grounded: Boolean(node.grounding.worlddb_ref),
    source: node.provenance.source_trace[0]?.ref ?? null,
    memory_type: typeof node.metadata.memory_type === 'string' ? node.metadata.memory_type : null,
});