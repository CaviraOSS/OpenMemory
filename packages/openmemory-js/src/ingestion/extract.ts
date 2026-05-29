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

import type { ExtractionCandidateInput } from "../durable/repository";
import { buildExtractionCandidateInput } from "../durable/ingestion";

export class OptionalExtractorUnavailable extends Error {
  constructor(
    readonly content_type: string,
    readonly install_hint: string,
  ) {
    super(
      `optional extractor unavailable for ${content_type}: ${install_hint}`,
    );
    this.name = "OptionalExtractorUnavailable";
  }
}

export type ExtractedDocumentContent = {
  text: string;
  metadata: {
    content_type: string;
    char_count: number;
    estimated_tokens: number;
    extraction_method: string;
    original_char_count?: number;
    source_url?: string;
    fetched_at?: string;
  };
};

const estimateTokens = (text: string) => Math.ceil(text.length / 4);

const normalizeContentType = (contentType: string) =>
  contentType.toLowerCase().split(";")[0].trim();

const asText = (data: string | Buffer) =>
  Buffer.isBuffer(data) ? data.toString("utf8") : data;

const stripHtml = (html: string) =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(title|main|article|section|p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const extracted = (
  text: string,
  contentType: string,
  extractionMethod: string,
  originalCharCount?: number,
  extraMetadata: Record<string, string | number | undefined> = {},
): ExtractedDocumentContent => ({
  text,
  metadata: {
    content_type: contentType,
    char_count: text.length,
    estimated_tokens: estimateTokens(text),
    extraction_method: extractionMethod,
    ...(originalCharCount === undefined
      ? {}
      : { original_char_count: originalCharCount }),
    ...extraMetadata,
  },
});

export async function extractDocumentContent(
  contentType: string,
  data: string | Buffer,
): Promise<ExtractedDocumentContent> {
  const normalized = normalizeContentType(contentType);
  if (
    ["text", "txt", "text/plain", "md", "markdown", "text/markdown"].includes(
      normalized,
    )
  ) {
    return extracted(asText(data), contentType, "passthrough");
  }

  if (["html", "htm", "text/html"].includes(normalized)) {
    const html = asText(data);
    return extracted(stripHtml(html), contentType, "html-strip", html.length);
  }

  if (
    [
      "pdf",
      "application/pdf",
      "doc",
      "docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ].includes(normalized)
  ) {
    throw new OptionalExtractorUnavailable(
      contentType,
      "install a document extraction adapter and feed its text into /ingest",
    );
  }

  if (normalized.startsWith("audio/") || normalized.startsWith("video/")) {
    throw new OptionalExtractorUnavailable(
      contentType,
      "install a media transcription adapter and feed its transcript into /ingest",
    );
  }

  throw new OptionalExtractorUnavailable(
    contentType,
    "no extractor is registered for this content type",
  );
}

export async function extractUrlContent(
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<ExtractedDocumentContent> {
  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const html = await response.text();
  return extracted(stripHtml(html), "url", "fetch+html-strip", html.length, {
    source_url: url,
    fetched_at: new Date().toISOString(),
  });
}

export function extractionToCandidateInput(input: {
  event_id: string;
  user_id?: string;
  project_id?: string;
  source?: {
    kind?: string;
    uri?: string;
    id?: string;
    observed_at?: string | Date;
  };
  content: ExtractedDocumentContent;
  metadata?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
}): ExtractionCandidateInput {
  return buildExtractionCandidateInput({
    event_id: input.event_id,
    user_id: input.user_id,
    project_id: input.project_id,
    source: input.source,
    content: input.content.text,
    metadata: {
      ...input.metadata,
      ...input.content.metadata,
    },
    contracts: input.contracts,
  });
}
