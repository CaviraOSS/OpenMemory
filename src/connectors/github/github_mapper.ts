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
 *  file  : src/connectors/github/github_mapper.ts
 *  usage : implements the LongMemory github mapper component
 */


import type { SourceDocument } from '../../core/connectors/source_document.js';
import type { connector_map_context, ConnectorSyncItem, HydrographImportPlan } from '../../core/connectors/source_event.js';
import { add_update_actions, deletion_plan, edge, empty_plan, hash, node, world } from '../plan_helpers.js';

const object = (value: unknown): Record<string, any> => value && typeof value === 'object' ? value as Record<string, any> : {};

function auxiliary(document: SourceDocument, connector_id: string, key: string, content: string, world_key: string, metadata: Record<string, unknown>) {
    const stable_document = { ...document, external_id: `${document.external_id}:${key}`, created_at: 1, updated_at: 1, fetched_at: 1, version: 'reference', checksum: hash(content) };
    return node(connector_id, stable_document, key, world_key, content, { checksum: hash(content), facet: 'semantic', metadata: { reference: true, ...metadata } });
}

export async function map_github_to_hydrograph(connector_id: string, item: ConnectorSyncItem, context: connector_map_context, repository_name: string): Promise<HydrographImportPlan> {
    if (item.event === 'deleted') return deletion_plan(connector_id, item, context);
    const document = item.document;
    if (!document) throw new Error(`GitHub item ${item.id} has no document`);
    const plan = empty_plan(connector_id, item);
    const repo_world = `repository:${repository_name}`;
    plan.worlds_to_create.push(world(repo_world, repository_name, document.created_at ?? item.recorded_at, null, {
        repository: repository_name, source_type: 'github', project_world: true,
    }, document.permissions));
    const source_item = object(document.metadata.source_item);
    const kind = String(source_item.kind ?? item.ref.kind);
    const path = String(source_item.path ?? item.ref.metadata.path ?? '');
    let parent_world: string | null = null;
    if (path.includes('/')) {
        const folders = path.split('/').slice(0, -1);
        folders.forEach((folder, index) => {
            const key = `path:${folders.slice(0, index + 1).join('/')}`;
            plan.worlds_to_create.push(world(key, folder, document.created_at ?? item.recorded_at, parent_world ?? repo_world, {
                repository: repository_name, path: folders.slice(0, index + 1).join('/'), kind: 'directory',
            }, document.permissions));
            parent_world = key;
        });
    }
    const item_world = kind === 'repository' ? repo_world : parent_world ?? repo_world;
    const key = `github:${kind}:${document.external_id}`;
    const facet = kind === 'commit' || kind === 'pull_request' || kind === 'file' ? 'procedural' : 'semantic';
    const main = node(connector_id, document, key, item_world, document.content || `${kind}: ${document.title}`, {
        checksum: document.checksum,
        facet,
        entities: [
            { name: repository_name, type: 'project', observed_at: document.updated_at ?? document.fetched_at, metadata: { role: 'repository' } },
            ...(document.author ? [{ name: document.author, type: 'person' as const, observed_at: document.updated_at ?? document.fetched_at, metadata: { role: 'github_author' } }] : []),
        ],
        metadata: { github_kind: kind, repository: repository_name, branch: source_item.metadata?.ref ?? document.metadata.ref, path, citation: { url: document.url, commit: source_item.metadata?.sha, path } },
    });
    plan.nodes_to_create.push(main);
    const metadata = object(document.metadata);
    if (kind === 'issue') {
        const comments = Array.isArray(metadata.comments) ? metadata.comments : [];
        comments.forEach((comment: any, index: number) => {
            const comment_key = `comment:${comment.id ?? index}`;
            const comment_document = { ...document, external_id: `${document.external_id}:comment:${comment.id ?? index}`, title: `Comment by ${comment.user?.login ?? 'unknown'}`, content: String(comment.body ?? ''), checksum: hash(String(comment.body ?? '')), version: String(comment.updated_at ?? comment.id ?? index), created_at: Date.parse(comment.created_at ?? '') || document.created_at, updated_at: Date.parse(comment.updated_at ?? '') || document.updated_at };
            plan.nodes_to_create.push(node(connector_id, comment_document, comment_key, repo_world, comment_document.content, { facet: 'semantic', metadata: { issue_comment: true, issue: source_item.metadata?.number } }));
            plan.edges_to_create.push(edge(`issue-contains:${comment_key}`, key, comment_key, 'contains', item.recorded_at));
        });
    }
    if (kind === 'pull_request') {
        const pull = object(metadata.pull);
        const body = `${pull.body ?? document.content}`;
        const issue_numbers = [...body.matchAll(/\b(?:fixe[sd]?|close[sd]?|resolve[sd]?)\s+#(\d+)/gi)].map((match) => match[1]);
        for (const issue_number of issue_numbers) {
            const issue_key = `issue-ref:${issue_number}`;
            plan.nodes_to_create.push(auxiliary(document, connector_id, issue_key, `GitHub issue #${issue_number}`, repo_world, { issue_number, repository: repository_name }));
            plan.edges_to_create.push(edge(`pr-fixes:${issue_number}`, key, issue_key, 'supports', item.recorded_at, { relation: 'fixes' }));
        }
    }
    if (kind === 'commit') {
        const commit = object(metadata.commit);
        for (const file of Array.isArray(commit.files) ? commit.files : []) {
            const file_key = `file-ref:${file.filename}`;
            plan.nodes_to_create.push(auxiliary(document, connector_id, file_key, `Repository file: ${file.filename}`, repo_world, { path: file.filename, repository: repository_name }));
            plan.edges_to_create.push(edge(`commit-modifies:${file.filename}`, key, file_key, 'refers_to', item.recorded_at, { relation: 'modifies', additions: file.additions, deletions: file.deletions, status: file.status }));
        }
    }
    if (kind === 'file' && /(^|\/)readme(?:\.[^/]*)?$/i.test(path)) {
        const repo_key = 'repository-description';
        plan.nodes_to_create.push(auxiliary(document, connector_id, repo_key, `Project description for ${repository_name}`, repo_world, { repository: repository_name, project_description: true }));
        plan.edges_to_create.push(edge('readme-grounds-project', repo_key, key, 'grounds', item.recorded_at, { path }));
    }
    plan.entities_to_resolve.push(...plan.nodes_to_create.flatMap((planned) => planned.entities));
    plan.contracts.push(...plan.nodes_to_create.map((planned) => ({ node_key: planned.key, contract: planned.contract })));
    plan.provenance.push(...plan.nodes_to_create.map((planned) => planned.provenance));
    plan.grounding_refs.push(...plan.nodes_to_create.map((planned) => ({ node_key: planned.key, source: planned.grounding_source, ref: planned.url ?? planned.external_id })));
    if (item.event === 'updated' || item.event === 'permission_changed' || item.event === 'renamed' || item.event === 'moved') add_update_actions(plan, context, key, document.external_id, item.recorded_at);
    return plan;
}