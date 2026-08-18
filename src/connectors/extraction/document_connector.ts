import type { connector_map_context, ConnectorSyncItem, HydrographImportPlan } from '../../core/connectors/source_event.js';
import { adapter_connector } from '../adapter_connector.js';
import { map_docs_to_hydrograph } from '../docs/docs_mapper.js';
import { map_pdf_to_hydrograph } from '../domain_mapper.js';
import { document_transport, type document_transport_options } from './document_transport.js';

export class document_connector extends adapter_connector {
    readonly id: string;
    readonly name: string;
    readonly source_type: string;

    constructor(options: document_transport_options & { id?: string }) {
        super(new document_transport(options));
        this.id = options.id ?? (options.include === 'pdf' ? 'pdf' : options.include === 'media' ? 'media' : 'document');
        this.name = options.include === 'pdf' ? 'PDF documents' : options.include === 'media' ? 'Audio and video' : 'Documents';
        this.source_type = options.include === 'pdf' ? 'pdf' : options.include === 'media' ? 'media' : 'document';
    }

    mapToHydrograph(item: ConnectorSyncItem, context: connector_map_context): Promise<HydrographImportPlan> {
        return item.document?.metadata.content_type === 'pdf'
            ? map_pdf_to_hydrograph(this.id, item, context)
            : map_docs_to_hydrograph(this.id, item, context);
    }
}