"use strict";
/**
 * notion source for openmemory - production grade
 * requires: @notionhq/client
 * env vars: NOTION_API_KEY
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
exports.notion_source = void 0;
const base_1 = require("./base");
class notion_source extends base_1.base_source {
    name = 'notion';
    client = null;
    async _connect(creds) {
        let Client;
        try {
            Client = await Promise.resolve().then(() => __importStar(require('@notionhq/client'))).then(m => m.Client);
        }
        catch {
            throw new base_1.source_config_error('missing deps: npm install @notionhq/client', this.name);
        }
        const api_key = creds.api_key || process.env.NOTION_API_KEY;
        if (!api_key) {
            throw new base_1.source_config_error('no credentials: set NOTION_API_KEY', this.name);
        }
        this.client = new Client({ auth: api_key });
        return true;
    }
    extract_title(page) {
        const props = page.properties || {};
        for (const prop of Object.values(props)) {
            if (prop.type === 'title' && prop.title?.[0]) {
                return prop.title[0].plain_text || '';
            }
        }
        return '';
    }
    async _list_items(filters) {
        const results = [];
        if (filters.database_id) {
            let has_more = true;
            let start_cursor;
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
        }
        else {
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
    block_to_text(block) {
        const texts = [];
        const type = block.type;
        const text_blocks = ['paragraph', 'heading_1', 'heading_2', 'heading_3',
            'bulleted_list_item', 'numbered_list_item', 'quote', 'callout'];
        if (text_blocks.includes(type)) {
            const rich_text = block[type]?.rich_text || [];
            for (const rt of rich_text) {
                texts.push(rt.plain_text || '');
            }
        }
        else if (type === 'code') {
            const rich_text = block.code?.rich_text || [];
            const lang = block.code?.language || '';
            const code = rich_text.map((rt) => rt.plain_text || '').join('');
            texts.push(`\`\`\`${lang}\n${code}\n\`\`\``);
        }
        else if (type === 'to_do') {
            const checked = block.to_do?.checked || false;
            const rich_text = block.to_do?.rich_text || [];
            const prefix = checked ? '[x] ' : '[ ] ';
            texts.push(prefix + rich_text.map((rt) => rt.plain_text || '').join(''));
        }
        return texts.join('');
    }
    async _fetch_item(item_id) {
        const page = await this.client.pages.retrieve({ page_id: item_id });
        const title = this.extract_title(page);
        // get all blocks
        const blocks = [];
        let has_more = true;
        let start_cursor;
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
            if (txt.trim())
                text_parts.push(txt);
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
exports.notion_source = notion_source;
