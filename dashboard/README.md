# OpenMemory Dashboard

This app is the optional OpenMemory dashboard UI.

## What it is

- a separate Next.js app in `dashboard/`
- designed to talk to an OpenMemory backend over HTTP
- not bundled into the bare `packages/openmemory-js` npm install

If you are running OpenMemory without the dashboard, you only need the backend in `packages/openmemory-js`.

## Backend requirement

Start the backend first:

```bash
cd packages/openmemory-js
npm install
npm run dev
```

By default the dashboard calls its same-origin server-side proxy at `/api/openmemory`, which forwards requests to the OpenMemory backend.
Configure the backend URL and optional API key in `.env.local`:

```env
OPENMEMORY_API_URL=http://localhost:8080
# OPENMEMORY_API_KEY=your-secret-api-key
```

This keeps authenticated backend API keys on the server. For local development only, you can still use browser-direct configuration with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_KEY`, but `NEXT_PUBLIC_*` values are public in the browser bundle.

## Run the dashboard locally

```bash
cd dashboard
npm install
npm run dev
```

Then open <http://localhost:3000>.

## Docker

If you want the full local stack, you can also run OpenMemory with Docker and enable the dashboard/UI profile from the repository root.

## Related docs

- `README.md` — top-level project overview
- `dashboard/CHAT_SETUP.md` — dashboard-to-backend setup details
- `packages/openmemory-js/README.md` — backend / SDK docs
