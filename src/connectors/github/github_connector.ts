/*
 *   _____                 ___  ___
 *  |  _  |                |  \/  |
 *  | | | |_ __   ___ _ __ | .  . | ___ _ __ ___   ___  _ __ _   _
 *  | | | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 *  \ \_/ / |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
 *   \___/| .__/ \___|_| |_\_|  |_/\___|_| |_| |_|\___/|_|   \__, |
 *        | |                                                 __/ |
 *        |_|                                                |___/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/connectors/github/github_connector.ts
 *  usage : real GitHub Hydrograph connector
 */

import type { connector_list_params } from '../../core/connectors/connector.js';
import type { SourceRef } from '../../core/connectors/source_document.js';
import type { connector_map_context, ConnectorSyncItem, HydrographImportPlan } from '../../core/connectors/source_event.js';
import { github_transport, type github_repository_snapshot, type github_transport_options } from '../transports/github.js';
import { adapter_connector } from '../adapter_connector.js';
import { map_github_to_hydrograph } from './github_mapper.js';

export class github_connector extends adapter_connector {
    readonly id = 'github';
    readonly name = 'GitHub';
    readonly source_type = 'github';
    private readonly repository_name: string;
    private readonly github: github_transport;

    constructor(options: github_transport_options) {
        const github = new github_transport(options);
        super(github);
        this.github = github;
        this.repository_name = `${options.owner}/${options.repo}`;
    }

    inspectRepository(options: { analyze_files?: boolean; max_files?: number; signal?: AbortSignal } = {}): Promise<github_repository_snapshot> {
        return this.github.inspect_repository(options);
    }

    listSources(params: connector_list_params = {}): Promise<SourceRef[]> {
        return super.listSources({ ...params, kinds: params.kinds ?? ['repository', 'file', 'issue', 'pull_request', 'commit', 'document'] });
    }

    mapToHydrograph(item: ConnectorSyncItem, context: connector_map_context): Promise<HydrographImportPlan> {
        return map_github_to_hydrograph(this.id, item, context, this.repository_name);
    }
}

export type github_connector_options = github_transport_options;
export type github_connector_snapshot = github_repository_snapshot;