/**
 * notion source for openmemory - production grade
 * requires: @notionhq/client
 * env vars: NOTION_API_KEY
 */

import { base_source, source_config_error, source_item, source_content } from './base';

export class notion_source extends base_source {
    name = 'notion';
    private client: any = null;

    async _connect(creds: Record<string, any>): Promise<boolean> {
        let Client: any;
        try {
            Client = await import('@notionhq/client').then(m => m.Client);
        } catch {
            throw new source_config_error('missing deps: npm install @notionhq/client', this.name);
        }

        const api_key = creds.api_key || process.env.NOTION_API_KEY;

        if (!api_key) {
            throw new source_config_error('no credentials: set NOTION_API_KEY', this.name);
        }

        this.client = new Client({ auth: api_key });
        return true;
    }

    private extract_title(page: any): string {
        const props = page.properties || {};
        for (const prop of Object.values(props) as any[]) {
            if (prop.type === 'title' && prop.title?.[0]) {
                return prop.title[0].plain_text || '';
            }
        }
        return '';
    }

    async _list_items(filters: Record<string, any>): Promise<source_item[]> {
        const results: source_item[] = [];

        if (filters.database_id) {
            let has_more = true;
            let start_cursor: string | undefined;

            while (has_more) {
                const resp = await this.client.databases.query({
                    database_id: filters.database_id,
                    start_cursor
                });

                for (const page of resp.results) {
                    results.push({
                        id: page.id,
                        name: this.extract_title(page) || 'Untitled',
                        type: 'page',
                        url: page.url || '',
                        last_edited: page.last_edited_time
                    });
                }

                has_more = resp.has_more;
                start_cursor = resp.next_cursor;
            }
        } else {
            const resp = await this.client.search({ filter: { property: 'object', value: 'page' } });

            for (const page of resp.results) {
                results.push({
                    id: page.id,
                    name: this.extract_title(page) || 'Untitled',
                    type: 'page',
                    url: page.url || '',
                    last_edited: page.last_edited_time
                });
            }
        }

        return results;
    }

    private block_to_text(block: any): string {
        const texts: string[] = [];
        const type = block.type;

        const text_blocks = ['paragraph', 'heading_1', 'heading_2', 'heading_3',
            'bulleted_list_item', 'numbered_list_item', 'quote', 'callout'];

        if (text_blocks.includes(type)) {
            const rich_text = block[type]?.rich_text || [];
            for (const rt of rich_text) {
                texts.push(rt.plain_text || '');
            }
        } else if (type === 'code') {
            const rich_text = block.code?.rich_text || [];
            const lang = block.code?.language || '';
            const code = rich_text.map((rt: any) => rt.plain_text || '').join('');
            texts.push(`\`\`\`${lang}\n${code}\n\`\`\``);
        } else if (type === 'to_do') {
            const checked = block.to_do?.checked || false;
            const rich_text = block.to_do?.rich_text || [];
            const prefix = checked ? '[x] ' : '[ ] ';
            texts.push(prefix + rich_text.map((rt: any) => rt.plain_text || '').join(''));
        }

        return texts.join('');
    }

    async _fetch_item(item_id: string): Promise<source_content> {
        const page = await this.client.pages.retrieve({ page_id: item_id });
        const title = this.extract_title(page);


        const blocks: any[] = [];
        let has_more = true;
        let start_cursor: string | undefined;

        while (has_more) {
            const resp = await this.client.blocks.children.list({
                block_id: item_id,
                start_cursor
            });
            blocks.push(...resp.results);
            has_more = resp.has_more;
            start_cursor = resp.next_cursor;
        }

        const text_parts = title ? [`# ${title}`] : [];

        for (const block of blocks) {
            const txt = this.block_to_text(block);
            if (txt.trim()) text_parts.push(txt);
        }

        const text = text_parts.join('\n\n');

        return {
            id: item_id,
            name: title || 'Untitled',
            type: 'notion_page',
            text,
            data: text,
            meta: { source: 'notion', page_id: item_id, url: page.url || '', block_count: blocks.length }
        };
    }
}
