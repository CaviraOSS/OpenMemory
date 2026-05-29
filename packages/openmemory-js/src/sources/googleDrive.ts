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

export type GoogleDriveSourceConfig = {
  service?: any;
  credentials_json?: Record<string, unknown>;
  service_account_file?: string;
};

const loadDriveService = async (config: GoogleDriveSourceConfig) => {
  try {
    const { google } = await dynamicImport("googleapis");
    const scopes = ["https://www.googleapis.com/auth/drive.readonly"];
    const auth = new google.auth.GoogleAuth({
      credentials:
        config.credentials_json ||
        (process.env.GOOGLE_CREDENTIALS_JSON
          ? JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON)
          : undefined),
      keyFile:
        config.service_account_file || process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
      scopes,
    });
    return google.drive({ version: "v3", auth });
  } catch {
    throw new SourceConfigError(
      "missing dependency: npm install googleapis",
      "google_drive",
    );
  }
};

const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<any>;

const exportMime = (mime: string) => {
  if (mime === "application/vnd.google-apps.spreadsheet") return "text/csv";
  return "text/plain";
};

export function createGoogleDriveSource(
  config: GoogleDriveSourceConfig,
  kind = "google_drive",
): SourceConnector {
  let service = config.service;
  const getService = async () => {
    service = service || (await loadDriveService(config));
    return service;
  };

  return {
    kind,
    async list(filters: Record<string, unknown> = {}): Promise<SourceItem[]> {
      const drive = await getService();
      const q = ["trashed=false"];
      if (filters.folder_id) q.push(`'${filters.folder_id}' in parents`);
      const response = await drive.files.list({
        q: q.join(" and "),
        spaces: "drive",
        fields: "files(id,name,mimeType,modifiedTime,size,webViewLink)",
        pageSize: Math.min(100, Number(filters.limit || 100)),
      });
      return (response.data.files || []).map((file: any) => ({
        id: file.id,
        name: file.name,
        type: file.mimeType,
        uri: file.webViewLink,
        metadata: {
          source: kind,
          modified_at: file.modifiedTime,
          size: file.size,
        },
      }));
    },
    async fetch(item_id: string): Promise<SourceContent> {
      const drive = await getService();
      const meta = await drive.files.get({
        fileId: item_id,
        fields: "id,name,mimeType,webViewLink",
      });
      const mime = meta.data.mimeType || "application/octet-stream";
      let content: string | Buffer;
      let contentType = mime;
      if (mime.startsWith("application/vnd.google-apps.")) {
        contentType = exportMime(mime);
        const exported = await drive.files.export({
          fileId: item_id,
          mimeType: contentType,
        });
        content = String(exported.data || "");
      } else {
        const response = await drive.files.get(
          { fileId: item_id, alt: "media" },
          { responseType: "arraybuffer" },
        );
        content = Buffer.from(response.data);
      }
      return {
        id: item_id,
        name: meta.data.name,
        type: mime,
        uri: meta.data.webViewLink,
        content_type: contentType,
        content,
        metadata: {
          source: kind,
          file_id: item_id,
          mime_type: mime,
        },
      };
    },
  };
}
