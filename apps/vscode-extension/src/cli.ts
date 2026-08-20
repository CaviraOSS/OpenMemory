import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import * as vscode from 'vscode';

export class cli_error extends Error {
    constructor(message: string, readonly detail: string, readonly code: number | null) {
        super(message);
    }
}

type run_options = { input?: string; timeout_ms?: number; resource?: vscode.Uri };

const workspace_folder = (resource?: vscode.Uri): vscode.WorkspaceFolder => {
    const target = resource ?? vscode.window.activeTextEditor?.document.uri;
    const folder = target ? vscode.workspace.getWorkspaceFolder(target) : vscode.workspace.workspaceFolders?.[0];
    if (!folder) throw new cli_error('Open a workspace before using OpenMemory.', 'No workspace folder is open.', null);
    return folder;
};

const config = (resource?: vscode.Uri) => vscode.workspace.getConfiguration('openmemory', workspace_folder(resource).uri);

export class openmemory_cli implements vscode.Disposable {
    private readonly active = new Set<ChildProcess>();

    constructor(private readonly output: vscode.OutputChannel) { }

    current_resource(): vscode.Uri | undefined {
        try { return workspace_folder().uri; }
        catch { return undefined; }
    }

    is_initialized(resource?: vscode.Uri): boolean {
        const root = workspace_folder(resource).uri.fsPath;
        const database = config(resource).get<string>('database', '.openmemory/project.db').trim();
        return database === ':memory:' || existsSync(isAbsolute(database) ? database : resolve(root, database));
    }

    async run<T>(command: string[], options: run_options = {}): Promise<T> {
        if (!vscode.workspace.isTrusted) throw new cli_error('Trust this workspace before running OpenMemory.', 'Workspace Trust is required because OpenMemory executes a local CLI.', null);
        const root = workspace_folder(options.resource).uri.fsPath;
        const configured = config(options.resource).get<string>('cliPath', 'openmemory').trim() || 'openmemory';
        const cli_path = isAbsolute(configured) ? configured : configured.includes('/') || configured.includes('\\') ? resolve(root, configured) : configured;
        const executable = cli_path.endsWith('.js') ? process.execPath : process.platform === 'win32' && cli_path === 'openmemory' ? 'openmemory.cmd' : cli_path;
        const prefix = cli_path.endsWith('.js') ? [cli_path] : [];
        const database = config(options.resource).get<string>('database', '.openmemory/project.db').trim();
        const project = config(options.resource).get<string>('project', 'current').trim() || 'current';
        const user = config(options.resource).get<string>('user', 'default').trim() || 'default';
        const args = [...prefix, ...command, '--json', '--no-color', '--cwd', root, '--project', project, '--user', user, ...(database ? ['--db', database] : [])];
        const group = ['project', 'maintenance', 'memory'].includes(command[0] ?? '') ? command.slice(0, 2) : command.slice(0, 1);
        this.output.appendLine(`> OpenMemory ${group.join(' ')}${command.length > group.length ? ' [arguments redacted]' : ''}`);

        return new Promise<T>((resolve_value, reject) => {
            const child = spawn(executable, args, {
                cwd: root,
                env: { ...process.env, NO_COLOR: '1' },
                windowsHide: true,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            this.active.add(child);
            let stdout = '';
            let stderr = '';
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                void this.stop(child).then(() => {
                    reject(new cli_error('OpenMemory command timed out.', stderr || stdout, null));
                });
            }, options.timeout_ms ?? 60_000);
            child.stdout.setEncoding('utf8');
            child.stderr.setEncoding('utf8');
            child.stdout.on('data', (chunk: string) => { stdout += chunk; });
            child.stderr.on('data', (chunk: string) => { stderr += chunk; });
            child.once('error', (error) => {
                clearTimeout(timer);
                this.active.delete(child);
                if (settled) return;
                settled = true;
                reject(new cli_error(`Unable to start OpenMemory CLI: ${error.message}`, error.stack ?? error.message, null));
            });
            child.once('close', (code) => {
                clearTimeout(timer);
                this.active.delete(child);
                if (settled) return;
                settled = true;
                if (stderr.trim()) this.output.appendLine(stderr.trim());
                if (code !== 0) {
                    let message = stderr.trim() || `OpenMemory exited with code ${code}`;
                    try { message = (JSON.parse(stderr) as { error?: { message?: string } }).error?.message ?? message; } catch { }
                    reject(new cli_error(message, stderr || stdout, code));
                    return;
                }
                try {
                    resolve_value(JSON.parse(stdout) as T);
                } catch (error) {
                    reject(new cli_error('OpenMemory returned invalid JSON.', `${error instanceof Error ? error.message : String(error)}\n${stdout}`, code));
                }
            });
            if (options.input !== undefined) child.stdin.end(options.input);
            else child.stdin.end();
        });
    }

    dispose(): void {
        for (const child of this.active) void this.stop(child);
        this.active.clear();
    }

    private async stop(child: ChildProcess): Promise<void> {
        if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
        if (process.platform === 'win32') {
            await new Promise<void>((resolve_stop) => {
                const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
                killer.once('close', () => resolve_stop());
                killer.once('error', () => resolve_stop());
            });
            return;
        }
        child.kill('SIGTERM');
        await new Promise<void>((resolve_stop) => {
            const timer = setTimeout(resolve_stop, 2_000);
            child.once('close', () => { clearTimeout(timer); resolve_stop(); });
        });
    }
}
