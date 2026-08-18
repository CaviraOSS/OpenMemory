# OpenMemory Dashboard

This app is the optional OpenMemory dashboard UI.

## What it is

- a separate Next.js app in `dashboard/`
- designed to talk to an OpenMemory backend over HTTP
- not bundled into the root `openmemory` npm package

If you are running OpenMemory without the dashboard, you only need the root package.

## Backend requirement

Start the backend first:

```powershell
pnpm install
pnpm build
node dist/server/index.js
```

By default the dashboard calls its same-origin server-side proxy at `/api/openmemory`, which forwards requests to the OpenMemory backend.
Configure the backend URL and optional API key in `.env.local`:

```env
OPENMEMORY_API_URL=http://127.0.0.1:7331
# OPENMEMORY_API_KEY=your-secret-api-key
```

This keeps authenticated backend API keys on the server. The settings screen is intentionally read-only; configure secrets in the dashboard deployment environment.

## Run the dashboard locally

```powershell
cd dashboard
npm install
npm run dev
```

Then open <http://localhost:3000>.

For a production build:

```powershell
npm run build
node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000
```

## Hydrograph behavior

- dashboard reads use `/v1/stats`, `/v1/timeline`, `/v1/recall`, and `/v1/worlds`
- new memories use immutable `/v1/ingest`
- edit/delete controls are intentionally absent; corrections are new superseding observations
- project discovery reads recursive ProjectWorld metadata
- the server-side compatibility proxy keeps API keys out of browser code

## Related docs

- `README.md` — top-level project overview
- `dashboard/CHAT_SETUP.md` — dashboard-to-backend setup details
- `README.md` — backend / SDK docs
