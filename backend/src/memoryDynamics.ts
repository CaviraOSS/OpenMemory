import { allAsync, runAsync, getAsync, q } from './utils/database'
import { now } from './utils'
import { cosineSimilarity } from './embedding'

export const ALPHA_LEARNING_RATE_FOR_RECALL_REINFORCEMENT = 0.15
export const BETA_LEARNING_RATE_FOR_EMOTIONAL_FREQUENCY = 0.20
export const GAMMA_ATTENUATION_CONSTANT_FOR_GRAPH_DISTANCE = 0.35
export const THETA_CONSOLIDATION_COEFFICIENT_FOR_LONG_TERM = 0.25
export const ETA_REINFORCEMENT_FACTOR_FOR_TRACE_LEARNING = 0.18
export const LAMBDA_ONE_FAST_DECAY_RATE = 0.030
export const LAMBDA_TWO_SLOW_DECAY_RATE = 0.003
export const TAU_ENERGY_THRESHOLD_FOR_RETRIEVAL = 0.40

export const SECTORAL_INTERDEPENDENCE_MATRIX_FOR_COGNITIVE_RESONANCE = [
    [1.0, 0.7, 0.3, 0.5, 0.6],
    [0.7, 1.0, 0.4, 0.6, 0.8],
    [0.3, 0.4, 1.0, 0.5, 0.2],
    [0.5, 0.6, 0.5, 1.0, 0.7],
    [0.6, 0.8, 0.2, 0.7, 1.0]
]

export const SECTOR_INDEX_MAPPING_FOR_MATRIX_LOOKUP = {
    'episodic': 0,
    'semantic': 1,
    'procedural': 2,
    'emotional': 3,
    'reflective': 4
}

export interface DynamicSalienceWeightingParameters {
    initial_salience_value: number
    decay_constant_lambda: number
    recall_reinforcement_count: number
    emotional_frequency_metric: number
}

export interface AssociativeWaypointGraphNode {
    node_memory_id: string
    activation_energy_level: number
    connected_waypoint_edges: Array<{
        target_node_id: string
        link_weight_value: number
        time_gap_delta_t: number
    }>
}

export async function calculateDynamicSalienceWithTimeDecay(
    initial_salience_at_creation: number,
    lambda_decay_constant_for_sector: number,
    recall_count_reinforcement_metric: number,
    emotional_frequency_composite_score: number,
    time_elapsed_since_creation_in_days: number
): Promise<number> {
    const exponential_decay_component = initial_salience_at_creation * Math.exp(-lambda_decay_constant_for_sector * time_elapsed_since_creation_in_days)

    const recall_reinforcement_component = ALPHA_LEARNING_RATE_FOR_RECALL_REINFORCEMENT * recall_count_reinforcement_metric

    const emotional_frequency_component = BETA_LEARNING_RATE_FOR_EMOTIONAL_FREQUENCY * emotional_frequency_composite_score

    const final_dynamic_salience_score = exponential_decay_component + recall_reinforcement_component + emotional_frequency_component

    return Math.max(0, Math.min(1.0, final_dynamic_salience_score))
}

export async function calculateDualPhaseDecayMemoryRetention(
    time_elapsed_in_days: number
): Promise<number> {
    const fast_initial_decay_phase = Math.exp(-LAMBDA_ONE_FAST_DECAY_RATE * time_elapsed_in_days)

    const slow_consolidation_decay_phase = THETA_CONSOLIDATION_COEFFICIENT_FOR_LONG_TERM * Math.exp(-LAMBDA_TWO_SLOW_DECAY_RATE * time_elapsed_in_days)

    const combined_memory_retention_value = fast_initial_decay_phase + slow_consolidation_decay_phase

    return Math.max(0, Math.min(1.0, combined_memory_retention_value))
}

export async function calculateAssociativeWaypointLinkWeight(
    source_memory_vector_embedding: number[],
    target_memory_vector_embedding: number[],
    time_gap_between_occurrences_in_milliseconds: number
): Promise<number> {
    const cosine_similarity_between_embeddings = cosineSimilarity(
        source_memory_vector_embedding,
        target_memory_vector_embedding
    )

    const time_gap_in_days = time_gap_between_occurrences_in_milliseconds / 86400000

    const temporal_decay_factor = 1 / (1 + time_gap_in_days)

    const final_waypoint_link_weight = cosine_similarity_between_embeddings * temporal_decay_factor

    return Math.max(0, final_waypoint_link_weight)
}

export async function calculateSpreadingActivationEnergyForNode(
    current_node_memory_id: string,
    activated_neighbor_nodes_map: Map<string, number>,
    waypoint_graph_structure: Map<string, AssociativeWaypointGraphNode>
): Promise<number> {
    const current_node_data = waypoint_graph_structure.get(current_node_memory_id)

    if (!current_node_data) {
        return 0
    }

    let total_accumulated_activation_energy = 0

    for (const edge_connection of current_node_data.connected_waypoint_edges) {
        const neighbor_node_activation = activated_neighbor_nodes_map.get(edge_connection.target_node_id) || 0

        const graph_distance_to_neighbor = 1

        const distance_attenuation_factor = Math.exp(-GAMMA_ATTENUATION_CONSTANT_FOR_GRAPH_DISTANCE * graph_distance_to_neighbor)

        const weighted_contribution = edge_connection.link_weight_value * neighbor_node_activation * distance_attenuation_factor

        total_accumulated_activation_energy += weighted_contribution
    }

    return total_accumulated_activation_energy
}

export async function applyRetrievalTraceReinforcementToMemory(
    memory_id_to_reinforce: string,
    current_salience_value: number
): Promise<number> {
    const salience_reinforcement_increment = ETA_REINFORCEMENT_FACTOR_FOR_TRACE_LEARNING * (1 - current_salience_value)

    const updated_salience_after_reinforcement = current_salience_value + salience_reinforcement_increment

    return Math.min(1.0, updated_salience_after_reinforcement)
}

export async function propagateAssociativeReinforcementToLinkedNodes(
    source_memory_id: string,
    source_memory_salience: number,
    connected_waypoints: Array<{ target_id: string, weight: number }>
): Promise<Array<{ node_id: string, new_salience: number }>> {
    const reinforcement_updates_for_linked_memories: Array<{ node_id: string, new_salience: number }> = []

    for (const waypoint_connection of connected_waypoints) {
        const linked_memory_data = await getAsync(
            'select salience from memories where id=?',
            [waypoint_connection.target_id]
        ) as any

        if (linked_memory_data) {
            const propagated_reinforcement_amount = ETA_REINFORCEMENT_FACTOR_FOR_TRACE_LEARNING * waypoint_connection.weight * source_memory_salience

            const updated_linked_memory_salience = Math.min(1.0, linked_memory_data.salience + propagated_reinforcement_amount)

            reinforcement_updates_for_linked_memories.push({
                node_id: waypoint_connection.target_id,
                new_salience: updated_linked_memory_salience
            })
        }
    }

    return reinforcement_updates_for_linked_memories
}

export async function calculateCrossSectorResonanceScore(
    memory_sector_type: string,
    query_sector_type: string,
    base_cosine_similarity: number
): Promise<number> {
    const source_sector_matrix_index = (SECTOR_INDEX_MAPPING_FOR_MATRIX_LOOKUP as any)[memory_sector_type] ?? 1
    const target_sector_matrix_index = (SECTOR_INDEX_MAPPING_FOR_MATRIX_LOOKUP as any)[query_sector_type] ?? 1

    const interdependence_weight_from_matrix = SECTORAL_INTERDEPENDENCE_MATRIX_FOR_COGNITIVE_RESONANCE[source_sector_matrix_index][target_sector_matrix_index]

    const resonance_modulated_similarity_score = base_cosine_similarity * interdependence_weight_from_matrix

    return resonance_modulated_similarity_score
} export async function determineEnergyBasedRetrievalThreshold(
    total_network_activation_energy: number,
    base_threshold_tau: number
): Promise<number> {
    const network_activation_normalization_factor = Math.max(0.1, total_network_activation_energy)

    const dynamically_adjusted_threshold = base_threshold_tau * (1 + Math.log(network_activation_normalization_factor + 1))

    return Math.max(0.1, Math.min(0.9, dynamically_adjusted_threshold))
}

export async function applyDualPhaseDecayToAllMemories(): Promise<void> {
    const all_memories_in_database = await allAsync(
        'select id, salience, decay_lambda, last_seen_at, updated_at, created_at from memories'
    )

    const current_timestamp_now = now()

    const memory_decay_update_operations = all_memories_in_database.map(async (memory_row: any) => {
        const time_since_last_access_ms = Math.max(0, current_timestamp_now - (memory_row.last_seen_at || memory_row.updated_at))
        const time_elapsed_in_days = time_since_last_access_ms / 86400000

        const dual_phase_retention_score = await calculateDualPhaseDecayMemoryRetention(time_elapsed_in_days)

        const updated_salience_with_decay = memory_row.salience * dual_phase_retention_score

        await runAsync(
            'update memories set salience=?, updated_at=? where id=?',
            [Math.max(0, updated_salience_with_decay), current_timestamp_now, memory_row.id]
        )
    })

    await Promise.all(memory_decay_update_operations)

    console.log(`Applied dual-phase decay to ${all_memories_in_database.length} memories`)
}

export async function buildAssociativeWaypointGraphFromMemories(): Promise<Map<string, AssociativeWaypointGraphNode>> {
    const waypoint_graph_data_structure = new Map<string, AssociativeWaypointGraphNode>()

    const all_waypoints_from_database = await allAsync(
        'select src_id, dst_id, weight, created_at from waypoints'
    ) as any[]

    const all_memory_ids_set = new Set<string>()
    for (const waypoint_row of all_waypoints_from_database) {
        all_memory_ids_set.add(waypoint_row.src_id)
        all_memory_ids_set.add(waypoint_row.dst_id)
    }

    for (const memory_identifier of all_memory_ids_set) {
        waypoint_graph_data_structure.set(memory_identifier, {
            node_memory_id: memory_identifier,
            activation_energy_level: 0,
            connected_waypoint_edges: []
        })
    }

    for (const waypoint_row of all_waypoints_from_database) {
        const source_node = waypoint_graph_data_structure.get(waypoint_row.src_id)
        if (source_node) {
            const current_time = now()
            const time_gap = Math.abs(current_time - waypoint_row.created_at)

            source_node.connected_waypoint_edges.push({
                target_node_id: waypoint_row.dst_id,
                link_weight_value: waypoint_row.weight,
                time_gap_delta_t: time_gap
            })
        }
    }

    return waypoint_graph_data_structure
}

export async function performSpreadingActivationRetrieval(
    initial_activated_memory_ids: string[],
    max_spreading_iterations: number
): Promise<Map<string, number>> {
    const waypoint_graph_structure = await buildAssociativeWaypointGraphFromMemories()

    const node_activation_levels_map = new Map<string, number>()

    for (const initially_activated_id of initial_activated_memory_ids) {
        node_activation_levels_map.set(initially_activated_id, 1.0)
    }

    for (let iteration_counter = 0; iteration_counter < max_spreading_iterations; iteration_counter++) {
        const activation_updates_for_this_iteration = new Map<string, number>()

        for (const [node_id, current_activation] of node_activation_levels_map) {
            const node_structure = waypoint_graph_structure.get(node_id)
            if (!node_structure) continue

            for (const edge_to_neighbor of node_structure.connected_waypoint_edges) {
                const propagated_activation_energy = await calculateSpreadingActivationEnergyForNode(
                    edge_to_neighbor.target_node_id,
                    node_activation_levels_map,
                    waypoint_graph_structure
                )

                const existing_neighbor_activation = activation_updates_for_this_iteration.get(edge_to_neighbor.target_node_id) || 0
                activation_updates_for_this_iteration.set(
                    edge_to_neighbor.target_node_id,
                    existing_neighbor_activation + propagated_activation_energy
                )
            }
        }

        for (const [updated_node_id, new_activation_value] of activation_updates_for_this_iteration) {
            const current_value = node_activation_levels_map.get(updated_node_id) || 0
            node_activation_levels_map.set(updated_node_id, Math.max(current_value, new_activation_value))
        }
    }

    return node_activation_levels_map
}

export async function retrieveMemoriesWithEnergyThresholding(
    query_vector_embedding: number[],
    query_sector_type: string,
    minimum_activation_energy: number
): Promise<any[]> {
    const all_candidate_memories = await allAsync(
        'select id, content, primary_sector, salience, mean_vec from memories where salience > 0.01'
    ) as any[]

    const memory_activation_scores = new Map<string, number>()

    for (const memory_candidate of all_candidate_memories) {
        if (!memory_candidate.mean_vec) continue

        const memory_vector_buffer = Buffer.isBuffer(memory_candidate.mean_vec)
            ? memory_candidate.mean_vec
            : Buffer.from(memory_candidate.mean_vec)

        const memory_embedding_values: number[] = []
        for (let byte_offset = 0; byte_offset < memory_vector_buffer.length; byte_offset += 4) {
            memory_embedding_values.push(memory_vector_buffer.readFloatLE(byte_offset))
        }

        const base_similarity_score = cosineSimilarity(query_vector_embedding, memory_embedding_values)

        const cross_sector_resonance = await calculateCrossSectorResonanceScore(
            memory_candidate.primary_sector,
            query_sector_type,
            base_similarity_score
        )

        const salience_weighted_score = cross_sector_resonance * memory_candidate.salience

        memory_activation_scores.set(memory_candidate.id, salience_weighted_score)
    }

    const spreading_activation_map = await performSpreadingActivationRetrieval(
        Array.from(memory_activation_scores.keys()).slice(0, 5),
        3
    )

    const combined_energy_scores = new Map<string, number>()
    for (const memory_candidate of all_candidate_memories) {
        const base_score = memory_activation_scores.get(memory_candidate.id) || 0
        const spreading_score = spreading_activation_map.get(memory_candidate.id) || 0
        combined_energy_scores.set(memory_candidate.id, base_score + (spreading_score * 0.3))
    }

    const total_network_energy = Array.from(combined_energy_scores.values()).reduce((sum, val) => sum + val, 0)

    const adaptive_threshold = await determineEnergyBasedRetrievalThreshold(
        total_network_energy,
        minimum_activation_energy
    )

    const retrieved_memories_above_threshold = all_candidate_memories.filter(mem =>
        (combined_energy_scores.get(mem.id) || 0) > adaptive_threshold
    )

    return retrieved_memories_above_threshold.map(mem => ({
        ...mem,
        activation_energy: combined_energy_scores.get(mem.id)
    }))
}

export const apply_decay = applyDualPhaseDecayToAllMemories
