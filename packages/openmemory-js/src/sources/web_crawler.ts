/**
 * web crawler source for openmemory - production grade
 * requires: cheerio (for html parsing)
 * no auth required for public urls
 */

import { base_source, source_config_error, source_item, source_content, source_config } from './base';

export interface web_crawler_config extends source_config {
    max_pages?: number;
    max_depth?: number;
    timeout?: number;
}

export class web_crawler_source extends base_source {
    name = 'web_crawler';
    private max_pages: number;
    private max_depth: number;
    private timeout: number;
    private visited: Set<string> = new Set();
    private crawled: source_item[] = [];

    constructor(
        user_id?: string,
        config?: web_crawler_config
    ) {
        super(user_id, config);
        this.max_pages = config?.max_pages || 50;
        this.max_depth = config?.max_depth || 3;
        this.timeout = config?.timeout || 30000;
    }

    async _connect(): Promise<boolean> {
        return true;
    }

    async _list_items(filters: Record<string, any>): Promise<source_item[]> {
        if (!filters.start_url) {
            throw new source_config_error('start_url is required', this.name);
        }

        let cheerio: any;
        try {
            cheerio = await import('cheerio');
        } catch {
            throw new source_config_error('missing deps: npm install cheerio', this.name);
        }

        this.visited.clear();
        this.crawled = [];

        const base_url = new URL(filters.start_url);
        const base_domain = base_url.hostname;
        const to_visit: { url: string; depth: number }[] = [{ url: filters.start_url, depth: 0 }];
        const follow_links = filters.follow_links !== false;

        while (to_visit.length > 0 && this.crawled.length < this.max_pages) {
            const { url, depth } = to_visit.shift()!;

            if (this.visited.has(url) || depth > this.max_depth) continue;
            this.visited.add(url);

            try {
                const controller = new AbortController();
                const timeout_id = setTimeout(() => controller.abort(), this.timeout);

                const resp = await fetch(url, {
                    headers: { 'User-Agent': 'OpenMemory-Crawler/1.0 (compatible)' },
                    signal: controller.signal
                });

                clearTimeout(timeout_id);

                if (!resp.ok) continue;

                const content_type = resp.headers.get('content-type') || '';
                if (!content_type.includes('text/html')) continue;

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


                if (follow_links && depth < this.max_depth) {
                    $('a[href]').each((_: any, el: any) => {
                        try {
                            const href = $(el).attr('href');
                            if (!href) return;

                            const full_url = new URL(href, url);
                            if (full_url.hostname !== base_domain) return;

                            const clean_url = `${full_url.protocol}//${full_url.host}${full_url.pathname}`;
                            if (!this.visited.has(clean_url)) {
                                to_visit.push({ url: clean_url, depth: depth + 1 });
                            }
                        } catch { }
                    });
                }
            } catch (e: any) {
                console.warn(`[web_crawler] failed to fetch ${url}: ${e.message}`);
            }
        }

        return this.crawled;
    }

    async _fetch_item(item_id: string): Promise<source_content> {
        let cheerio: any;
        try {
            cheerio = await import('cheerio');
        } catch {
            throw new source_config_error('missing deps: npm install cheerio', this.name);
        }

        const controller = new AbortController();
        const timeout_id = setTimeout(() => controller.abort(), this.timeout);

        const resp = await fetch(item_id, {
            headers: { 'User-Agent': 'OpenMemory-Crawler/1.0 (compatible)' },
            signal: controller.signal
        });

        clearTimeout(timeout_id);

        if (!resp.ok) throw new Error(`http ${resp.status}: ${resp.statusText}`);

        const html = await resp.text();
        const $ = cheerio.load(html);


        $('script, style, nav, footer, header, aside').remove();

        const title = $('title').text() || item_id;


        const main = $('main').length ? $('main') : $('article').length ? $('article') : $('body');
        let text = main.text();


        text = text.split('\n').map((l: string) => l.trim()).filter(Boolean).join('\n');

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
