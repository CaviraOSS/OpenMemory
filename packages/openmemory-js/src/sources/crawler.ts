/*
   ____                   __  __                                 
  / __ \                 |  \/  |                                
 | |  | |_ __   ___ _ __ | \  / | ___ _ __ ___   ___  _ __ _   _ 
 | |  | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 | |__| | |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
  \____/| .__/ \___|_| |_|_|  |_|\___|_| |_| |_|\___/|_|   \__, |
        | |                                                 __/ |
        |_|                                                |___/ 
  CaviraOSS @ 2026

 - filename
 - what is the file used for
*/

import {
  SourceConfigError,
  type SourceConnector,
  type SourceContent,
  type SourceItem,
} from "./framework";
import { extractUrlContent } from "../ingestion/extract";

export type CrawlerSourceConfig = {
  start_url?: string;
  max_pages?: number;
  max_depth?: number;
  fetcher?: typeof fetch;
};

const stripTitle = (html: string, fallback: string) =>
  html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || fallback;

const linksFrom = (html: string, baseUrl: string) => {
  const links: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
    try {
      const url = new URL(match[1], baseUrl);
      links.push(`${url.protocol}//${url.host}${url.pathname}`);
    } catch {
      // ignore invalid hrefs
    }
  }
  return links;
};

export function createCrawlerSource(
  config: CrawlerSourceConfig,
): SourceConnector {
  if (!config.start_url) {
    throw new SourceConfigError("start_url is required", "web_crawler");
  }
  const startUrl = config.start_url;
  const origin = new URL(startUrl).origin;
  const maxPages = Math.max(
    1,
    Math.min(100, Math.floor(config.max_pages || 25)),
  );
  const maxDepth = Math.max(0, Math.min(10, Math.floor(config.max_depth || 2)));
  const fetcher = config.fetcher || fetch;
  let crawled: SourceItem[] = [];

  return {
    kind: "web_crawler",
    async list(): Promise<SourceItem[]> {
      const queue = [{ url: startUrl, depth: 0 }];
      const visited = new Set<string>();
      crawled = [];

      while (queue.length > 0 && crawled.length < maxPages) {
        const next = queue.shift();
        if (!next || visited.has(next.url) || next.depth > maxDepth) continue;
        visited.add(next.url);
        const response = await fetcher(next.url);
        if (!response.ok) continue;
        const contentType =
          response.headers?.get?.("content-type") || "text/html";
        if (!contentType.includes("text/html")) continue;
        const html = await response.text();
        crawled.push({
          id: next.url,
          name: stripTitle(html, next.url),
          type: "webpage",
          uri: next.url,
          metadata: { source: "web_crawler", depth: next.depth },
        });
        if (next.depth >= maxDepth) continue;
        for (const link of linksFrom(html, next.url)) {
          if (link.startsWith(origin) && !visited.has(link)) {
            queue.push({ url: link, depth: next.depth + 1 });
          }
        }
      }

      return crawled;
    },
    async fetch(item_id: string): Promise<SourceContent> {
      const extracted = await extractUrlContent(item_id, fetcher);
      return {
        id: item_id,
        name: item_id,
        type: "webpage",
        uri: item_id,
        content_type: "text/html",
        content: extracted.text,
        metadata: {
          ...extracted.metadata,
          source: "web_crawler",
        },
      };
    },
  };
}
