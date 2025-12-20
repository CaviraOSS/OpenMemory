import * as vscode from 'vscode';
import * as path from 'path';

export class DashboardPanel {
    public static currentPanel: DashboardPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'openMemoryDashboard',
            'OpenMemory Dashboard',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(path.join(extensionUri.fsPath, 'media'))]
            }
        );

        DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'quickNote':
                        vscode.commands.executeCommand('openmemory.quickNote');
                        return;
                    case 'query':
                        vscode.commands.executeCommand('openmemory.queryContext');
                        return;
                    case 'patterns':
                        vscode.commands.executeCommand('openmemory.viewPatterns');
                        return;
                    case 'settings':
                        vscode.commands.executeCommand('openmemory.setup');
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        DashboardPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>OpenMemory Dashboard</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                    }
                    h1, h2 {
                        color: var(--vscode-editor-foreground);
                    }
                    .card {
                        background-color: var(--vscode-editor-inactiveSelectionBackground);
                        padding: 15px;
                        border-radius: 5px;
                        margin-bottom: 15px;
                    }
                    .button-group {
                        display: flex;
                        gap: 10px;
                        flex-wrap: wrap;
                    }
                    button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 12px;
                        cursor: pointer;
                        border-radius: 2px;
                    }
                    button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    .status-indicator {
                        display: inline-block;
                        width: 10px;
                        height: 10px;
                        border-radius: 50%;
                        background-color: #4caf50;
                        margin-right: 5px;
                    }
                </style>
            </head>
            <body>
                <h1>OpenMemory Dashboard</h1>
                
                <div class="card">
                    <h2>Status</h2>
                    <p><span class="status-indicator"></span> Active and Tracking</p>
                </div>

                <div class="card">
                    <h2>Quick Actions</h2>
                    <div class="button-group">
                        <button onclick="sendMessage('quickNote')">📝 Quick Note</button>
                        <button onclick="sendMessage('query')">🔍 Query Context</button>
                        <button onclick="sendMessage('patterns')">📊 View Patterns</button>
                        <button onclick="sendMessage('settings')">⚙️ Settings</button>
                    </div>
                </div>

                <div class="card">
                    <h2>Recent Activity</h2>
                    <p>Tracking your coding session...</p>
                </div>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    function sendMessage(command) {
                        vscode.postMessage({ command: command });
                    }
                </script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
