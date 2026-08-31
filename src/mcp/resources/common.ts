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
 *  file  : src/mcp/resources/common.ts
 *  usage : implements the LongMemory common component
 */


import type { ReadResourceResult as read_resource_result } from '@modelcontextprotocol/sdk/types.js';

export const json_resource = (uri: URL | string, value: unknown): read_resource_result => ({
    contents: [{ uri: String(uri), mimeType: 'application/json', text: JSON.stringify(value) }],
});

export const variable = (values: Record<string, string | string[]>, key: string): string => {
    const value = values[key];
    if (Array.isArray(value)) return value[0] ?? '';
    return value ?? '';
};