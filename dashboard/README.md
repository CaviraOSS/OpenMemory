<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : dashboard/README.md
 usage : supports the LongMemory dashboard readme
-->

# LongMemory Dashboard

This app is the optional LongMemory dashboard UI.

## What it is

- a separate Next.js app in `dashboard/`
- designed to talk to an LongMemory backend over HTTP
- not bundled into the root `longmemory` npm package

If you are running LongMemory without the dashboard, you only need the root package.

## Backend requirement

Start the backend first:

```powershell
pnpm install
pnpm build
node dist/server/index.js
```

By default the dashboard calls its same-origin server-side proxy at `/api/longmemory`, which forwards requests to the LongMemory backend.
Configure the backend URL and optional API key in `.env.local`:

```env
LONGMEMORY_API_URL=http://127.0.0.1:7331
# LONGMEMORY_API_KEY=your-secret-api-key
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
