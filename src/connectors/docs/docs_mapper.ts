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
 *  file  : src/connectors/docs/docs_mapper.ts
 *  usage : implements the LongMemory docs mapper component
 */


import type { connector_map_context, ConnectorSyncItem, HydrographImportPlan } from '../../core/connectors/source_event.js';
import { add_update_actions, deletion_plan, edge, empty_plan, node, world } from '../plan_helpers.js';
import { parse_markdown_sections } from '../local/markdown_parser.js';

export async function map_docs_to_hydrograph(connector_id: string, item: ConnectorSyncItem, context: connector_map_context): Promise<HydrographImportPlan> {
    if (item.event === 'deleted') return deletion_plan(connector_id, item, context);
    const document = item.document;
    if (!document) throw new Error(`document connector item ${item.id} has no fetched document`);
    const plan = empty_plan(connector_id, item);
    const world_key = `document:${document.external_id}`;
    plan.worlds_to_create.push(world(world_key, document.title, document.created_at ?? item.recorded_at, null, {
        document_id: document.external_id, url: document.url, version: document.version, checksum: document.checksum,
    }, document.permissions));
    const root = node(connector_id, document, 'document', world_key, `Document: ${document.title}`, {
        checksum: document.checksum,
        facet: 'semantic',
        metadata: { document_root: true, citation: { document_id: document.external_id, version: document.version } },
    });
    plan.nodes_to_create.push(root);
    const sections = parse_markdown_sections(document.content);
    for (const section of sections) {
        const key = `section:${section.key}`;
        plan.nodes_to_create.push(node(connector_id, document, key, world_key, section.content, {
            title: section.heading,
            checksum: section.checksum,
            facet: 'semantic',
            metadata: {
                heading: section.heading,
                heading_path: section.path,
                heading_level: section.level,
                start_line: section.start_line,
                end_line: section.end_line,
                citation: { document_id: document.external_id, heading: section.heading, version: document.version },
            },
        }));
        plan.edges_to_create.push(edge(`contains:${key}`, 'document', key, 'contains', item.recorded_at, { heading: section.heading }));
    }
    plan.entities_to_resolve.push(...root.entities);
    plan.contracts.push(...plan.nodes_to_create.map((planned) => ({ node_key: planned.key, contract: planned.contract })));
    plan.provenance.push(...plan.nodes_to_create.map((planned) => planned.provenance));
    plan.grounding_refs.push(...plan.nodes_to_create.map((planned) => ({ node_key: planned.key, source: planned.grounding_source, ref: planned.provenance.url ?? planned.external_id })));
    if (item.event === 'updated' || item.event === 'permission_changed' || item.event === 'moved' || item.event === 'renamed') {
        add_update_actions(plan, context, 'document', document.external_id, item.recorded_at);
    }
    return plan;
}