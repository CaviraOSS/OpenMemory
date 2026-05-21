# Durable MCP, Ingestion, And Sources Design

## Goal

Reintroduce MCP, multi-format ingestion, and source ingestion through durable `/v1` contracts only.

## Scope

- Add explicit MCP stdio support as an opt-in CLI/server adapter, not part of default HTTP startup.
- Add a durable document-ingestion route that extracts supported payloads into working-memory events plus extraction candidates.
- Add durable source ingestion through a registry and source adapters that create the same event/candidate rows.

## Architecture

- `/v1` remains the product API boundary.
- MCP tools call durable HTTP routes through a small client so importing MCP never binds a port or initializes storage.
- Document ingestion uses `src/ingestion/extract.ts`; text, markdown, HTML, and URL HTML are supported now, while PDF/DOCX/audio/video fail with explicit optional-adapter errors.
- Source ingestion uses `src/sources/framework.ts`; web/URL and GitHub are the first built-in adapters because they can run with `fetch` and optional tokens.

## Explicit Non-Goals

- Do not revive `/retention/*`, `/memory/ingest`, old `/sources/*`, SQLite, Valkey, HSG, dashboard, IDE, or background source jobs.
- Do not expose `Memory.source()` again in this tranche.
- Do not add hard OAuth SDK dependencies for Notion, Google, or OneDrive until those adapters have durable tests.

## Validation

- Focused tests cover route registration, extraction behavior, source registry behavior, and MCP import/tool mapping safety.
- Package build and focused tests must pass.
