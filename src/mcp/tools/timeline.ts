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
 *  file  : src/mcp/tools/timeline.ts
 *  usage : implements the LongMemory timeline component
 */

import type { mcp_runtime } from '../runtime.js';
import { recall_permission } from '../security/permissions.js';

export function read_mcp_timeline(runtime: mcp_runtime, text = '', token_budget = 1024): Promise<unknown> {
    return runtime.memory.recall({
        text, mode: 'historical', token_budget,
        permission_context: recall_permission(runtime.access),
    });
}