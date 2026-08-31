<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : dashboard/CHAT_SETUP.md
 usage : supports the LongMemory dashboard chat setup
-->

# Dashboard setup

The dashboard talks to LongMemory through its same-origin `/api/longmemory` proxy. Keep API credentials on the server; do not expose them through `NEXT_PUBLIC_*` variables.

## Local development

Terminal 1:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
LONGMEMORY_API_KEY=local-secret pnpm start
```

Terminal 2:

```bash
npm --prefix dashboard ci
LONGMEMORY_API_URL=http://127.0.0.1:7331 \
LONGMEMORY_API_KEY=local-secret \
npm --prefix dashboard run dev
```

Open `http://127.0.0.1:3000`.

## Docker Compose

```bash
LONGMEMORY_API_KEY=change-me docker compose --profile ui up --build -d
```

The dashboard container resolves the API as `http://longmemory:7331`. The browser calls only the dashboard origin.

## Hosted dashboard

For Vercel or another standalone dashboard host, configure:

```text
LONGMEMORY_API_URL=https://your-longmemory-api.example.com
LONGMEMORY_API_KEY=<server-side key>
```

The API must be deployed separately on a stateful container platform with persistent `/data` storage. Verify connectivity with:

```bash
curl --fail https://your-longmemory-api.example.com/health
```
