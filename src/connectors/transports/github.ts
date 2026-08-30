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
 *  file  : src/connectors/transports/github.ts
 *  usage : implements the LongMemory github component
 */

import { connector_transport, type connector_transport_options, connector_transport_error } from './base.js';
import { extract_text } from './extractors/file_analysis.js';
import type { file_analysis, source_capability, source_context, source_document, source_item, source_item_kind, source_page, source_query } from './types.js';

type json = Record<string, any>;

export type github_transport_options = connector_transport_options & {
    owner: string;
    repo: string;
    ref?: string;
    base_url?: string;
    token?: string;
    include_file_history?: boolean;
    max_file_history?: number;
};

export type github_repository_snapshot = {
    repository: Record<string, unknown>;
    languages: Record<string, number>;
    branches: source_item[];
    tags: source_item[];
    releases: source_item[];
    contributors: Array<Record<string, unknown>>;
    files: source_item[];
    file_analyses: Record<string, file_analysis>;
    totals: {
        files: number;
        bytes: number;
        languages: number;
        branches: number;
        tags: number;
        releases: number;
        contributors: number;
    };
    rate_limit: Record<string, unknown>;
};

type cache_entry = { etag: string | null; data: unknown };

const encode_path = (value: string) => value.split('/').map(encodeURIComponent).join('/');
const clean_text = (value: unknown) => typeof value === 'string' ? value : '';

export class github_transport extends connector_transport {
    readonly id = 'github';
    readonly display_name = 'GitHub';
    readonly capabilities: readonly source_capability[] = ['list', 'fetch', 'search', 'changes', 'repositories', 'files', 'issues', 'pulls', 'commits', 'releases'];
    readonly owner: string;
    readonly repo: string;
    readonly ref: string;
    private readonly base_url: string;
    private readonly configured_token: string | undefined;
    private readonly include_file_history: boolean;
    private readonly max_file_history: number;
    private readonly cache = new Map<string, cache_entry>();
    private repository_cache: json | null = null;
    private rate_limit: Record<string, unknown> = {};

    constructor(options: github_transport_options) {
        super(options);
        if (!options.owner?.trim() || !options.repo?.trim()) throw new connector_transport_error('invalid_config', 'GitHub owner and repo are required', this.id);
        this.owner = options.owner.trim();
        this.repo = options.repo.trim();
        this.ref = options.ref?.trim() || 'HEAD';
        this.base_url = (options.base_url ?? 'https://api.github.com').replace(/\/$/, '');
        this.configured_token = options.token;
        this.include_file_history = options.include_file_history ?? true;
        this.max_file_history = Math.max(1, Math.min(100, options.max_file_history ?? 20));
    }

    protected async on_connect(context: source_context): Promise<void> {
        await this.repository(context);
    }

    protected async list_items(query: source_query, context: source_context): Promise<source_page> {
        const kinds = new Set<source_item_kind>(query.kinds?.length ? query.kinds : ['file']);
        const items: source_item[] = [];
        let next_cursor: string | null = null;
        if (kinds.has('repository')) items.push(this.repository_item(await this.repository(context)));
        if (kinds.has('file') || kinds.has('directory')) {
            const tree = await this.repository_tree(context);
            for (const entry of tree) {
                if (entry.kind === 'file' && !kinds.has('file')) continue;
                if (entry.kind === 'directory' && !kinds.has('directory')) continue;
                if (query.path && !entry.path?.startsWith(query.path.replace(/^\//, ''))) continue;
                if (query.search && !`${entry.path} ${entry.name}`.toLowerCase().includes(query.search.toLowerCase())) continue;
                items.push(entry);
            }
        }
        const paged_kinds: Array<[source_item_kind, string]> = [
            ['issue', 'issues'],
            ['pull_request', 'pulls'],
            ['commit', 'commits'],
            ['release', 'releases'],
        ];
        for (const [kind, endpoint] of paged_kinds) {
            if (!kinds.has(kind)) continue;
            const page = await this.list_endpoint(kind, endpoint, query, context);
            items.push(...page.items);
            next_cursor = page.next_cursor ?? next_cursor;
        }
        const limit = Math.max(1, query.limit ?? (items.length || 1));
        return {
            items: items.slice(0, limit),
            next_cursor: items.length > limit ? String(limit) : next_cursor,
            total: items.length,
            metadata: { owner: this.owner, repo: this.repo, ref: this.ref, rate_limit: this.rate_limit },
        };
    }

    protected async fetch_item(item_id: string, context: source_context): Promise<source_document> {
        const parsed = this.parse_id(item_id);
        if (parsed.kind === 'file') return this.fetch_file(parsed.key, context);
        if (parsed.kind === 'repository') return this.fetch_repository(context);
        if (parsed.kind === 'issue') return this.fetch_issue(Number(parsed.key), context);
        if (parsed.kind === 'pull_request') return this.fetch_pull(Number(parsed.key), context);
        if (parsed.kind === 'commit') return this.fetch_commit(parsed.key, context);
        if (parsed.kind === 'release') return this.fetch_release(Number(parsed.key), context);
        throw new connector_transport_error('unsupported_item', `GitHub item cannot be fetched: ${item_id}`, this.id);
    }

    async inspect_repository(options: { analyze_files?: boolean; max_files?: number; signal?: AbortSignal } = {}): Promise<github_repository_snapshot> {
        const context = { signal: options.signal };
        const repository = await this.repository(context);
        const [languages, branches_raw, tags_raw, releases_raw, contributors] = await Promise.all([
            this.api_json(`/repos/${this.slug()}/languages`, {}, context) as Promise<json>,
            this.api_all(`/repos/${this.slug()}/branches`, context),
            this.api_all(`/repos/${this.slug()}/tags`, context),
            this.api_all(`/repos/${this.slug()}/releases`, context),
            this.api_all(`/repos/${this.slug()}/contributors`, context),
        ]);
        const files = (await this.repository_tree(context)).filter((item) => item.kind === 'file');
        const analyses: Record<string, file_analysis> = {};
        if (options.analyze_files) {
            const selected = files.slice(0, Math.max(1, options.max_files ?? files.length));
            for (const item of selected) {
                try {
                    const document = await this.fetch(item.id, context);
                    if (document.analysis && item.path) analyses[item.path] = document.analysis;
                } catch (error) {
                    analyses[item.path ?? item.id] = {
                        language: 'Unknown', extension: '', role: 'unknown', binary: true, generated: false, minified: false,
                        line_count: 0, code_lines: 0, comment_lines: 0, blank_lines: 0, byte_count: item.size ?? 0, char_count: 0,
                        sha256: '', imports: [], exports: [], dependencies: [], symbols: [], headings: [],
                        metadata: { analysis_error: error instanceof Error ? error.message : String(error) },
                    };
                }
            }
        }
        const branches = branches_raw.map((item) => this.ref_item('branch', item));
        const tags = tags_raw.map((item) => this.ref_item('tag', item));
        const releases = releases_raw.map((item) => this.release_item(item));
        return {
            repository: this.repository_metadata(repository),
            languages: Object.fromEntries(Object.entries(languages).map(([key, value]) => [key, Number(value)])),
            branches,
            tags,
            releases,
            contributors: contributors.map((item) => ({ login: item.login, id: item.id, contributions: item.contributions, type: item.type, avatar_url: item.avatar_url, html_url: item.html_url })),
            files,
            file_analyses: analyses,
            totals: {
                files: files.length,
                bytes: files.reduce((sum, item) => sum + (item.size ?? 0), 0),
                languages: Object.keys(languages).length,
                branches: branches.length,
                tags: tags.length,
                releases: releases.length,
                contributors: contributors.length,
            },
            rate_limit: this.rate_limit,
        };
    }

    private async repository(context: source_context): Promise<json> {
        if (this.repository_cache) return this.repository_cache;
        this.repository_cache = await this.api_json(`/repos/${this.slug()}`, {}, context) as json;
        return this.repository_cache;
    }

    private async repository_tree(context: source_context): Promise<source_item[]> {
        const repository = await this.repository(context);
        const ref = this.ref === 'HEAD' ? repository.default_branch : this.ref;
        const tree = await this.api_json(`/repos/${this.slug()}/git/trees/${encodeURIComponent(ref)}?recursive=1`, {}, context) as json;
        if (tree.truncated) return this.walk_contents('', ref, context);
        return (Array.isArray(tree.tree) ? tree.tree : []).map((entry: json) => this.tree_item(entry, ref));
    }

    private async walk_contents(path: string, ref: string, context: source_context): Promise<source_item[]> {
        const endpoint = `/repos/${this.slug()}/contents/${encode_path(path)}?ref=${encodeURIComponent(ref)}`;
        const values = await this.api_json(endpoint, {}, context) as json[] | json;
        const entries = Array.isArray(values) ? values : [values];
        const items: source_item[] = [];
        for (const entry of entries) {
            const kind = entry.type === 'dir' ? 'directory' : 'file';
            const item = this.tree_item({ path: entry.path, type: entry.type === 'dir' ? 'tree' : 'blob', sha: entry.sha, size: entry.size, mode: null, url: entry.url }, ref);
            items.push(item);
            if (kind === 'directory') items.push(...await this.walk_contents(entry.path, ref, context));
        }
        return items;
    }

    private async list_endpoint(kind: source_item_kind, endpoint: string, query: source_query, context: source_context): Promise<source_page> {
        const page = Number(query.cursor ?? 1);
        const limit = Math.max(1, Math.min(100, query.limit ?? 100));
        const params = new URLSearchParams({ per_page: String(limit), page: String(page) });
        if (query.since && endpoint === 'commits') params.set('since', query.since);
        if (query.search && (endpoint === 'issues' || endpoint === 'pulls')) params.set('state', 'all');
        const values = await this.api_json(`/repos/${this.slug()}/${endpoint}?${params}`, {}, context) as json[];
        const filtered = values
            .filter((item) => endpoint !== 'issues' || !item.pull_request)
            .filter((item) => !query.search || JSON.stringify([item.title, item.body, item.message, item.commit?.message]).toLowerCase().includes(query.search.toLowerCase()));
        const items = filtered.map((item) => kind === 'issue' ? this.issue_item(item) : kind === 'pull_request' ? this.pull_item(item) : kind === 'commit' ? this.commit_item(item) : this.release_item(item));
        return { items, next_cursor: values.length === limit ? String(page + 1) : null, total: null, metadata: { page, rate_limit: this.rate_limit } };
    }

    private async fetch_file(path: string, context: source_context): Promise<source_document> {
        const repository = await this.repository(context);
        const ref = this.ref === 'HEAD' ? repository.default_branch : this.ref;
        const content = await this.api_json(`/repos/${this.slug()}/contents/${encode_path(path)}?ref=${encodeURIComponent(ref)}`, {}, context) as json;
        if (content.type !== 'file') throw new connector_transport_error('not_file', `GitHub path is not a file: ${path}`, this.id);
        let data: Uint8Array;
        if (content.content && content.encoding === 'base64') data = Buffer.from(content.content.replace(/\s/g, ''), 'base64');
        else {
            const response = await this.request(content.download_url, { headers: this.headers('application/octet-stream') }, context);
            data = new Uint8Array(await response.arrayBuffer());
        }
        const extracted = extract_text(path, data, null);
        const history = this.include_file_history
            ? await this.api_json(`/repos/${this.slug()}/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(ref)}&per_page=${this.max_file_history}`, {}, context) as json[]
            : [];
        const item = this.tree_item({ path, type: 'blob', sha: content.sha, size: content.size, mode: null, url: content.git_url }, ref);
        return {
            item,
            text: extracted.text,
            data,
            analysis: extracted.analysis,
            metadata: {
                repository: this.repository_metadata(repository),
                ref,
                html_url: content.html_url,
                download_url: content.download_url,
                git_url: content.git_url,
                api_url: content.url,
                commit_history: history.map((entry) => ({ sha: entry.sha, message: entry.commit?.message, author: entry.commit?.author, committer: entry.commit?.committer, html_url: entry.html_url, verified: entry.commit?.verification?.verified ?? null })),
                rate_limit: this.rate_limit,
            },
        };
    }

    private async fetch_repository(context: source_context): Promise<source_document> {
        const snapshot = await this.inspect_repository({ signal: context.signal });
        const repository = await this.repository(context);
        const text = [
            `# ${repository.full_name}`,
            clean_text(repository.description),
            `Default branch: ${repository.default_branch}`,
            `Languages: ${Object.keys(snapshot.languages).join(', ')}`,
            `Topics: ${(repository.topics ?? []).join(', ')}`,
            `Files: ${snapshot.totals.files}`,
            `Open issues: ${repository.open_issues_count}`,
        ].filter(Boolean).join('\n\n');
        return { item: this.repository_item(repository), text, data: Buffer.from(text), analysis: null, metadata: snapshot as unknown as Record<string, unknown> };
    }

    private async fetch_issue(number: number, context: source_context): Promise<source_document> {
        const [issue, comments, events] = await Promise.all([
            this.api_json(`/repos/${this.slug()}/issues/${number}`, {}, context) as Promise<json>,
            this.api_all(`/repos/${this.slug()}/issues/${number}/comments`, context),
            this.api_all(`/repos/${this.slug()}/issues/${number}/events`, context),
        ]);
        const text = [`# ${issue.title}`, issue.body ?? '', ...comments.map((item) => `## ${item.user?.login ?? 'unknown'}\n${item.body ?? ''}`)].join('\n\n');
        return { item: this.issue_item(issue), text, data: Buffer.from(text), analysis: null, metadata: { issue, comments, events, rate_limit: this.rate_limit } };
    }

    private async fetch_pull(number: number, context: source_context): Promise<source_document> {
        const [pull, files, reviews, comments, commits] = await Promise.all([
            this.api_json(`/repos/${this.slug()}/pulls/${number}`, {}, context) as Promise<json>,
            this.api_all(`/repos/${this.slug()}/pulls/${number}/files`, context),
            this.api_all(`/repos/${this.slug()}/pulls/${number}/reviews`, context),
            this.api_all(`/repos/${this.slug()}/pulls/${number}/comments`, context),
            this.api_all(`/repos/${this.slug()}/pulls/${number}/commits`, context),
        ]);
        const text = [`# ${pull.title}`, pull.body ?? '', `Base: ${pull.base?.label} <- Head: ${pull.head?.label}`, `Files: ${files.length}`, ...reviews.map((item) => `## Review by ${item.user?.login ?? 'unknown'} (${item.state})\n${item.body ?? ''}`)].join('\n\n');
        return { item: this.pull_item(pull), text, data: Buffer.from(text), analysis: null, metadata: { pull, files, reviews, comments, commits, rate_limit: this.rate_limit } };
    }

    private async fetch_commit(sha: string, context: source_context): Promise<source_document> {
        const commit = await this.api_json(`/repos/${this.slug()}/commits/${encodeURIComponent(sha)}`, {}, context) as json;
        const text = [`# ${commit.commit?.message ?? sha}`, `Author: ${commit.commit?.author?.name ?? commit.author?.login ?? 'unknown'}`, ...(commit.files ?? []).map((file: json) => `- ${file.status} ${file.filename} (+${file.additions}/-${file.deletions})`)].join('\n');
        return { item: this.commit_item(commit), text, data: Buffer.from(text), analysis: null, metadata: { commit, rate_limit: this.rate_limit } };
    }

    private async fetch_release(id: number, context: source_context): Promise<source_document> {
        const release = await this.api_json(`/repos/${this.slug()}/releases/${id}`, {}, context) as json;
        const text = [`# ${release.name || release.tag_name}`, release.body ?? '', ...(release.assets ?? []).map((asset: json) => `- ${asset.name} (${asset.size} bytes, ${asset.download_count} downloads)`) ].join('\n\n');
        return { item: this.release_item(release), text, data: Buffer.from(text), analysis: null, metadata: { release, rate_limit: this.rate_limit } };
    }

    private async api_all(path: string, context: source_context): Promise<json[]> {
        const out: json[] = [];
        for (let page = 1; page <= 100; page++) {
            const separator = path.includes('?') ? '&' : '?';
            const values = await this.api_json(`${path}${separator}per_page=100&page=${page}`, {}, context) as json[];
            out.push(...values);
            if (values.length < 100) break;
        }
        return out;
    }

    private async api_json(path: string, init: RequestInit, context: source_context): Promise<unknown> {
        const url = `${this.base_url}${path}`;
        const cached = this.cache.get(url);
        const headers = this.headers();
        if (cached?.etag) headers['if-none-match'] = cached.etag;
        const response = await this.request(url, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } }, context);
        this.rate_limit = {
            limit: Number(response.headers.get('x-ratelimit-limit')) || null,
            remaining: Number(response.headers.get('x-ratelimit-remaining')) || null,
            used: Number(response.headers.get('x-ratelimit-used')) || null,
            reset_at: response.headers.get('x-ratelimit-reset') ? new Date(Number(response.headers.get('x-ratelimit-reset')) * 1_000).toISOString() : null,
            resource: response.headers.get('x-ratelimit-resource'),
        };
        if (response.status === 304 && cached) return cached.data;
        const data = await response.json() as unknown;
        this.cache.set(url, { etag: response.headers.get('etag'), data });
        return data;
    }

    private headers(accept = 'application/vnd.github+json'): Record<string, string> {
        const token = this.configured_token ?? this.credential('token', ['GITHUB_TOKEN', 'GH_TOKEN']);
        return {
            accept,
            'x-github-api-version': '2022-11-28',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
        };
    }

    private slug(): string {
        return `${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}`;
    }

    private make_id(kind: source_item_kind, key: string): string {
        return `github:${this.owner}/${this.repo}:${kind}:${encodeURIComponent(key)}`;
    }

    private parse_id(id: string): { kind: source_item_kind; key: string } {
        const prefix = `github:${this.owner}/${this.repo}:`;
        if (!id.startsWith(prefix)) throw new connector_transport_error('invalid_item_id', `item does not belong to ${this.owner}/${this.repo}: ${id}`, this.id);
        const rest = id.slice(prefix.length);
        const separator = rest.indexOf(':');
        if (separator < 0) throw new connector_transport_error('invalid_item_id', `malformed GitHub item id: ${id}`, this.id);
        return { kind: rest.slice(0, separator) as source_item_kind, key: decodeURIComponent(rest.slice(separator + 1)) };
    }

    private tree_item(entry: json, ref: string): source_item {
        const path = clean_text(entry.path);
        const kind: source_item_kind = entry.type === 'tree' ? 'directory' : 'file';
        return { id: this.make_id(kind, path), source: this.id, kind, name: path.split('/').pop() ?? path, uri: `https://github.com/${this.owner}/${this.repo}/${kind === 'file' ? 'blob' : 'tree'}/${encodeURIComponent(ref)}/${path.split('/').map(encodeURIComponent).join('/')}`, path, mime_type: null, size: typeof entry.size === 'number' ? entry.size : null, created_at: null, updated_at: null, etag: entry.sha ?? null, metadata: { sha: entry.sha, mode: entry.mode, git_type: entry.type, api_url: entry.url, ref } };
    }

    private repository_item(value: json): source_item {
        return { id: this.make_id('repository', value.id?.toString() ?? value.full_name), source: this.id, kind: 'repository', name: value.full_name, uri: value.html_url, path: null, mime_type: null, size: Number(value.size ?? 0) * 1_024, created_at: value.created_at ?? null, updated_at: value.updated_at ?? null, etag: value.node_id ?? null, metadata: this.repository_metadata(value) };
    }

    private repository_metadata(value: json): Record<string, unknown> {
        return {
            id: value.id, node_id: value.node_id, full_name: value.full_name, description: value.description, private: value.private,
            fork: value.fork, archived: value.archived, disabled: value.disabled, visibility: value.visibility, default_branch: value.default_branch,
            language: value.language, topics: value.topics ?? [], license: value.license, owner: value.owner, homepage: value.homepage,
            forks: value.forks_count, stars: value.stargazers_count, watchers: value.subscribers_count, open_issues: value.open_issues_count,
            network_count: value.network_count, has_issues: value.has_issues, has_projects: value.has_projects, has_wiki: value.has_wiki,
            has_pages: value.has_pages, has_discussions: value.has_discussions, security_and_analysis: value.security_and_analysis,
            clone_url: value.clone_url, ssh_url: value.ssh_url, git_url: value.git_url, pushed_at: value.pushed_at,
        };
    }

    private issue_item(value: json): source_item {
        return { id: this.make_id('issue', String(value.number)), source: this.id, kind: 'issue', name: value.title, uri: value.html_url, path: null, mime_type: 'text/markdown', size: clean_text(value.body).length, created_at: value.created_at ?? null, updated_at: value.updated_at ?? null, etag: value.node_id ?? null, metadata: { number: value.number, state: value.state, state_reason: value.state_reason, labels: value.labels ?? [], assignees: value.assignees ?? [], milestone: value.milestone, author: value.user, comments: value.comments, locked: value.locked, reactions: value.reactions } };
    }

    private pull_item(value: json): source_item {
        return { id: this.make_id('pull_request', String(value.number)), source: this.id, kind: 'pull_request', name: value.title, uri: value.html_url, path: null, mime_type: 'text/markdown', size: clean_text(value.body).length, created_at: value.created_at ?? null, updated_at: value.updated_at ?? null, etag: value.node_id ?? null, metadata: { number: value.number, state: value.state, draft: value.draft, merged: value.merged, mergeable: value.mergeable, labels: value.labels ?? [], requested_reviewers: value.requested_reviewers ?? [], base: value.base, head: value.head, additions: value.additions, deletions: value.deletions, changed_files: value.changed_files, commits: value.commits, comments: value.comments, review_comments: value.review_comments } };
    }

    private commit_item(value: json): source_item {
        const sha = value.sha ?? value.commit?.tree?.sha;
        return { id: this.make_id('commit', sha), source: this.id, kind: 'commit', name: clean_text(value.commit?.message).split('\n')[0] || sha, uri: value.html_url, path: null, mime_type: 'text/plain', size: null, created_at: value.commit?.author?.date ?? null, updated_at: value.commit?.committer?.date ?? null, etag: sha, metadata: { sha, message: value.commit?.message, author: value.author ?? value.commit?.author, committer: value.committer ?? value.commit?.committer, parents: value.parents ?? [], verification: value.commit?.verification, stats: value.stats } };
    }

    private release_item(value: json): source_item {
        return { id: this.make_id('release', String(value.id)), source: this.id, kind: 'release', name: value.name || value.tag_name, uri: value.html_url, path: null, mime_type: 'text/markdown', size: clean_text(value.body).length, created_at: value.created_at ?? null, updated_at: value.published_at ?? null, etag: value.node_id ?? null, metadata: { id: value.id, tag_name: value.tag_name, target_commitish: value.target_commitish, draft: value.draft, prerelease: value.prerelease, author: value.author, assets: value.assets ?? [], reactions: value.reactions } };
    }

    private ref_item(kind: 'branch' | 'tag', value: json): source_item {
        const name = value.name;
        return { id: this.make_id('record', `${kind}:${name}`), source: this.id, kind: 'record', name, uri: `https://github.com/${this.owner}/${this.repo}/tree/${encodeURIComponent(name)}`, path: null, mime_type: null, size: null, created_at: null, updated_at: null, etag: value.commit?.sha ?? null, metadata: { ref_kind: kind, commit: value.commit, protected: value.protected ?? null, protection: value.protection ?? null, tarball_url: value.tarball_url, zipball_url: value.zipball_url } };
    }
}