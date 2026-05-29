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

export type WebSourceConfig = {
  url?: string;
  urls?: string[];
  fetcher?: typeof fetch;
};

export function createWebSource(config: WebSourceConfig): SourceConnector {
  const urls = [...(config.urls || []), ...(config.url ? [config.url] : [])]
    .map((url) => url.trim())
    .filter(Boolean);

  if (urls.length === 0) {
    throw new SourceConfigError("url or urls is required", "web");
  }

  return {
    kind: "web",
    async list(): Promise<SourceItem[]> {
      return urls.map((url) => ({
        id: url,
        name: url,
        type: "url",
        uri: url,
      }));
    },
    async fetch(item_id: string): Promise<SourceContent> {
      if (!urls.includes(item_id)) {
        throw new SourceConfigError(`unknown url: ${item_id}`, "web");
      }
      const extracted = await extractUrlContent(
        item_id,
        config.fetcher || fetch,
      );
      return {
        id: item_id,
        name: item_id,
        type: "url",
        uri: item_id,
        content_type: "text/html",
        content: extracted.text,
        metadata: extracted.metadata,
        observed_at: extracted.metadata.fetched_at,
      };
    },
  };
}
