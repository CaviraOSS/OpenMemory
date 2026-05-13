# Getting Started

OpenMemory is currently focused on the JavaScript server package.

## Install

```bash
cd packages/openmemory-js
npm install
```

## Configure

Copy the root environment template and set the Postgres and embedding values you need:

```bash
cp .env.example .env
```

Production storage target is Postgres with pgvector.

## Run

```bash
cd packages/openmemory-js
npm run build
npm run start
```

The server listens on `http://localhost:8080` by default.

