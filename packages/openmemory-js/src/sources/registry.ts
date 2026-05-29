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
import { createGitHubSource } from "./github";
import { createWebSource } from "./web";
import { createNotionSource } from "./notion";
import { createGoogleDriveSource } from "./googleDrive";
import { createOneDriveSource } from "./onedrive";
import { createCrawlerSource } from "./crawler";

const unsupportedSource = (kind: string): SourceConnector => ({
  kind,
  async list(): Promise<SourceItem[]> {
    throw new SourceConfigError(
      `${kind} source is not installed in this build`,
      kind,
    );
  },
  async fetch(_item_id: string): Promise<SourceContent> {
    throw new SourceConfigError(
      `${kind} source is not installed in this build`,
      kind,
    );
  },
});

export const SOURCE_KINDS = [
  "web",
  "github",
  "notion",
  "google_drive",
  "google_sheets",
  "google_slides",
  "onedrive",
] as const;

export function getSourceConnector(
  kind: string,
  config: Record<string, unknown>,
): SourceConnector {
  if (kind === "web" || kind === "url") {
    return createWebSource(config as Parameters<typeof createWebSource>[0]);
  }
  if (kind === "github") {
    return createGitHubSource(
      config as Parameters<typeof createGitHubSource>[0],
    );
  }
  if (kind === "notion") {
    return createNotionSource(
      config as Parameters<typeof createNotionSource>[0],
    );
  }
  if (
    kind === "google_drive" ||
    kind === "google_sheets" ||
    kind === "google_slides"
  ) {
    return createGoogleDriveSource(
      config as Parameters<typeof createGoogleDriveSource>[0],
      kind,
    );
  }
  if (kind === "onedrive") {
    return createOneDriveSource(
      config as Parameters<typeof createOneDriveSource>[0],
    );
  }
  if (kind === "web_crawler") {
    return createCrawlerSource(
      config as Parameters<typeof createCrawlerSource>[0],
    );
  }
  throw new SourceConfigError(`unknown source: ${kind}`, kind);
}
