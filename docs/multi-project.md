# Multi-project Memory (Project by Default, Team by Explicit Opt-in)

OpenMemory supports two safe patterns:

## Option A (recommended): one instance per project

This gives hard isolation by default (different DB volume + port + API key).

1) Create an env file per project (examples: `.env.project.example`, `.env.team.example`).

2) Start a project instance:

```bash
docker compose --project-name om_<project> --env-file .env.project.<project> up -d --build openmemory
```

3) Validate:

```bash
curl http://localhost:<OM_PORT>/health
```

4) Stop:

```bash
docker compose --project-name om_<project> down
```

### Team shared memory (explicit)

Run a separate, clearly named instance and connect to it only when needed:

```bash
docker compose --project-name om_team --env-file .env.team up -d --build openmemory
```

## Option B: one shared instance, but strict scoping via `user_id`

This works only if your clients always send `user_id` (or `x-om-user-id` / `x-openmemory-user-id`).

- VS Code extension: default `user_id` is now scoped per workspace project name; override with `openmemory.userId` if you want a shared team identity.
- HTTP context providers: include `user_id` in body for `/api/ide/context`, or set `x-om-user-id` header.

