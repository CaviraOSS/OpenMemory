# Migration Policy

OpenMemory durable storage migrations are forward-only.

## Rules

- Migrations must be idempotent where practical (`create table if not exists`, `add column if not exists`, stable indexes).
- Existing durable data must not be rewritten or dropped without an explicit new migration and a documented recovery path.
- Destructive cleanup belongs in a separate manual maintenance command, not automatic startup migration.
- New schema changes should include a focused verification path when tests are reintroduced.
- Rollback strategy is restore-from-backup plus forward fix. Do not add automatic down migrations until the durable schema is stable.

## Current Scope

- Postgres plus pgvector is the only active migration target.
- `DURABLE_SCHEMA_VERSION` tracks the durable schema generation, not app release version.
