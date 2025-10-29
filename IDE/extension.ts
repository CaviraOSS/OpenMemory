import * as vscode from 'vscode';

let current_openmemory_session_id: string | null = null;
let openmemory_api_base_url = 'http://localhost:3693';

export function activate(context: vscode.ExtensionContext) {
    console.log('OpenMemory IDE extension is now active!');

    start_ide_session();

    const change_listener = vscode.workspace.onDidChangeTextDocument((event_with_document_changes) => {
        if (event_with_document_changes.document.uri.scheme === 'file') {
            const file_path_being_edited = event_with_document_changes.document.uri.fsPath;
            const programming_language_id = event_with_document_changes.document.languageId;

            for (const individual_content_change of event_with_document_changes.contentChanges) {
                send_ide_event_to_openmemory({
                    event_type: 'edit',
                    file_path: file_path_being_edited,
                    language: programming_language_id,
                    content: individual_content_change.text,
                    metadata: {
                        range: individual_content_change.range,
                        rangeLength: individual_content_change.rangeLength
                    }
                });
            }
        }
    });

    // Monitor file saves
    const save_listener = vscode.workspace.onDidSaveTextDocument((saved_document) => {
        if (saved_document.uri.scheme === 'file') {
            send_ide_event_to_openmemory({
                event_type: 'save',
                file_path: saved_document.uri.fsPath,
                language: saved_document.languageId,
                content: saved_document.getText()
            });
        }
    });

    // Monitor file opens
    const open_listener = vscode.workspace.onDidOpenTextDocument((opened_document) => {
        if (opened_document.uri.scheme === 'file') {
            send_ide_event_to_openmemory({
                event_type: 'open',
                file_path: opened_document.uri.fsPath,
                language: opened_document.languageId,
                content: opened_document.getText()
            });
        }
    });

    // Monitor file closes
    const close_listener = vscode.workspace.onDidCloseTextDocument((closed_document) => {
        if (closed_document.uri.scheme === 'file') {
            send_ide_event_to_openmemory({
                event_type: 'close',
                file_path: closed_document.uri.fsPath,
                language: closed_document.languageId
            });
        }
    });

    // Command: Query context for AI
    const query_context_command = vscode.commands.registerCommand('openmemory.queryContext', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const current_file_path = editor.document.uri.fsPath;
        const selected_text = editor.document.getText(editor.selection);
        const query_text = selected_text || editor.document.getText();

        try {
            const relevant_memories = await query_openmemory_context(query_text, current_file_path);

            // Show results in a new document
            const results_document = await vscode.workspace.openTextDocument({
                content: format_memory_results(relevant_memories),
                language: 'markdown'
            });
            await vscode.window.showTextDocument(results_document);
        } catch (error) {
            vscode.window.showErrorMessage(`OpenMemory query failed: ${error}`);
        }
    });

    // Command: View session patterns
    const view_patterns_command = vscode.commands.registerCommand('openmemory.viewPatterns', async () => {
        if (!current_openmemory_session_id) {
            vscode.window.showErrorMessage('No active OpenMemory session');
            return;
        }

        try {
            const detected_patterns = await get_session_patterns(current_openmemory_session_id);

            const patterns_document = await vscode.workspace.openTextDocument({
                content: format_pattern_results(detected_patterns),
                language: 'markdown'
            });
            await vscode.window.showTextDocument(patterns_document);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to fetch patterns: ${error}`);
        }
    });

    context.subscriptions.push(
        change_listener,
        save_listener,
        open_listener,
        close_listener,
        query_context_command,
        view_patterns_command
    );
}

export function deactivate() {
    // End session when extension deactivates
    if (current_openmemory_session_id) {
        end_ide_session();
    }
}

async function start_ide_session() {
    try {
        const workspace_folder = vscode.workspace.workspaceFolders?.[0];
        const project_name = workspace_folder?.name || 'unknown';

        const response = await fetch(`${openmemory_api_base_url}/api/ide/session/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: 'vscode-user',
                project_name: project_name,
                ide_name: 'vscode'
            })
        });

        const data = await response.json();
        current_openmemory_session_id = data.session_id;
        console.log(`OpenMemory session started: ${current_openmemory_session_id}`);
    } catch (error) {
        console.error('Failed to start OpenMemory session:', error);
    }
}

async function end_ide_session() {
    if (!current_openmemory_session_id) return;

    try {
        const response = await fetch(`${openmemory_api_base_url}/api/ide/session/end`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: current_openmemory_session_id
            })
        });

        const data = await response.json();
        console.log('OpenMemory session ended:', data);
        current_openmemory_session_id = null;
    } catch (error) {
        console.error('Failed to end OpenMemory session:', error);
    }
}

async function send_ide_event_to_openmemory(event_data: {
    event_type: string;
    file_path: string;
    language: string;
    content?: string;
    metadata?: any;
}) {
    if (!current_openmemory_session_id) return;

    try {
        await fetch(`${openmemory_api_base_url}/api/ide/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: current_openmemory_session_id,
                event_type: event_data.event_type,
                file_path: event_data.file_path,
                language: event_data.language,
                content: event_data.content,
                metadata: event_data.metadata,
                timestamp: new Date().toISOString()
            })
        });
    } catch (error) {
        console.error('Failed to send event to OpenMemory:', error);
    }
}

async function query_openmemory_context(query_text: string, current_file: string) {
    const response = await fetch(`${openmemory_api_base_url}/api/ide/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: query_text,
            session_id: current_openmemory_session_id,
            file_path: current_file,
            limit: 10
        })
    });

    const data = await response.json();
    return data.memories || [];
}

async function get_session_patterns(session_id: string) {
    const response = await fetch(`${openmemory_api_base_url}/api/ide/patterns/${session_id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();
    return data.patterns || [];
}

function format_memory_results(memories: any[]): string {
    let formatted_output = '# OpenMemory Context Results\n\n';

    if (memories.length === 0) {
        formatted_output += 'No relevant memories found.\n';
        return formatted_output;
    }

    for (const memory of memories) {
        formatted_output += `## Memory ID: ${memory.id}\n`;
        formatted_output += `**Score:** ${memory.score?.toFixed(3) || 'N/A'}\n`;
        formatted_output += `**Sector:** ${memory.sector}\n`;
        formatted_output += `**Content:**\n\`\`\`\n${memory.content}\n\`\`\`\n\n`;
    }

    return formatted_output;
}

function format_pattern_results(patterns: any[]): string {
    let formatted_output = '# Detected Coding Patterns\n\n';

    if (patterns.length === 0) {
        formatted_output += 'No patterns detected in this session.\n';
        return formatted_output;
    }

    for (const pattern of patterns) {
        formatted_output += `## Pattern: ${pattern.description || 'Unknown'}\n`;
        formatted_output += `**Frequency:** ${pattern.frequency || 'N/A'}\n`;
        formatted_output += `**Context:**\n\`\`\`\n${pattern.context || 'No context'}\n\`\`\`\n\n`;
    }

    return formatted_output;
}
