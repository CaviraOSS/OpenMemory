import type { mcp_runtime } from '../runtime.js';
import { recall_permission } from '../security/permissions.js';

export function read_mcp_timeline(runtime: mcp_runtime, text = '', token_budget = 1024): Promise<unknown> {
    return runtime.memory.recall({
        text, mode: 'historical', token_budget,
        permission_context: recall_permission(runtime.access),
    });
}