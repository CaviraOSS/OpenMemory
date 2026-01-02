"use strict";
/**
 * github source for openmemory - production grade
 * requires: @octokit/rest
 * env vars: GITHUB_TOKEN
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.github_source = void 0;
const base_1 = require("./base");
class github_source extends base_1.base_source {
    name = 'github';
    octokit = null;
    async _connect(creds) {
        let Octokit;
        try {
            Octokit = await Promise.resolve().then(() => __importStar(require('@octokit/rest'))).then(m => m.Octokit);
        }
        catch {
            throw new base_1.source_config_error('missing deps: npm install @octokit/rest', this.name);
        }
        const token = creds.token || process.env.GITHUB_TOKEN;
        if (!token) {
            throw new base_1.source_config_error('no credentials: set GITHUB_TOKEN', this.name);
        }
        this.octokit = new Octokit({ auth: token });
        return true;
    }
    async _list_items(filters) {
        if (!filters.repo) {
            throw new base_1.source_config_error('repo is required (format: owner/repo)', this.name);
        }
        const [owner, repo] = filters.repo.split('/');
        const path = filters.path?.replace(/^\//, '') || '';
        const include_issues = filters.include_issues || false;
        const results = [];
        // list files
        try {
            const resp = await this.octokit.repos.getContent({ owner, repo, path });
            const contents = Array.isArray(resp.data) ? resp.data : [resp.data];
            for (const content of contents) {
                results.push({
                    id: `${filters.repo}:${content.path}`,
                    name: content.name,
                    type: content.type === 'dir' ? 'dir' : content.encoding || 'file',
                    path: content.path,
                    size: content.size || 0,
                    sha: content.sha
                });
            }
        }
        catch (e) {
            console.warn(`[github] failed to list ${path}: ${e.message}`);
        }
        // list issues if requested
        if (include_issues) {
            try {
                const resp = await this.octokit.issues.listForRepo({ owner, repo, state: 'all', per_page: 50 });
                for (const issue of resp.data) {
                    results.push({
                        id: `${filters.repo}:issue:${issue.number}`,
                        name: issue.title,
                        type: 'issue',
                        number: issue.number,
                        state: issue.state,
                        labels: issue.labels.map((l) => l.name)
                    });
                }
            }
            catch (e) {
                console.warn(`[github] failed to list issues: ${e.message}`);
            }
        }
        return results;
    }
    async _fetch_item(item_id) {
        const parts = item_id.split(':');
        const repo_full = parts[0];
        const [owner, repo] = repo_full.split('/');
        // issue
        if (parts.length >= 3 && parts[1] === 'issue') {
            const issue_num = parseInt(parts[2]);
            const issue = await this.octokit.issues.get({ owner, repo, issue_number: issue_num });
            const comments = await this.octokit.issues.listComments({ owner, repo, issue_number: issue_num });
            const text_parts = [
                `# ${issue.data.title}`,
                `**State:** ${issue.data.state}`,
                `**Labels:** ${issue.data.labels.map((l) => l.name).join(', ')}`,
                '',
                issue.data.body || ''
            ];
            for (const comment of comments.data) {
                text_parts.push(`\n---\n**${comment.user?.login}:** ${comment.body}`);
            }
            const text = text_parts.join('\n');
            return {
                id: item_id,
                name: issue.data.title,
                type: 'issue',
                text,
                data: text,
                meta: { source: 'github', repo: repo_full, issue_number: issue_num, state: issue.data.state }
            };
        }
        // file
        const path = parts.slice(1).join(':');
        const resp = await this.octokit.repos.getContent({ owner, repo, path });
        if (Array.isArray(resp.data)) {
            const text = resp.data.map((c) => `- ${c.path}`).join('\n');
            return {
                id: item_id,
                name: path || repo_full,
                type: 'directory',
                text,
                data: text,
                meta: { source: 'github', repo: repo_full, path }
            };
        }
        const content = resp.data;
        let text = '';
        let data = '';
        if (content.content) {
            data = Buffer.from(content.content, 'base64');
            try {
                text = data.toString('utf-8');
            }
            catch { }
        }
        return {
            id: item_id,
            name: content.name,
            type: content.encoding || 'file',
            text,
            data,
            meta: { source: 'github', repo: repo_full, path: content.path, sha: content.sha, size: content.size }
        };
    }
}
exports.github_source = github_source;
