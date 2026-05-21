import {
  SourceAuthError,
  SourceConfigError,
  type SourceConnector,
  type SourceContent,
  type SourceItem,
} from "./framework";

export type OneDriveSourceConfig = {
  access_token?: string;
  user_principal?: string;
  folder_path?: string;
  fetcher?: typeof fetch;
};

const graphRoot = "https://graph.microsoft.com/v1.0";

const responseJson = async <T>(
  response: Response,
  source: string,
): Promise<T> => {
  if (response.status === 401 || response.status === 403) {
    throw new SourceAuthError(
      `Microsoft Graph auth failed with HTTP ${response.status}`,
      source,
    );
  }
  if (!response.ok) {
    throw new SourceConfigError(
      `Microsoft Graph request failed with HTTP ${response.status}`,
      source,
    );
  }
  return (await response.json()) as T;
};

export function createOneDriveSource(
  config: OneDriveSourceConfig,
): SourceConnector {
  const token = config.access_token || process.env.ONEDRIVE_ACCESS_TOKEN;
  if (!token)
    throw new SourceConfigError(
      "access_token or ONEDRIVE_ACCESS_TOKEN is required",
      "onedrive",
    );
  const fetcher = config.fetcher || fetch;
  const base = config.user_principal
    ? `${graphRoot}/users/${encodeURIComponent(config.user_principal)}/drive`
    : `${graphRoot}/me/drive`;
  const headers = { authorization: `Bearer ${token}` };

  return {
    kind: "onedrive",
    async list(filters: Record<string, unknown> = {}): Promise<SourceItem[]> {
      const folder = String(filters.folder_path || config.folder_path || "/");
      const url =
        folder === "/"
          ? `${base}/root/children`
          : `${base}/root:/${folder.replace(/^\/|\/$/g, "")}:/children`;
      const data = await responseJson<any>(
        await fetcher(url, { headers }),
        "onedrive",
      );
      return (data.value || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        type: item.folder ? "folder" : item.file?.mimeType || "file",
        uri: item.webUrl,
        metadata: {
          source: "onedrive",
          size: item.size,
          modified_at: item.lastModifiedDateTime,
        },
      }));
    },
    async fetch(item_id: string): Promise<SourceContent> {
      const meta = await responseJson<any>(
        await fetcher(`${base}/items/${encodeURIComponent(item_id)}`, {
          headers,
        }),
        "onedrive",
      );
      const contentResponse = await fetcher(
        `${base}/items/${encodeURIComponent(item_id)}/content`,
        { headers, redirect: "follow" },
      );
      if (!contentResponse.ok) {
        throw new SourceConfigError(
          `OneDrive content failed with HTTP ${contentResponse.status}`,
          "onedrive",
        );
      }
      const content = Buffer.from(await contentResponse.arrayBuffer());
      return {
        id: item_id,
        name: meta.name,
        type: meta.file?.mimeType || "file",
        uri: meta.webUrl,
        content_type: meta.file?.mimeType || "application/octet-stream",
        content,
        metadata: {
          source: "onedrive",
          item_id,
          size: meta.size,
          mime_type: meta.file?.mimeType,
        },
      };
    },
  };
}
