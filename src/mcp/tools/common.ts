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
 *  file  : src/mcp/tools/common.ts
 *  usage : implements the LongMemory common component
 */


import type { CallToolResult as call_tool_result } from '@modelcontextprotocol/sdk/types.js';
import type { mcp_runtime } from '../runtime.js';
import { assert_tool_allowed } from '../security/permissions.js';
import type { mcp_tool_name } from '../security/tool_allowlist.js';

// Raw embedding vectors are not useful to an MCP client (similarity is already
// exposed via score/breakdown) and can be thousands of tokens per node, repeated
// across every place a node is nested in a response. Hidden by default.
const strip_vectors_replacer = (key: string, value: unknown) => key === 'vectors' ? undefined : value;

const include_vectors_by_default = (env: NodeJS.ProcessEnv = process.env) => {
    const raw = env.LONGMEMORY_MCP_INCLUDE_VECTORS?.trim().toLowerCase();
    return raw === 'true' || raw === '1';
};

export const json_tool_result = (value: unknown, include_vectors = include_vectors_by_default()): call_tool_result => {
    const text = JSON.stringify(value, include_vectors ? undefined : strip_vectors_replacer);
    // No tool declares an outputSchema, so structuredContent would only ever be an
    // unvalidated duplicate of content[].text; omit it rather than double every response.
    return { content: [{ type: 'text', text }] };
};

type node_like = { id: string };
type node_bearing_result = { node: node_like; changed_nodes: readonly node_like[]; nodes: readonly node_like[] };

// An ingest result repeats its primary node's full content in `changed_nodes` and `nodes`
// (it is a changed node, and usually a newly created one). Keep the one full copy at
// `result.node` and collapse later occurrences of the same id to a lightweight reference.
// Returns a response-shaping copy, not a typed IngestResult: changed_nodes/nodes entries
// may be reduced to { id } and this value is only ever serialized, never read back typed.
export function dedupe_ingest_nodes(result: node_bearing_result, extra_known_ids: ReadonlySet<string> = new Set()): Record<string, unknown> {
    const known = new Set<string>([result.node.id, ...extra_known_ids]);
    const collapse = (list: readonly node_like[]) => list.map((node) => known.has(node.id) ? { id: node.id } : node);
    return { ...result, changed_nodes: collapse(result.changed_nodes), nodes: collapse(result.nodes) };
}

export async function run_audited_tool(
    runtime: mcp_runtime,
    tool: mcp_tool_name,
    input: Record<string, unknown>,
    operation: () => Promise<unknown>,
): Promise<call_tool_result> {
    const started_at = Date.now();
    try {
        assert_tool_allowed(runtime.access, tool);
        const value = await operation();
        const completed_at = Date.now();
        runtime.audit.record({
            tool, user_id: runtime.access.user_id,
            project_id: typeof input.project_id === 'string' ? input.project_id : runtime.access.project_id,
            outcome: 'allowed', dry_run: typeof input.dry_run === 'boolean' ? input.dry_run : null,
            started_at, completed_at, error: null,
        });
        const include_vectors = typeof input.include_vectors === 'boolean' ? input.include_vectors : undefined;
        return json_tool_result(value, include_vectors);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const denied = /not allowed|read-only|permission denied/i.test(message);
        runtime.audit.record({
            tool, user_id: runtime.access.user_id,
            project_id: typeof input.project_id === 'string' ? input.project_id : runtime.access.project_id,
            outcome: denied ? 'denied' : 'error', dry_run: typeof input.dry_run === 'boolean' ? input.dry_run : null,
            started_at, completed_at: Date.now(), error: message,
        });
        throw error;
    }
}