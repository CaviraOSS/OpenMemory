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

export type NotionSourceConfig = {
  client?: any;
  api_key?: string;
  database_id?: string;
};

const loadNotionClient = async (apiKey?: string) => {
  if (!apiKey && !process.env.NOTION_API_KEY) {
    throw new SourceConfigError(
      "api_key or NOTION_API_KEY is required",
      "notion",
    );
  }
  try {
    const notion = await dynamicImport("@notionhq/client");
    return new notion.Client({ auth: apiKey || process.env.NOTION_API_KEY });
  } catch {
    throw new SourceConfigError(
      "missing dependency: npm install @notionhq/client",
      "notion",
    );
  }
};

const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<any>;

const extractTitle = (page: any): string => {
  for (const prop of Object.values(page?.properties || {}) as any[]) {
    if (prop?.type === "title" && prop.title?.[0]?.plain_text) {
      return prop.title[0].plain_text;
    }
  }
  return "";
};

const richText = (items: any[] = []) =>
  items.map((item) => item?.plain_text || "").join("");

const blockToText = (block: any): string => {
  const type = block?.type;
  if (!type) return "";
  if (type === "code") {
    const language = block.code?.language || "";
    const code = richText(block.code?.rich_text);
    return `\`\`\`${language}\n${code}\n\`\`\``;
  }
  if (type === "to_do") {
    return `${block.to_do?.checked ? "[x]" : "[ ]"} ${richText(block.to_do?.rich_text)}`;
  }
  const value = block[type];
  return richText(value?.rich_text);
};

export function createNotionSource(
  config: NotionSourceConfig,
): SourceConnector {
  let client = config.client;
  const getClient = async () => {
    client = client || (await loadNotionClient(config.api_key));
    return client;
  };

  return {
    kind: "notion",
    async list(filters: Record<string, unknown> = {}): Promise<SourceItem[]> {
      const notion = await getClient();
      const databaseId = String(
        filters.database_id || config.database_id || "",
      );
      const response = databaseId
        ? await notion.databases.query({ database_id: databaseId })
        : await notion.search({
            filter: { property: "object", value: "page" },
          });
      return (response.results || []).map((page: any) => ({
        id: page.id,
        name: extractTitle(page) || "Untitled",
        type: "page",
        uri: page.url,
        metadata: {
          source: "notion",
          last_edited_at: page.last_edited_time,
        },
      }));
    },
    async fetch(item_id: string): Promise<SourceContent> {
      const notion = await getClient();
      const page = await notion.pages.retrieve({ page_id: item_id });
      const title = extractTitle(page) || "Untitled";
      const blocks: any[] = [];
      let cursor: string | undefined;
      let hasMore = true;
      while (hasMore) {
        const response = await notion.blocks.children.list({
          block_id: item_id,
          start_cursor: cursor,
        });
        blocks.push(...(response.results || []));
        hasMore = !!response.has_more;
        cursor = response.next_cursor;
      }
      const text = [
        `# ${title}`,
        ...blocks.map(blockToText).filter(Boolean),
      ].join("\n\n");
      return {
        id: item_id,
        name: title,
        type: "notion_page",
        uri: page.url,
        content_type: "text/markdown",
        content: text,
        metadata: {
          source: "notion",
          page_id: item_id,
          block_count: blocks.length,
        },
      };
    },
  };
}
