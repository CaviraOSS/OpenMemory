import { q } from '../../core/db'
import {
    calculateDynamicSalienceWithTimeDecay,
    calculateCrossSectorResonanceScore,
    retrieveMemoriesWithEnergyThresholding,
    applyRetrievalTraceReinforcementToMemory,
    propagateAssociativeReinforcementToLinkedNodes,
    performSpreadingActivationRetrieval,
    buildAssociativeWaypointGraphFromMemories,
    calculateAssociativeWaypointLinkWeight,
    ALPHA_LEARNING_RATE_FOR_RECALL_REINFORCEMENT,
    BETA_LEARNING_RATE_FOR_EMOTIONAL_FREQUENCY,
    GAMMA_ATTENUATION_CONSTANT_FOR_GRAPH_DISTANCE,
    THETA_CONSOLIDATION_COEFFICIENT_FOR_LONG_TERM,
    ETA_REINFORCEMENT_FACTOR_FOR_TRACE_LEARNING,
    LAMBDA_ONE_FAST_DECAY_RATE,
    LAMBDA_TWO_SLOW_DECAY_RATE,
    TAU_ENERGY_THRESHOLD_FOR_RETRIEVAL,
    SECTORAL_INTERDEPENDENCE_MATRIX_FOR_COGNITIVE_RESONANCE
} from '../../ops/dynamics'

export function dynroutes(app: any) {
    app.get('/dynamics/constants', async (incoming_http_request: any, outgoing_http_response: any) => {
        try {
            const advanced_memory_dynamics_configuration_constants = {
                alpha_learning_rate_for_recall_reinforcement_value: ALPHA_LEARNING_RATE_FOR_RECALL_REINFORCEMENT,
                beta_learning_rate_for_emotional_frequency_value: BETA_LEARNING_RATE_FOR_EMOTIONAL_FREQUENCY,
                gamma_attenuation_constant_for_graph_distance_value: GAMMA_ATTENUATION_CONSTANT_FOR_GRAPH_DISTANCE,
                theta_consolidation_coefficient_for_long_term_memory: THETA_CONSOLIDATION_COEFFICIENT_FOR_LONG_TERM,
                eta_reinforcement_factor_for_trace_learning_value: ETA_REINFORCEMENT_FACTOR_FOR_TRACE_LEARNING,
                lambda_one_fast_decay_rate_for_short_term: LAMBDA_ONE_FAST_DECAY_RATE,
                lambda_two_slow_decay_rate_for_consolidation: LAMBDA_TWO_SLOW_DECAY_RATE,
                tau_energy_threshold_for_retrieval_cutoff: TAU_ENERGY_THRESHOLD_FOR_RETRIEVAL,
                sectoral_interdependence_matrix_for_cross_sector_resonance: SECTORAL_INTERDEPENDENCE_MATRIX_FOR_COGNITIVE_RESONANCE
            }
            outgoing_http_response.json({
                success_status_indicator: true,
                dynamics_constants_configuration: advanced_memory_dynamics_configuration_constants
            })
        } catch (unexpected_error_during_constants_retrieval) {
            console.error('Error retrieving dynamics constants:', unexpected_error_during_constants_retrieval)
            outgoing_http_response.status(500).json({ err: 'internal' })
        }
    })

    app.post('/dynamics/salience/calculate', async (incoming_http_request: any, outgoing_http_response: any) => {
        try {
            const incoming_request_body_payload = incoming_http_request.body
            const initial_salience_value_from_request = incoming_request_body_payload.initial_salience || 0.5
            const lambda_decay_constant_from_request = incoming_request_body_payload.decay_lambda || 0.01
            const recall_reinforcement_count_from_request = incoming_request_body_payload.recall_count || 0
            const emotional_frequency_metric_from_request = incoming_request_body_payload.emotional_frequency || 0
            const time_elapsed_in_days_from_request = incoming_request_body_payload.time_elapsed_days || 0

            const calculated_dynamic_salience_result = await calculateDynamicSalienceWithTimeDecay(
                initial_salience_value_from_request,
                lambda_decay_constant_from_request,
                recall_reinforcement_count_from_request,
                emotional_frequency_metric_from_request,
                time_elapsed_in_days_from_request
            )

            outgoing_http_response.json({
                success_status_indicator: true,
                calculated_salience_value: calculated_dynamic_salience_result,
                input_parameters_used: {
                    initial_salience: initial_salience_value_from_request,
                    decay_lambda: lambda_decay_constant_from_request,
                    recall_count: recall_reinforcement_count_from_request,
                    emotional_frequency: emotional_frequency_metric_from_request,
                    time_elapsed_days: time_elapsed_in_days_from_request
                }
            })
        } catch (unexpected_error_during_salience_calculation) {
            console.error('Error calculating dynamic salience:', unexpected_error_during_salience_calculation)
            outgoing_http_response.status(500).json({ err: 'internal' })
        }
    })

    app.post('/dynamics/resonance/calculate', async (incoming_http_request: any, outgoing_http_response: any) => {
        try {
            const incoming_request_body_payload = incoming_http_request.body
            const memory_sector_type_from_request = incoming_request_body_payload.memory_sector || 'semantic'
            const query_sector_type_from_request = incoming_request_body_payload.query_sector || 'semantic'
            const base_cosine_similarity_from_request = incoming_request_body_payload.base_similarity || 0.8

            const calculated_cross_sector_resonance_score = await calculateCrossSectorResonanceScore(
                memory_sector_type_from_request,
                query_sector_type_from_request,
                base_cosine_similarity_from_request
            )

            outgoing_http_response.json({
                success_status_indicator: true,
                resonance_modulated_score: calculated_cross_sector_resonance_score,
                input_parameters_used: {
                    memory_sector: memory_sector_type_from_request,
                    query_sector: query_sector_type_from_request,
                    base_similarity: base_cosine_similarity_from_request
                }
            })
        } catch (unexpected_error_during_resonance_calculation) {
            console.error('Error calculating cross-sector resonance:', unexpected_error_during_resonance_calculation)
            outgoing_http_response.status(500).json({ err: 'internal' })
        }
    })

    app.post('/dynamics/retrieval/energy-based', async (incoming_http_request: any, outgoing_http_response: any) => {
        try {
            const incoming_request_body_payload = incoming_http_request.body
            const query_text_content_from_request = incoming_request_body_payload.query
            const query_sector_type_from_request = incoming_request_body_payload.sector || 'semantic'
            const minimum_energy_threshold_from_request = incoming_request_body_payload.min_energy || TAU_ENERGY_THRESHOLD_FOR_RETRIEVAL

            if (!query_text_content_from_request) {
                return outgoing_http_response.status(400).json({ err: 'query_required' })
            }

            const { embedForSector } = await import('../../memory/embed')
            const query_vector_embedding_array = await embedForSector(
                query_text_content_from_request,
                query_sector_type_from_request
            )

            const retrieved_memories_with_energy_scores = await retrieveMemoriesWithEnergyThresholding(
                query_vector_embedding_array,
                query_sector_type_from_request,
                minimum_energy_threshold_from_request
            )

            outgoing_http_response.json({
                success_status_indicator: true,
                query_text: query_text_content_from_request,
                query_sector: query_sector_type_from_request,
                minimum_energy_threshold: minimum_energy_threshold_from_request,
                retrieved_memories_count: retrieved_memories_with_energy_scores.length,
                memories_with_activation_energy: retrieved_memories_with_energy_scores.map(memory_record => ({
                    memory_id: memory_record.id,
                    memory_content: memory_record.content,
                    primary_sector_classification: memory_record.primary_sector,
                    salience_score: memory_record.salience,
                    activation_energy_level: memory_record.activation_energy
                }))
            })
        } catch (unexpected_error_during_energy_retrieval) {
            console.error('Error performing energy-based retrieval:', unexpected_error_during_energy_retrieval)
            outgoing_http_response.status(500).json({ err: 'internal' })
        }
    })

    app.post('/dynamics/reinforcement/trace', async (incoming_http_request: any, outgoing_http_response: any) => {
        try {
            const incoming_request_body_payload = incoming_http_request.body
            const target_memory_id_from_request = incoming_request_body_payload.memory_id

            if (!target_memory_id_from_request) {
                return outgoing_http_response.status(400).json({ err: 'memory_id_required' })
            }

            const memory_record_from_database = await q.get_mem.get(target_memory_id_from_request)
            if (!memory_record_from_database) {
                return outgoing_http_response.status(404).json({ err: 'memory_not_found' })
            }

            const current_salience_before_reinforcement = memory_record_from_database.salience
            const updated_salience_after_reinforcement = await applyRetrievalTraceReinforcementToMemory(
                target_memory_id_from_request,
                current_salience_before_reinforcement
            )

            await q.upd_seen.run(
                target_memory_id_from_request,
                Date.now(),
                updated_salience_after_reinforcement,
                Date.now()
            )

            const connected_waypoints_from_database = await q.get_waypoints_by_src.all(target_memory_id_from_request)
            const linked_nodes_with_weights_array = connected_waypoints_from_database.map((waypoint_record: any) => ({
                target_id: waypoint_record.dst_id,
                weight: waypoint_record.weight
            }))

            const propagated_reinforcement_updates_list = await propagateAssociativeReinforcementToLinkedNodes(
                target_memory_id_from_request,
                updated_salience_after_reinforcement,
                linked_nodes_with_weights_array
            )

            for (const reinforcement_update_record of propagated_reinforcement_updates_list) {
                await q.upd_seen.run(
                    reinforcement_update_record.node_id,
                    Date.now(),
                    reinforcement_update_record.new_salience,
                    Date.now()
                )
            }

            outgoing_http_response.json({
                success_status_indicator: true,
                reinforced_memory_id: target_memory_id_from_request,
                previous_salience_value: current_salience_before_reinforcement,
                updated_salience_value: updated_salience_after_reinforcement,
                salience_increase_amount: updated_salience_after_reinforcement - current_salience_before_reinforcement,
                linked_nodes_reinforced_count: propagated_reinforcement_updates_list.length,
                linked_nodes_updates: propagated_reinforcement_updates_list
            })
        } catch (unexpected_error_during_trace_reinforcement) {
            console.error('Error applying trace reinforcement:', unexpected_error_during_trace_reinforcement)
            outgoing_http_response.status(500).json({ err: 'internal' })
        }
    })

    app.post('/dynamics/activation/spreading', async (incoming_http_request: any, outgoing_http_response: any) => {
        try {
            const incoming_request_body_payload = incoming_http_request.body
            const initial_memory_ids_array_from_request = incoming_request_body_payload.initial_memory_ids || []
            const maximum_spreading_iterations_from_request = incoming_request_body_payload.max_iterations || 3

            if (!Array.isArray(initial_memory_ids_array_from_request) || initial_memory_ids_array_from_request.length === 0) {
                return outgoing_http_response.status(400).json({ err: 'initial_memory_ids_required' })
            }

            const spreading_activation_results_map = await performSpreadingActivationRetrieval(
                initial_memory_ids_array_from_request,
                maximum_spreading_iterations_from_request
            )

            const activation_results_as_array = Array.from(spreading_activation_results_map.entries()).map(
                ([memory_node_id, activation_energy_level]) => ({
                    memory_id: memory_node_id,
                    activation_level: activation_energy_level
                })
            ).sort((first_entry, second_entry) => second_entry.activation_level - first_entry.activation_level)

            outgoing_http_response.json({
                success_status_indicator: true,
                initial_activated_memories_count: initial_memory_ids_array_from_request.length,
                maximum_iterations_performed: maximum_spreading_iterations_from_request,
                total_activated_nodes_count: activation_results_as_array.length,
                spreading_activation_results: activation_results_as_array
            })
        } catch (unexpected_error_during_spreading_activation) {
            console.error('Error performing spreading activation:', unexpected_error_during_spreading_activation)
            outgoing_http_response.status(500).json({ err: 'internal' })
        }
    })

    app.get('/dynamics/waypoints/graph', async (incoming_http_request: any, outgoing_http_response: any) => {
        try {
            const waypoint_graph_structure_from_database = await buildAssociativeWaypointGraphFromMemories()

            const graph_statistics_summary = {
                total_nodes_in_graph: waypoint_graph_structure_from_database.size,
                total_edges_across_all_nodes: 0,
                average_edges_per_node: 0,
                nodes_with_no_connections: 0
            }

            const detailed_graph_nodes_array: any[] = []

            for (const [memory_node_identifier, node_data_structure] of waypoint_graph_structure_from_database) {
                const number_of_outgoing_edges = node_data_structure.connected_waypoint_edges.length
                graph_statistics_summary.total_edges_across_all_nodes += number_of_outgoing_edges

                if (number_of_outgoing_edges === 0) {
                    graph_statistics_summary.nodes_with_no_connections++
                }

                detailed_graph_nodes_array.push({
                    node_memory_id: memory_node_identifier,
                    outgoing_edges_count: number_of_outgoing_edges,
                    connected_targets: node_data_structure.connected_waypoint_edges.map(edge_record => ({
                        target_memory_id: edge_record.target_node_id,
                        link_weight: edge_record.link_weight_value,
                        time_gap_milliseconds: edge_record.time_gap_delta_t
                    }))
                })
            }

            if (graph_statistics_summary.total_nodes_in_graph > 0) {
                graph_statistics_summary.average_edges_per_node =
                    graph_statistics_summary.total_edges_across_all_nodes / graph_statistics_summary.total_nodes_in_graph
            }

            outgoing_http_response.json({
                success_status_indicator: true,
                graph_summary_statistics: graph_statistics_summary,
                detailed_node_information: detailed_graph_nodes_array
            })
        } catch (unexpected_error_building_waypoint_graph) {
            console.error('Error building waypoint graph:', unexpected_error_building_waypoint_graph)
            outgoing_http_response.status(500).json({ err: 'internal' })
        }
    })

    app.post('/dynamics/waypoints/calculate-weight', async (incoming_http_request: any, outgoing_http_response: any) => {
        try {
            const incoming_request_body_payload = incoming_http_request.body
            const source_memory_id_from_request = incoming_request_body_payload.source_memory_id
            const target_memory_id_from_request = incoming_request_body_payload.target_memory_id

            if (!source_memory_id_from_request || !target_memory_id_from_request) {
                return outgoing_http_response.status(400).json({ err: 'both_memory_ids_required' })
            }

            const source_memory_record = await q.get_mem.get(source_memory_id_from_request)
            const target_memory_record = await q.get_mem.get(target_memory_id_from_request)

            if (!source_memory_record || !target_memory_record) {
                return outgoing_http_response.status(404).json({ err: 'one_or_both_memories_not_found' })
            }

            const source_memory_mean_vector = source_memory_record.mean_vec
            const target_memory_mean_vector = target_memory_record.mean_vec

            if (!source_memory_mean_vector || !target_memory_mean_vector) {
                return outgoing_http_response.status(400).json({ err: 'memories_missing_embeddings' })
            }

            const { bufferToVector } = await import('../../memory/embed')
            const source_vector_array = bufferToVector(source_memory_mean_vector)
            const target_vector_array = bufferToVector(target_memory_mean_vector)

            const time_gap_between_memories_milliseconds = Math.abs(
                source_memory_record.created_at - target_memory_record.created_at
            )

            const calculated_waypoint_link_weight = await calculateAssociativeWaypointLinkWeight(
                source_vector_array,
                target_vector_array,
                time_gap_between_memories_milliseconds
            )

            outgoing_http_response.json({
                success_status_indicator: true,
                source_memory_identifier: source_memory_id_from_request,
                target_memory_identifier: target_memory_id_from_request,
                calculated_link_weight_value: calculated_waypoint_link_weight,
                time_gap_in_days: time_gap_between_memories_milliseconds / 86400000,
                calculation_details: {
                    temporal_decay_factor_applied: true,
                    cosine_similarity_computed: true
                }
            })
        } catch (unexpected_error_calculating_waypoint_weight) {
            console.error('Error calculating waypoint weight:', unexpected_error_calculating_waypoint_weight)
            outgoing_http_response.status(500).json({ err: 'internal' })
        }
    })
}
