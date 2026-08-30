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
 *  file  : src/connectors/web/website_connector.ts
 *  usage : implements the LongMemory website connector component
 */

import type { connector_map_context, ConnectorSyncItem, HydrographImportPlan } from '../../core/connectors/source_event.js';
import { adapter_connector } from '../adapter_connector.js';
import { map_docs_to_hydrograph } from '../docs/docs_mapper.js';
import { rss_transport, sitemap_transport, web_transport, type web_transport_options } from '../transports/web.js';

abstract class web_plan_connector extends adapter_connector {
    mapToHydrograph(item: ConnectorSyncItem, context: connector_map_context): Promise<HydrographImportPlan> {
        return map_docs_to_hydrograph(this.id, item, context);
    }
}

export class website_connector extends web_plan_connector {
    readonly id = 'website';
    readonly name = 'Websites';
    readonly source_type = 'website';

    constructor(options: web_transport_options) {
        super(new web_transport({ ...options, id: 'website', display_name: 'Websites' }));
    }
}

export class sitemap_connector extends web_plan_connector {
    readonly id = 'sitemap';
    readonly name = 'XML Sitemap';
    readonly source_type = 'website';

    constructor(options: Omit<web_transport_options, 'urls'> & { sitemap_url: string }) {
        super(new sitemap_transport({ ...options, id: 'sitemap', display_name: 'XML Sitemap' }));
    }
}

export class rss_connector extends web_plan_connector {
    readonly id = 'rss';
    readonly name = 'RSS / Atom';
    readonly source_type = 'feed';

    constructor(options: Omit<web_transport_options, 'urls'> & { feed_url: string }) {
        super(new rss_transport({ ...options, id: 'rss', display_name: 'RSS / Atom' }));
    }
}