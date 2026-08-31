<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/api.md
 usage : documents LongMemory api
-->

# Self-hosted API

LongMemory includes a dependency-free HTTP server built on the same `createMemory` engine as the package API and CLI. The server uses SQLite by default and listens on `127.0.0.1:7331`.

## Start the server

```bash
pnpm serve
```

For a built package:

```bash
node dist/server/index.js
```

## Environment

| Variable                                 | Default           | Description                                    |
| ---------------------------------------- | ----------------- | ---------------------------------------------- |
| `LONGMEMORY_DB_PATH`                     | `./longmemory.db` | SQLite database path                           |
| `LONGMEMORY_PORT`                        | `7331`            | HTTP port                                      |
| `LONGMEMORY_API_KEY`                     | unset             | Optional API key for all `/v1/*` routes        |
| `LONGMEMORY_ENABLE_COLD_LOG`             | `false`           | Persist raw events to the cold log             |
| `LONGMEMORY_ENABLE_CONSOLIDATION`        | `false`           | Enable automatic consolidation                 |
| `LONGMEMORY_STRICT_CONFIDENCE_THRESHOLD` | `0.5`             | Strict recall confidence threshold from 0 to 1 |
| `LONGMEMORY_GROUNDING_THRESHOLD`         | `0.6`             | World-grounded recall threshold from 0 to 1    |

`LONGMEMORY_HOST` is also supported and defaults to `127.0.0.1`.

## Responses

Successful responses use one envelope:

```json
{
  "data": {},
  "meta": { "duration_ms": 1.42 }
}
```

Every response also includes a `Server-Timing` header. Errors do not expose stack traces or internal exception details:

```json
{
  "error": {
    "code": "validation_error",
    "message": "mode is required"
  },
  "meta": { "duration_ms": 0.18 }
}
```

JSON request bodies are limited to 1 MiB and must use `Content-Type: application/json`.

## Authentication

When `LONGMEMORY_API_KEY` is set, send the key as either a bearer token or `X-API-Key` header:

```bash
curl http://127.0.0.1:7331/v1/stats \
  -H "Authorization: Bearer $LONGMEMORY_API_KEY"
```

The health endpoint remains unauthenticated so container and hosting health checks can use it.

## Health

```http
GET /health
```

The response reports engine readiness, active store type, and current store statistics.

## Ingest

```http
POST /v1/ingest
Content-Type: application/json
```

```json
{
  "user_id": "u1",
  "text": "I prefer tea",
  "at": 1767225600000,
  "world": "personal",
  "tags": ["preference"]
}
```

The response is the core `IngestResult`, including the immutable node, executable edges, memory diff, and 14-step ingest trace.

## Recall

```http
POST /v1/recall
Content-Type: application/json
```

Recall mode is required and must be one of `strict`, `historical`, `associative`, or `world_grounded`.

Strict recall:

```json
{
  "text": "what do I prefer",
  "mode": "strict",
  "now": 1775001600000,
  "k": 5
}
```

Historical recall uses the same endpoint:

```json
{
  "text": "what did I prefer",
  "mode": "historical",
  "now": 1775001600000,
  "valid_time": 1767225600001
}
```

## Explain

```http
GET /v1/explain/:id
```

Returns the memory, incoming and outgoing executable edges, and its in-process ingest trace. A missing memory returns `404 memory_not_found`.

## Worlds and entities

```http
GET /v1/worlds/:id
GET /v1/entities/:id
```

These routes return the public world or entity object and return a clean `404` when the identifier is unknown.

## Timeline

```http
GET /v1/timeline?valid_time=1767225600001&world_id=world%3Apersonal
```

Supported query parameters are `text`, `now`, `valid_time`, `recorded_time`, `world_id`, and `entity_names`. Entity names may be repeated or comma-separated.

## Stats

```http
GET /v1/stats
```

Returns store type and counts for nodes, edges, worlds, entities, grounded facts, and working memory, plus cold-log and consolidation status.

## Benchmark

```bash
pnpm bench -- --only=api-server
```

The `api-server` suite runs direct and loopback HTTP strict recall against the same engine and reports core p95, HTTP p95, and p95 HTTP transport overhead.
