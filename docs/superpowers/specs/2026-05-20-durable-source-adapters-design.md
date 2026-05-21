# Durable Source Adapters Design

## Goal

Port useful source connector behavior from `insp/openmemory-js` into the active package without changing the durable architecture.

## Scope

- Add durable source adapters for Notion, Google Drive, OneDrive, and bounded web crawling.
- Register them under the existing `/v1/sources/:source/ingest` path through `src/sources/registry.ts`.
- Keep all third-party SDKs optional through dynamic imports or injected clients/fetchers.
- Each adapter must produce `SourceItem` and `SourceContent`; ingestion still creates `working_memory_events` and `extraction_candidates`, not memories.

## Non-Goals

- No old `/sources/*` routes.
- No `Memory.source()` revival.
- No background sync jobs.
- No OAuth setup flows.
- No hard Notion/Google/Microsoft/Cheerio dependencies in the default package.
- No changes to durable storage schema.

## Adapter Contracts

- Notion: list pages from search or database query; fetch a page title and text blocks into markdown-like plain text.
- Google Drive: list files from Drive; export Google docs/sheets/slides to text/csv/plain text; fetch binary/plain files as UTF-8 where possible.
- OneDrive: list files from Microsoft Graph; fetch item content using a provided or acquired token.
- Crawler: bounded same-host crawl using built-in HTML extraction; no Cheerio requirement.

## Tests

- Use injected fake clients/fetchers so tests do not require credentials or network.
- Assert registry exposes active adapters.
- Assert each adapter maps old-style content into `SourceContent` with stable metadata.
- Assert adapters stay behind durable source ingestion and do not reintroduce old routes.
