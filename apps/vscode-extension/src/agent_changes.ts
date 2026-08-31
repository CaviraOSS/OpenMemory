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
 *  file  : apps/vscode-extension/src/agent_changes.ts
 *  usage : supports the LongMemory VS Code extension agent changes
 */


import { createHash } from 'node:crypto';

export type agent_kind = 'copilot' | 'codex' | 'claude' | 'cursor' | 'windsurf' | 'other';
export type attribution_confidence = 'explicit' | 'heuristic';

export type pending_file_change = {
    path: string;
    language: string;
    before: string;
    after: string;
    changed_at: number;
};

export type pending_agent_change = {
    id: string;
    agent: agent_kind;
    confidence: attribution_confidence;
    started_at: number;
    updated_at: number;
    files: pending_file_change[];
};

export type rendered_agent_change = {
    text: string;
    metadata: {
        change_id: string;
        agent: agent_kind;
        attribution_confidence: attribution_confidence;
        files: string[];
        change_count: number;
        started_at: number;
        updated_at: number;
        truncated: boolean;
    };
};

const secret_path = /(^|[\\/])(?:\.env(?:\..*)?|\.npmrc|\.pypirc|id_rsa|id_ed25519|credentials(?:\.json)?|secrets?(?:\.[^\\/]*)?|.*\.(?:pem|key|p12|pfx))$/i;
const binary_extension = /\.(?:png|jpe?g|gif|webp|ico|pdf|zip|gz|tar|7z|exe|dll|so|dylib|wasm|woff2?|ttf|otf|mp[34]|mov|avi|sqlite|db)$/i;
const generated_path = /(^|[\\/])(?:\.git|\.longmemory|node_modules|dist|out|build|coverage)([\\/]|$)/i;
const credential_line = /(?:api[_-]?key|(?:access[_-]?|auth[_-]?)?token|client[_-]?secret|password|private[_-]?key|authorization)\s*[:=]|\bbearer\s+[a-z0-9._~+/=-]+|-----begin [a-z ]*private key-----/i;

export const should_capture_path = (path: string): boolean => !generated_path.test(path) && !secret_path.test(path) && !binary_extension.test(path);

export const redact_patch_line = (line: string): string => credential_line.test(line) ? '[redacted credential-like line]' : line;

type operation = { kind: 'equal' | 'add' | 'remove'; line: string; old_line: number; new_line: number };
type line_pair = { old_index: number; new_index: number };

const unique_lines = (lines: string[]): Map<string, number> => {
    const found = new Map<string, number>();
    const repeated = new Set<string>();
    lines.forEach((line, index) => {
        if (found.has(line)) repeated.add(line);
        else found.set(line, index);
    });
    for (const line of repeated) found.delete(line);
    return found;
};

const patience_anchors = (left: string[], right: string[]): line_pair[] => {
    const old_lines = unique_lines(left);
    const new_lines = unique_lines(right);
    const pairs = [...old_lines].flatMap(([line, old_index]) => {
        const new_index = new_lines.get(line);
        return new_index === undefined ? [] : [{ old_index, new_index }];
    }).sort((a, b) => a.old_index - b.old_index);
    const tails: number[] = [];
    const previous = new Int32Array(pairs.length).fill(-1);
    for (let index = 0; index < pairs.length; index++) {
        let low = 0;
        let high = tails.length;
        while (low < high) {
            const middle = (low + high) >>> 1;
            const tail = pairs[tails[middle] as number] as line_pair;
            if (tail.new_index < (pairs[index] as line_pair).new_index) low = middle + 1;
            else high = middle;
        }
        if (low) previous[index] = tails[low - 1] as number;
        tails[low] = index;
    }
    const anchors: line_pair[] = [];
    let index = tails.at(-1) ?? -1;
    while (index >= 0) {
        anchors.push(pairs[index] as line_pair);
        index = previous[index] ?? -1;
    }
    return anchors.reverse();
};

const diff_lines = (before: string, after: string): operation[] => {
    const left = before.split(/\r?\n/);
    const right = after.split(/\r?\n/);
    const operations: operation[] = [];
    let old_index = 0;
    let new_index = 0;
    let old_line = 1;
    let new_line = 1;
    const append = (kind: operation['kind'], line: string) => {
        operations.push({ kind, line, old_line, new_line });
        if (kind !== 'add') old_line++;
        if (kind !== 'remove') new_line++;
    };
    for (const anchor of patience_anchors(left, right)) {
        while (old_index < anchor.old_index) append('remove', left[old_index++] ?? '');
        while (new_index < anchor.new_index) append('add', right[new_index++] ?? '');
        append('equal', left[old_index] ?? '');
        old_index++;
        new_index++;
    }
    while (old_index < left.length) append('remove', left[old_index++] ?? '');
    while (new_index < right.length) append('add', right[new_index++] ?? '');
    return operations;
};

const render_hunks = (operations: operation[], context = 2): string[] => {
    const changed = operations.flatMap((operation, index) => operation.kind === 'equal' ? [] : [index]);
    const ranges: Array<[number, number]> = [];
    for (const index of changed) {
        const start = Math.max(0, index - context);
        const end = Math.min(operations.length - 1, index + context);
        const prior = ranges.at(-1);
        if (prior && start <= prior[1] + 1) prior[1] = Math.max(prior[1], end);
        else ranges.push([start, end]);
    }
    return ranges.map(([start, end]) => {
        const values = operations.slice(start, end + 1);
        const first = values[0] as operation;
        const old_count = values.filter((value) => value.kind !== 'add').length;
        const new_count = values.filter((value) => value.kind !== 'remove').length;
        return [
            `@@ -${first.old_line},${old_count} +${first.new_line},${new_count} @@`,
            ...values.map((value) => `${value.kind === 'add' ? '+' : value.kind === 'remove' ? '-' : ' '}${redact_patch_line(value.line)}`),
        ].join('\n');
    });
};

export const render_file_patch = (change: pending_file_change): string => {
    if (!should_capture_path(change.path) || change.before === change.after) return '';
    return [`--- a/${change.path}`, `+++ b/${change.path}`, ...render_hunks(diff_lines(change.before, change.after))].join('\n');
};

export const merge_file_change = (values: pending_file_change[], next: pending_file_change): pending_file_change[] => {
    const existing = values.find((value) => value.path === next.path);
    if (!existing) return [...values, next];
    return values.map((value) => value.path === next.path ? { ...next, before: value.before } : value);
};

export const change_id = (agent: agent_kind, at: number): string => createHash('sha256').update(`${agent}:${at}`).digest('hex').slice(0, 16);

const truncate_utf8 = (value: string, max_bytes: number): string => {
    const bytes = Buffer.from(value);
    if (bytes.length <= max_bytes) return value;
    let end = Math.max(0, max_bytes);
    while (end) {
        try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, end)); }
        catch { end--; }
    }
    return '';
};

export const render_agent_change = (change: pending_agent_change, max_bytes: number): rendered_agent_change | null => {
    const rendered_files = change.files.flatMap((file) => {
        const patch = render_file_patch(file);
        return patch ? [{ path: file.path, patch }] : [];
    });
    if (!rendered_files.length) return null;
    const header = `AI agent change set\nAgent: ${change.agent}\nAttribution: ${change.confidence}\nFiles: ${rendered_files.length}\n\n`;
    const body = rendered_files.map((value) => value.patch).join('\n\n');
    let text = `${header}${body}`;
    let truncated = false;
    if (Buffer.byteLength(text) > max_bytes) {
        const marker = '\n\n[patch truncated]';
        const marker_bytes = Buffer.byteLength(marker);
        text = marker_bytes <= max_bytes
            ? `${truncate_utf8(text, max_bytes - marker_bytes)}${marker}`
            : truncate_utf8(text, max_bytes);
        truncated = true;
    }
    return {
        text,
        metadata: {
            agent: change.agent,
            attribution_confidence: change.confidence,
            files: rendered_files.map((value) => value.path),
            change_id: change.id,
            change_count: rendered_files.length,
            started_at: change.started_at,
            updated_at: change.updated_at,
            truncated,
        },
    };
};
