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
 *  file  : src/connectors/domain_mapper.ts
 *  usage : implements the LongMemory domain mapper component
 */

import type { SourceDocument } from '../core/connectors/source_document.js';
import type { connector_map_context, ConnectorSyncItem, HydrographImportPlan } from '../core/connectors/source_event.js';
import { add_update_actions, deletion_plan, edge, empty_plan, hash, node, world } from './plan_helpers.js';

const object = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
const array = (value: unknown): any[] => Array.isArray(value) ? value : [];
const string = (value: unknown, fallback = '') => value === null || value === undefined ? fallback : String(value);

function finish(plan: HydrographImportPlan, item: ConnectorSyncItem, context: connector_map_context, root_key: string, document: SourceDocument): HydrographImportPlan {
    plan.entities_to_resolve.push(...plan.nodes_to_create.flatMap((planned) => planned.entities));
    plan.contracts.push(...plan.nodes_to_create.map((planned) => ({ node_key: planned.key, contract: planned.contract })));
    plan.provenance.push(...plan.nodes_to_create.map((planned) => planned.provenance));
    plan.grounding_refs.push(...plan.nodes_to_create.map((planned) => ({ node_key: planned.key, source: planned.grounding_source, ref: planned.url ?? planned.external_id })));
    if (item.event === 'updated' || item.event === 'permission_changed' || item.event === 'moved' || item.event === 'renamed') {
        add_update_actions(plan, context, root_key, document.external_id, item.recorded_at);
    }
    return plan;
}

export async function map_issue_tracker_to_hydrograph(connector_id: string, item: ConnectorSyncItem, context: connector_map_context): Promise<HydrographImportPlan> {
    if (item.event === 'deleted') return deletion_plan(connector_id, item, context);
    const document = item.document;
    if (!document) throw new Error(`${connector_id} issue item has no document`);
    const payload = object(document.metadata.payload ?? document.metadata);
    const project = string(payload.project?.name ?? payload.project_name ?? payload.team?.name ?? payload.workspace?.name, connector_id);
    const project_key = `project:${project}`;
    const issue_key = `issue:${document.external_id}`;
    const plan = empty_plan(connector_id, item);
    plan.worlds_to_create.push(world(project_key, project, document.created_at ?? item.recorded_at, null, { connector_id, project, issue_tracker: true }, document.permissions));
    const author = string(payload.creator?.displayName ?? payload.creator?.name ?? payload.author?.name ?? payload.creator?.name ?? document.author);
    const assignee = string(payload.assignee?.displayName ?? payload.assignee?.name ?? payload.assignee);
    plan.nodes_to_create.push(node(connector_id, document, issue_key, project_key, document.content || `${document.title}\n${string(payload.description)}`, {
        checksum: document.checksum,
        title: document.title,
        facet: 'semantic',
        entities: [
            { name: project, type: 'project', observed_at: document.updated_at ?? document.fetched_at, metadata: { role: 'issue_project' } },
            ...(author ? [{ name: author, type: 'person' as const, observed_at: document.updated_at ?? document.fetched_at, metadata: { role: 'issue_author' } }] : []),
            ...(assignee ? [{ name: assignee, type: 'person' as const, observed_at: document.updated_at ?? document.fetched_at, metadata: { role: 'issue_assignee' } }] : []),
        ],
        metadata: { issue: true, project, status: payload.status?.name ?? payload.state ?? payload.status, priority: payload.priority, labels: payload.labels ?? [], citation: { url: document.url, external_id: document.external_id, version: document.version } },
    }));
    const comments = Array.isArray(payload.comments)
        ? payload.comments
        : array(payload.comments?.nodes ?? payload.comments?.values);
    comments.forEach((comment, index) => {
        const body = string(comment.body?.content?.[0]?.content?.[0]?.text ?? comment.body ?? comment.text);
        if (!body) return;
        const key = `comment:${comment.id ?? index}`;
        const comment_document = { ...document, external_id: `${document.external_id}:comment:${comment.id ?? index}`, title: `Comment on ${document.title}`, content: body, checksum: hash(body), version: string(comment.updated_at ?? comment.updated ?? comment.id, String(index)), author: string(comment.author?.displayName ?? comment.author?.name ?? comment.user?.name), created_at: Date.parse(comment.created_at ?? comment.created ?? '') || document.created_at, updated_at: Date.parse(comment.updated_at ?? comment.updated ?? '') || document.updated_at };
        plan.nodes_to_create.push(node(connector_id, comment_document, key, project_key, body, { facet: 'semantic', entities: comment_document.author ? [{ name: comment_document.author, type: 'person', observed_at: comment_document.updated_at ?? document.fetched_at }] : [], metadata: { issue_comment: true, issue_external_id: document.external_id } }));
        plan.edges_to_create.push(edge(`contains:${key}`, issue_key, key, 'contains', item.recorded_at));
    });
    const transitions = array(payload.changelog?.histories ?? payload.transitions ?? payload.history);
    transitions.forEach((transition, index) => {
        const text = string(transition.summary ?? transition.toString ?? `${transition.from ?? ''} -> ${transition.to ?? ''}`).trim();
        if (!text) return;
        const key = `transition:${transition.id ?? index}`;
        plan.nodes_to_create.push(node(connector_id, { ...document, external_id: `${document.external_id}:transition:${transition.id ?? index}`, checksum: hash(text), version: string(transition.id, String(index)) }, key, project_key, text, { facet: 'reflective', metadata: { status_transition: true, issue_external_id: document.external_id } }));
        plan.edges_to_create.push(edge(`derived:${key}`, key, issue_key, 'derived_from', item.recorded_at));
    });
    return finish(plan, item, context, issue_key, document);
}

export async function map_chat_to_hydrograph(connector_id: string, item: ConnectorSyncItem, context: connector_map_context): Promise<HydrographImportPlan> {
    if (item.event === 'deleted') return deletion_plan(connector_id, item, context);
    const document = item.document;
    if (!document) throw new Error(`${connector_id} message item has no document`);
    const payload = object(document.metadata.payload ?? document.metadata);
    const workspace = string(payload.workspace_name ?? payload.guild_name ?? payload.team?.name, connector_id);
    const channel = string(payload.channel_name ?? payload.channel?.name, 'messages');
    const workspace_key = `workspace:${workspace}`;
    const channel_key = `channel:${channel}`;
    const message_key = `message:${document.external_id}`;
    const plan = empty_plan(connector_id, item);
    plan.worlds_to_create.push(
        world(workspace_key, workspace, document.created_at ?? item.recorded_at, null, { connector_id, workspace, communication: true }, document.permissions),
        world(channel_key, channel, document.created_at ?? item.recorded_at, workspace_key, { connector_id, workspace, channel }, document.permissions),
    );
    const author = string(payload.author?.display_name ?? payload.author?.username ?? payload.user_name ?? payload.user?.name ?? document.author);
    plan.nodes_to_create.push(node(connector_id, document, message_key, channel_key, document.content, {
        checksum: document.checksum,
        facet: 'semantic',
        entities: author ? [{ name: author, type: 'person', observed_at: document.updated_at ?? document.fetched_at, metadata: { role: 'message_author' } }] : [],
        metadata: { message: true, workspace, channel, thread_id: payload.thread_id ?? payload.thread_ts ?? null, reactions: payload.reactions ?? [], citation: { url: document.url, external_id: document.external_id } },
    }));
    const replies = array(payload.replies ?? payload.thread?.messages);
    replies.forEach((reply, index) => {
        const text = string(reply.content ?? reply.text ?? reply.body);
        if (!text) return;
        const key = `reply:${reply.id ?? reply.ts ?? index}`;
        const reply_author = string(reply.author?.display_name ?? reply.author?.username ?? reply.user_name ?? reply.user?.name);
        plan.nodes_to_create.push(node(connector_id, { ...document, external_id: `${document.external_id}:reply:${reply.id ?? reply.ts ?? index}`, checksum: hash(text), version: string(reply.edited_timestamp ?? reply.ts ?? reply.id, String(index)), author: reply_author || null, created_at: Date.parse(reply.timestamp ?? reply.created_at ?? '') || document.created_at, updated_at: Date.parse(reply.edited_timestamp ?? reply.updated_at ?? '') || document.updated_at }, key, channel_key, text, { facet: 'semantic', entities: reply_author ? [{ name: reply_author, type: 'person', observed_at: document.updated_at ?? document.fetched_at }] : [], metadata: { thread_reply: true, parent_external_id: document.external_id } }));
        plan.edges_to_create.push(edge(`contains:${key}`, message_key, key, 'contains', item.recorded_at));
    });
    return finish(plan, item, context, message_key, document);
}

export async function map_email_to_hydrograph(connector_id: string, item: ConnectorSyncItem, context: connector_map_context): Promise<HydrographImportPlan> {
    if (item.event === 'deleted') return deletion_plan(connector_id, item, context);
    const document = item.document;
    if (!document) throw new Error('email item has no document');
    const payload = object(document.metadata);
    const mailbox = string(payload.mailbox, 'Inbox');
    const thread = string(payload.thread_id ?? payload.references?.[0], document.external_id);
    const mailbox_key = `mailbox:${mailbox}`;
    const thread_key = `thread:${thread}`;
    const message_key = `email:${document.external_id}`;
    const participants = [document.author, ...array(payload.to), ...array(payload.cc)].filter((value): value is string => typeof value === 'string' && Boolean(value));
    const plan = empty_plan(connector_id, item);
    plan.worlds_to_create.push(
        world(mailbox_key, mailbox, document.created_at ?? item.recorded_at, null, { mailbox }, document.permissions),
        world(thread_key, document.title, document.created_at ?? item.recorded_at, mailbox_key, { thread_id: thread }, document.permissions),
    );
    plan.nodes_to_create.push(node(connector_id, document, message_key, thread_key, document.content, { checksum: document.checksum, facet: 'semantic', entities: participants.map((name) => ({ name, type: 'person', observed_at: document.updated_at ?? document.fetched_at, metadata: { role: 'email_participant' } })), metadata: { email: true, mailbox, thread_id: thread, message_id: payload.message_id, attachments: payload.attachments ?? [], citation: { external_id: document.external_id, url: document.url } } }));
    return finish(plan, item, context, message_key, document);
}

export async function map_pdf_to_hydrograph(connector_id: string, item: ConnectorSyncItem, context: connector_map_context): Promise<HydrographImportPlan> {
    if (item.event === 'deleted') return deletion_plan(connector_id, item, context);
    const document = item.document;
    if (!document) throw new Error('PDF item has no document');
    const plan = empty_plan(connector_id, item);
    const world_key = `pdf:${document.external_id}`;
    const root_key = 'pdf';
    plan.worlds_to_create.push(world(world_key, document.title, document.created_at ?? item.recorded_at, null, { pdf: true, version: document.version }, document.permissions));
    plan.nodes_to_create.push(node(connector_id, document, root_key, world_key, `PDF: ${document.title}`, { checksum: document.checksum, facet: 'semantic', metadata: { pdf_root: true, citation: { url: document.url, version: document.version } } }));
    const pages = array(document.metadata.pages);
    pages.forEach((page, index) => {
        const content = string(page.text ?? page.content);
        if (!content) return;
        const number = Number(page.page ?? page.number ?? index + 1);
        const key = `page:${number}`;
        plan.nodes_to_create.push(node(connector_id, { ...document, external_id: `${document.external_id}:page:${number}`, checksum: hash(content), version: `${document.version}:page:${number}` }, key, world_key, content, { facet: 'semantic', metadata: { page: number, headings: page.headings ?? [], citation: { url: document.url, page: number, version: document.version } } }));
        plan.edges_to_create.push(edge(`contains:${key}`, root_key, key, 'contains', item.recorded_at, { page: number }));
    });
    return finish(plan, item, context, root_key, document);
}

export async function map_record_to_hydrograph(connector_id: string, item: ConnectorSyncItem, context: connector_map_context): Promise<HydrographImportPlan> {
    if (item.event === 'deleted') return deletion_plan(connector_id, item, context);
    const document = item.document;
    if (!document) throw new Error(`${connector_id} record has no document`);
    const collection = string(document.metadata.collection ?? document.metadata.table ?? document.metadata.type, connector_id);
    const world_key = `collection:${collection}`;
    const root_key = `record:${document.external_id}`;
    const plan = empty_plan(connector_id, item);
    plan.worlds_to_create.push(world(world_key, collection, document.created_at ?? item.recorded_at, null, { connector_id, collection, record_collection: true }, document.permissions));
    plan.nodes_to_create.push(node(connector_id, document, root_key, world_key, document.content, { checksum: document.checksum, facet: 'semantic', metadata: { record: true, collection, fields: document.metadata.payload ?? document.metadata, citation: { url: document.url, external_id: document.external_id, version: document.version } } }));
    const parent = string(document.metadata.parent_external_id);
    if (parent) {
        const parent_key = `parent:${parent}`;
        plan.nodes_to_create.push(node(connector_id, { ...document, external_id: parent, checksum: hash(parent), version: 'reference', created_at: 1, updated_at: 1, fetched_at: 1 }, parent_key, world_key, `External record: ${parent}`, { checksum: hash(parent), facet: 'semantic', metadata: { reference: true, external_id: parent } }));
        plan.edges_to_create.push(edge(`refers:${parent}`, root_key, parent_key, 'refers_to', item.recorded_at));
    }
    return finish(plan, item, context, root_key, document);
}