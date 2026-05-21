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
