import * as vscode from 'vscode';
import { shouldSkipEvent, getSectorFilter } from './hooks/ideEvents';
import { writeCursorConfig } from './writers/cursor';
import { writeClaudeConfig } from './writers/claude';
import { writeWindsurfConfig } from './writers/windsurf';
import { writeCopilotConfig } from './writers/copilot';
import { writeCodexConfig } from './writers/codex';

let session_id: string | null = null;
let backend_url = 'http://localhost:8080';
let api_key: string | undefined = undefined;
let status_bar: vscode.StatusBarItem;
let is_tracking = false;
let auto_linked = false;
let use_mcp = false;
let mcp_server_path = '';
let is_enabled = true;

export function activate(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('openmemory');
    is_enabled = config.get('enabled') ?? true;
    backend_url = config.get('backendUrl') || 'http://localhost:8080';
    api_key = config.get('apiKey') || undefined;
    use_mcp = config.get('useMCP') || false;
    mcp_server_path = config.get('mcpServerPath') || '';

    status_bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    status_bar.command = 'openmemory.statusBarClick';
    context.subscriptions.push(status_bar);

    if (!is_enabled) {
        update_status_bar('disabled');
        status_bar.show();
        return;
    }

    update_status_bar('connecting');
    status_bar.show();

    check_connection().then(async connected => {
        if (connected) {
            await auto_link_all();
            await start_session();
        } else {
            update_status_bar('disconnected');
            show_quick_setup();
        }
    });

    const status_click = vscode.commands.registerCommand('openmemory.statusBarClick', () => show_menu());
    const query_cmd = vscode.commands.registerCommand('openmemory.queryContext', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }
        try {
            const query = editor.document.getText(editor.selection) || editor.document.getText();
            const memories = await query_context(query, editor.document.uri.fsPath);
            const doc = await vscode.workspace.openTextDocument({ content: format_memories(memories), language: 'markdown' });
            await vscode.window.showTextDocument(doc);
        } catch (error) {
            vscode.window.showErrorMessage(`Query failed: ${error}`);
        }
    });

    const patterns_cmd = vscode.commands.registerCommand('openmemory.viewPatterns', async () => {
        if (!session_id) {
            vscode.window.showErrorMessage('No active session');
            return;
        }
        try {
            const patterns = await get_patterns(session_id);
            const doc = await vscode.workspace.openTextDocument({ content: format_patterns(patterns), language: 'markdown' });
            await vscode.window.showTextDocument(doc);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed: ${error}`);
        }
    });

    const toggle_cmd = vscode.commands.registerCommand('openmemory.toggleTracking', () => {
        is_tracking = !is_tracking;
        update_status_bar(is_tracking ? 'active' : 'paused');
        vscode.window.showInformationMessage(`Tracking ${is_tracking ? 'enabled' : 'paused'}`);
    });

    const setup_cmd = vscode.commands.registerCommand('openmemory.setup', () => show_quick_setup());

    const change_listener = vscode.workspace.onDidChangeTextDocument((e) => {
        if (is_enabled && is_tracking && e.document.uri.scheme === 'file') {
            for (const change of e.contentChanges) {
                const content = change.text;
                if (shouldSkipEvent(e.document.uri.fsPath, 'edit', content)) continue;
                send_event({ event_type: 'edit', file_path: e.document.uri.fsPath, language: e.document.languageId, content, metadata: { range: change.range, rangeLength: change.rangeLength } });
            }
        }
    });

    const save_listener = vscode.workspace.onDidSaveTextDocument((doc) => {
        if (is_enabled && is_tracking && doc.uri.scheme === 'file') {
            send_event({ event_type: 'save', file_path: doc.uri.fsPath, language: doc.languageId, content: doc.getText() });
        }
    });

    const open_listener = vscode.workspace.onDidOpenTextDocument((doc) => {
        if (is_enabled && is_tracking && doc.uri.scheme === 'file') {
            send_event({ event_type: 'open', file_path: doc.uri.fsPath, language: doc.languageId, content: doc.getText() });
        }
    });

    const close_listener = vscode.workspace.onDidCloseTextDocument((doc) => {
        if (is_enabled && is_tracking && doc.uri.scheme === 'file') {
            send_event({ event_type: 'close', file_path: doc.uri.fsPath, language: doc.languageId });
        }
    });

    context.subscriptions.push(status_click, query_cmd, patterns_cmd, toggle_cmd, setup_cmd, change_listener, save_listener, open_listener, close_listener);
}

export function deactivate() {
    if (session_id) end_session();
}

async function auto_link_all() {
    auto_linked = false;
    try {
        const configs: string[] = [];
        configs.push(await writeCursorConfig(backend_url, api_key, use_mcp, mcp_server_path));
        configs.push(await writeClaudeConfig(backend_url, api_key, use_mcp, mcp_server_path));
        configs.push(await writeWindsurfConfig(backend_url, api_key, use_mcp, mcp_server_path));
        configs.push(await writeCopilotConfig(backend_url, api_key, use_mcp, mcp_server_path));
        configs.push(await writeCodexConfig(backend_url, api_key, use_mcp, mcp_server_path));

        const mode = use_mcp ? 'MCP protocol' : 'Direct HTTP';
        vscode.window.showInformationMessage(`✅ Auto-linked OpenMemory to AI tools (${mode})`);
        auto_linked = true;
    } catch (error) {
        console.error('Auto-link failed:', error);
    }
}

function update_status_bar(state: 'active' | 'paused' | 'connecting' | 'disconnected' | 'disabled') {
    const icons = { active: '$(pulse) OpenMemory', paused: '$(debug-pause) OpenMemory', connecting: '$(sync~spin) OpenMemory', disconnected: '$(error) OpenMemory', disabled: '$(circle-slash) OpenMemory' };
    const mode = use_mcp ? 'MCP' : 'HTTP';
    const tooltips = {
        active: `OpenMemory: Tracking active (${mode}) • Click for options`,
        paused: `OpenMemory: Tracking paused (${mode}) • Click to resume`,
        connecting: `OpenMemory: Connecting (${mode})...`,
        disconnected: `OpenMemory: Disconnected (${mode}) • Click to setup`,
        disabled: 'OpenMemory: Disabled • Click to enable'
    };
    status_bar.text = icons[state];
    status_bar.tooltip = tooltips[state];
}

async function show_menu() {
    if (!is_enabled) {
        const choice = await vscode.window.showQuickPick([
            { label: '$(check) Enable OpenMemory', action: 'enable' },
            { label: '$(gear) Setup', action: 'setup' }
        ], { placeHolder: 'OpenMemory is Disabled' });
        if (!choice) return;
        if (choice.action === 'enable') {
            const config = vscode.workspace.getConfiguration('openmemory');
            await config.update('enabled', true, vscode.ConfigurationTarget.Global);
            is_enabled = true;
            vscode.window.showInformationMessage('OpenMemory enabled. Reloading window...');
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        } else if (choice.action === 'setup') {
            show_quick_setup();
        }
        return;
    }

    const items = [];
    items.push(is_tracking ? { label: '$(debug-pause) Pause Tracking', action: 'pause' } : { label: '$(play) Resume Tracking', action: 'resume' });
    items.push({ label: '$(search) Query Context', action: 'query' }, { label: '$(graph) View Patterns', action: 'patterns' }, { label: use_mcp ? '$(link) Switch to Direct HTTP' : '$(server-process) Switch to MCP Mode', action: 'toggle_mcp' }, { label: '$(circle-slash) Disable Extension', action: 'disable' }, { label: '$(gear) Setup', action: 'setup' }, { label: '$(refresh) Reconnect', action: 'reconnect' });
    const choice = await vscode.window.showQuickPick(items, { placeHolder: 'OpenMemory Actions' });
    if (!choice) return;
    switch (choice.action) {
        case 'pause': is_tracking = false; update_status_bar('paused'); break;
        case 'resume': is_tracking = true; update_status_bar('active'); break;
        case 'query': vscode.commands.executeCommand('openmemory.queryContext'); break;
        case 'patterns': vscode.commands.executeCommand('openmemory.viewPatterns'); break;
        case 'toggle_mcp':
            use_mcp = !use_mcp;
            const mcpConfig = vscode.workspace.getConfiguration('openmemory');
            await mcpConfig.update('useMCP', use_mcp, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Switched to ${use_mcp ? 'MCP' : 'Direct HTTP'} mode. Reconnecting...`);
            await auto_link_all();
            break;
        case 'disable':
            const config = vscode.workspace.getConfiguration('openmemory');
            await config.update('enabled', false, vscode.ConfigurationTarget.Global);
            is_enabled = false;
            if (session_id) await end_session();
            update_status_bar('disabled');
            vscode.window.showInformationMessage('OpenMemory disabled');
            break;
        case 'setup': show_quick_setup(); break;
        case 'reconnect':
            update_status_bar('connecting');
            const connected = await check_connection();
            if (connected) {
                await start_session();
            } else {
                update_status_bar('disconnected');
                vscode.window.showErrorMessage('Cannot connect to backend');
            }
            break;
    }
}

async function show_quick_setup() {
    const items = [
        { label: is_enabled ? '$(circle-slash) Disable Extension' : '$(check) Enable Extension', action: 'toggle_enabled', description: is_enabled ? 'Turn off OpenMemory tracking' : 'Turn on OpenMemory tracking' },
        { label: '$(server-process) Toggle MCP Mode', action: 'mcp', description: use_mcp ? 'Currently: MCP (switch to Direct HTTP)' : 'Currently: Direct HTTP (switch to MCP)' },
        { label: '$(key) Configure API Key', action: 'apikey' },
        { label: '$(server) Change Backend URL', action: 'url' },
        { label: '$(file-code) Set MCP Server Path', action: 'mcppath', description: 'Optional: custom MCP server executable' },
        { label: '$(link-external) View Documentation', action: 'docs' },
        { label: '$(debug-restart) Test Connection', action: 'test' }
    ];
    const choice = await vscode.window.showQuickPick(items, { placeHolder: 'OpenMemory Setup' });
    if (!choice) return;
    switch (choice.action) {
        case 'toggle_enabled':
            const enabledConfig = vscode.workspace.getConfiguration('openmemory');
            is_enabled = !is_enabled;
            await enabledConfig.update('enabled', is_enabled, vscode.ConfigurationTarget.Global);
            if (is_enabled) {
                vscode.window.showInformationMessage('OpenMemory enabled. Reloading window...');
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            } else {
                if (session_id) await end_session();
                update_status_bar('disabled');
                vscode.window.showInformationMessage('OpenMemory disabled');
            }
            break;
        case 'mcp':
            use_mcp = !use_mcp;
            const mcpConfig = vscode.workspace.getConfiguration('openmemory');
            await mcpConfig.update('useMCP', use_mcp, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Switched to ${use_mcp ? 'MCP' : 'Direct HTTP'} mode`);
            await auto_link_all();
            break;
        case 'mcppath':
            const path = await vscode.window.showInputBox({ prompt: 'Enter MCP server executable path (leave empty to use backend MCP)', value: mcp_server_path, placeHolder: '/path/to/mcp-server' });
            if (path !== undefined) {
                const config = vscode.workspace.getConfiguration('openmemory');
                await config.update('mcpServerPath', path, vscode.ConfigurationTarget.Global);
                mcp_server_path = path;
                vscode.window.showInformationMessage('MCP server path updated');
            }
            break;
        case 'apikey':
            const key = await vscode.window.showInputBox({ prompt: 'Enter API key (leave empty if not required)', password: true, placeHolder: 'your-api-key' });
            if (key !== undefined) {
                const config = vscode.workspace.getConfiguration('openmemory');
                await config.update('apiKey', key, vscode.ConfigurationTarget.Global);
                api_key = key;
                vscode.window.showInformationMessage('API key saved');
                const connected = await check_connection();
                if (connected) await start_session();
            }
            break;
        case 'url':
            const url = await vscode.window.showInputBox({ prompt: 'Enter backend URL', value: backend_url, placeHolder: 'http://localhost:8080' });
            if (url) {
                const config = vscode.workspace.getConfiguration('openmemory');
                await config.update('backendUrl', url, vscode.ConfigurationTarget.Global);
                backend_url = url;
                vscode.window.showInformationMessage('Backend URL updated');
                const connected = await check_connection();
                if (connected) await start_session();
            }
            break;
        case 'docs': vscode.env.openExternal(vscode.Uri.parse('https://github.com/CaviraOSS/OpenMemory')); break;
        case 'test':
            update_status_bar('connecting');
            const connected = await check_connection();
            if (connected) {
                await start_session();
                vscode.window.showInformationMessage('✅ Connected successfully');
            } else {
                update_status_bar('disconnected');
                vscode.window.showErrorMessage('❌ Connection failed');
            }
            break;
    }
}

async function check_connection(): Promise<boolean> {
    try {
        const response = await fetch(`${backend_url}/health`, { method: 'GET', headers: get_headers() });
        return response.ok;
    } catch {
        return false;
    }
}

function get_headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (api_key) headers['x-api-key'] = api_key;
    return headers;
}

async function start_session() {
    try {
        const project = vscode.workspace.workspaceFolders?.[0]?.name || 'unknown';
        const response = await fetch(`${backend_url}/api/ide/session/start`, { method: 'POST', headers: get_headers(), body: JSON.stringify({ user_id: 'vscode-user', project_name: project, ide_name: 'vscode' }) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        session_id = data.session_id;
        is_tracking = true;
        update_status_bar('active');
        vscode.window.showInformationMessage('OpenMemory connected');
    } catch {
        update_status_bar('disconnected');
        show_quick_setup();
    }
}

async function end_session() {
    if (!session_id) return;
    try {
        await fetch(`${backend_url}/api/ide/session/end`, { method: 'POST', headers: get_headers(), body: JSON.stringify({ session_id }) });
        session_id = null;
    } catch { }
}

async function send_event(event_data: { event_type: string; file_path: string; language: string; content?: string; metadata?: any; }) {
    if (!session_id || !is_tracking) return;
    try {
        await fetch(`${backend_url}/api/ide/events`, { method: 'POST', headers: get_headers(), body: JSON.stringify({ session_id, event_type: event_data.event_type, file_path: event_data.file_path, language: event_data.language, content: event_data.content, metadata: event_data.metadata, timestamp: new Date().toISOString() }) });
    } catch { }
}

async function query_context(query: string, file: string) {
    const response = await fetch(`${backend_url}/api/ide/context`, { method: 'POST', headers: get_headers(), body: JSON.stringify({ query, session_id, file_path: file, limit: 10 }) });
    const data = await response.json();
    return data.memories || [];
}

async function get_patterns(sid: string) {
    const response = await fetch(`${backend_url}/api/ide/patterns/${sid}`, { method: 'GET', headers: get_headers() });
    const data = await response.json();
    return data.patterns || [];
}

function format_memories(memories: any[]): string {
    let out = '# OpenMemory Context Results\n\n';
    if (memories.length === 0) return out + 'No relevant memories found.\n';
    for (const m of memories) {
        out += `## Memory ID: ${m.id}\n**Score:** ${m.score?.toFixed(3) || 'N/A'}\n**Sector:** ${m.sector}\n**Content:**\n\`\`\`\n${m.content}\n\`\`\`\n\n`;
    }
    return out;
}

function format_patterns(patterns: any[]): string {
    let out = '# Detected Coding Patterns\n\n';
    if (patterns.length === 0) return out + 'No patterns detected.\n';
    for (const p of patterns) {
        out += `## Pattern: ${p.description || 'Unknown'}\n**Frequency:** ${p.frequency || 'N/A'}\n**Context:**\n\`\`\`\n${p.context || 'No context'}\n\`\`\`\n\n`;
    }
    return out;
}
