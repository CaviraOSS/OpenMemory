"use strict";
/**
 * web crawler source for openmemory - production grade
 * requires: cheerio (for html parsing)
 * no auth required for public urls
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
exports.web_crawler_source = void 0;
const base_1 = require("./base");
class web_crawler_source extends base_1.base_source {
    name = 'web_crawler';
    max_pages;
    max_depth;
    timeout;
    visited = new Set();
    crawled = [];
    constructor(user_id, config) {
        super(user_id, config);
        this.max_pages = config?.max_pages || 50;
        this.max_depth = config?.max_depth || 3;
        this.timeout = config?.timeout || 30000;
    }
    async _connect() {
        return true; // no auth needed
    }
    async _list_items(filters) {
        if (!filters.start_url) {
            throw new base_1.source_config_error('start_url is required', this.name);
        }
        let cheerio;
        try {
            cheerio = await Promise.resolve().then(() => __importStar(require('cheerio')));
        }
        catch {
            throw new base_1.source_config_error('missing deps: npm install cheerio', this.name);
        }
        this.visited.clear();
        this.crawled = [];
        const base_url = new URL(filters.start_url);
        const base_domain = base_url.hostname;
        const to_visit = [{ url: filters.start_url, depth: 0 }];
        const follow_links = filters.follow_links !== false;
        while (to_visit.length > 0 && this.crawled.length < this.max_pages) {
            const { url, depth } = to_visit.shift();
            if (this.visited.has(url) || depth > this.max_depth)
                continue;
            this.visited.add(url);
            try {
                const controller = new AbortController();
                const timeout_id = setTimeout(() => controller.abort(), this.timeout);
                const resp = await fetch(url, {
                    headers: { 'User-Agent': 'OpenMemory-Crawler/1.0 (compatible)' },
                    signal: controller.signal
                });
                clearTimeout(timeout_id);
                if (!resp.ok)
                    continue;
                const content_type = resp.headers.get('content-type') || '';
                if (!content_type.includes('text/html'))
                    continue;
                const html = await resp.text();
                const $ = cheerio.load(html);
                const title = $('title').text() || url;
                this.crawled.push({
                    id: url,
                    name: title.trim(),
                    type: 'webpage',
                    url,
                    depth
                });
                // find and queue links
                if (follow_links && depth < this.max_depth) {
                    $('a[href]').each((_, el) => {
                        try {
                            const href = $(el).attr('href');
                            if (!href)
                                return;
                            const full_url = new URL(href, url);
                            if (full_url.hostname !== base_domain)
                                return;
                            const clean_url = `${full_url.protocol}//${full_url.hostname}${full_url.pathname}`;
                            if (!this.visited.has(clean_url)) {
                                to_visit.push({ url: clean_url, depth: depth + 1 });
                            }
                        }
                        catch { }
                    });
                }
            }
            catch (e) {
                console.warn(`[web_crawler] failed to fetch ${url}: ${e.message}`);
            }
        }
        return this.crawled;
    }
    async _fetch_item(item_id) {
        let cheerio;
        try {
            cheerio = await Promise.resolve().then(() => __importStar(require('cheerio')));
        }
        catch {
            throw new base_1.source_config_error('missing deps: npm install cheerio', this.name);
        }
        const controller = new AbortController();
        const timeout_id = setTimeout(() => controller.abort(), this.timeout);
        const resp = await fetch(item_id, {
            headers: { 'User-Agent': 'OpenMemory-Crawler/1.0 (compatible)' },
            signal: controller.signal
        });
        clearTimeout(timeout_id);
        if (!resp.ok)
            throw new Error(`http ${resp.status}: ${resp.statusText}`);
        const html = await resp.text();
        const $ = cheerio.load(html);
        // remove noise
        $('script, style, nav, footer, header, aside').remove();
        const title = $('title').text() || item_id;
        // get main content
        const main = $('main').length ? $('main') : $('article').length ? $('article') : $('body');
        let text = main.text();
        // clean up whitespace
        text = text.split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
        return {
            id: item_id,
            name: title.trim(),
            type: 'webpage',
            text,
            data: text,
            meta: { source: 'web_crawler', url: item_id, char_count: text.length }
        };
    }
}
exports.web_crawler_source = web_crawler_source;
