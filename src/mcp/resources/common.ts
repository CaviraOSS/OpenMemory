import type { ReadResourceResult as read_resource_result } from '@modelcontextprotocol/sdk/types.js';

export const json_resource = (uri: URL | string, value: unknown): read_resource_result => ({
    contents: [{ uri: String(uri), mimeType: 'application/json', text: JSON.stringify(value) }],
});

export const variable = (values: Record<string, string | string[]>, key: string): string => {
    const value = values[key];
    if (Array.isArray(value)) return value[0] ?? '';
    return value ?? '';
};