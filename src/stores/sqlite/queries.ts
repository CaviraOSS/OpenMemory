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
 *  file  : src/stores/sqlite/queries.ts
 *  usage : implements the LongMemory queries component
 */


export const queries = {
    load_node: `SELECT node_id, node_json, content_hash FROM hydro_nodes
        WHERE tenant_id = ? AND user_id = ? AND node_id = ?`,
    load_edge: `SELECT edge_json FROM hydro_edges
        WHERE tenant_id = ? AND user_id = ? AND edge_id = ?`,
    current_truth: `SELECT node_id, node_json, content_hash FROM hydro_nodes
        WHERE tenant_id = @tenant_id AND user_id = @user_id
          AND valid_from <= @at AND (valid_to IS NULL OR valid_to > @at)
          AND (superseded_at IS NULL OR superseded_at > @at)
          AND status = 'active'
          AND (@world_id IS NULL OR world_id = @world_id)
        ORDER BY recorded_at DESC LIMIT @limit`,
    historical_truth: `SELECT node_id, node_json, content_hash FROM hydro_nodes
        WHERE tenant_id = @tenant_id AND user_id = @user_id
          AND valid_from <= @at AND (valid_to IS NULL OR valid_to > @at)
          AND (@world_id IS NULL OR world_id = @world_id)
        ORDER BY valid_from DESC, recorded_at DESC LIMIT @limit`,
    strict_candidates: `SELECT n.node_id, n.node_json, n.content_hash FROM hydro_nodes n
        WHERE n.tenant_id = @tenant_id AND n.user_id = @user_id
          AND n.valid_from <= @at AND (n.valid_to IS NULL OR n.valid_to > @at)
          AND (n.superseded_at IS NULL OR n.superseded_at > @at)
          AND n.status = 'active' AND n.use_for_reasoning = 1
          AND n.confidence >= @min_confidence
          AND (
              json_extract(n.node_json, '$.contract.max_valid_duration') IS NULL
              OR n.valid_from + json_extract(n.node_json, '$.contract.max_valid_duration') > @at
          )
          AND (n.requires_grounding = 0 OR n.grounding_score >= @grounding_threshold)
          AND (
              n.source_required = 0
              OR n.grounding_ref IS NOT NULL
              OR json_array_length(json_extract(n.node_json, '$.provenance.source_trace')) > 0
          )
          AND (@world_id IS NULL OR n.world_id = @world_id)
          AND NOT EXISTS (
              SELECT 1 FROM contradictions c
              WHERE c.tenant_id = n.tenant_id AND c.user_id = n.user_id
                AND c.resolved = 0 AND (c.node_a = n.node_id OR c.node_b = n.node_id)
          )
        ORDER BY n.confidence DESC, n.grounding_score DESC, n.recorded_at DESC
        LIMIT @limit`,
    aliases_for_entity: `SELECT alias FROM entity_aliases
        WHERE tenant_id = ? AND user_id = ? AND entity_id = ? ORDER BY normalized_alias`,
    canonical_alias: `SELECT entity_id FROM entity_aliases
        WHERE tenant_id = ? AND user_id = ? AND normalized_alias = ?`,
} as const;

export type NodeQueryOptions = {
    at: number;
    world_id?: string;
    limit?: number;
};

export type StrictQueryOptions = NodeQueryOptions & {
    min_confidence?: number;
    grounding_threshold?: number;
};