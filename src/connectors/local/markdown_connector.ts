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
 *  file  : src/connectors/local/markdown_connector.ts
 *  usage : Markdown-only local folder connector
 */

import type { connector_list_params } from '../../core/connectors/connector.js';
import type { SourceRef } from '../../core/connectors/source_document.js';
import type { filesystem_transport_options } from '../transports/filesystem.js';
import { local_file_connector } from './local_file_connector.js';

export class markdown_connector extends local_file_connector {
    override readonly id: string = 'markdown';
    override readonly name: string = 'Markdown files';
    override readonly source_type: string = 'markdown';

    constructor(options: filesystem_transport_options) {
        super(options);
    }

    override async listSources(params: connector_list_params = {}): Promise<SourceRef[]> {
        return (await super.listSources(params)).filter((item) => /\.(md|mdx|markdown)$/i.test(String(item.metadata.path ?? item.title)));
    }
}