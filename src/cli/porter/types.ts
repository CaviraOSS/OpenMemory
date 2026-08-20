export type harness_id = 'claude-code' | 'codex' | 'opencode' | 'gemini-cli' | 'copilot-chat' | 'cline' | 'deepseek-harness';

export type portable_turn = {
    role: 'system' | 'user' | 'assistant' | 'tool';
    text: string;
    timestamp?: number;
    model?: string;
    name?: string;
    tool_call_id?: string;
};

export type portable_session = {
    schema_version: '1.0.0';
    source_harness: harness_id;
    source_session_id: string;
    source_path: string;
    cwd: string;
    title: string;
    created_at?: number;
    updated_at?: number;
    turns: portable_turn[];
    dropped_turns: number;
    source_metadata: Record<string, unknown>;
};

export type session_ref = {
    harness: harness_id;
    source_session_id: string;
    source_path: string;
    title: string;
    cwd: string;
    updated_at?: number;
};

export type harness_capability = {
    harness: harness_id;
    installed: boolean;
    can_import: boolean;
    source_path: string | null;
    note: string | null;
};

export type import_adapter = {
    harness: harness_id;
    detect(env?: NodeJS.ProcessEnv): harness_capability | Promise<harness_capability>;
    discover(env?: NodeJS.ProcessEnv): session_ref[] | Promise<session_ref[]>;
    parse(ref: session_ref, env?: NodeJS.ProcessEnv): portable_session | Promise<portable_session>;
};