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

By default the dashboard expects the backend at `http://localhost:8080`.
If you use a different backend URL, configure it in `.env.local` as described in `CHAT_SETUP.md`.

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
