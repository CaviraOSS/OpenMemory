# API Server

The active server lives in `packages/openmemory-js`.

## Run

```bash
cd packages/openmemory-js
npm install
npm run build
npm run start
```

## Current Endpoints

- `GET /health`
- `POST /memory/add`
- `POST /memory/query`
- `GET /memory/all`
- `GET /memory/:id`
- `PATCH /memory/:id`
- `DELETE /memory/:id`
- `POST /memory/reinforce`

The durable rewrite will introduce the smaller unprefixed durable api described in `docs/architecture-rewrite-plan.md`.

