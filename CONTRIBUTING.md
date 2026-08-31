<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : CONTRIBUTING.md
 usage : supports LongMemory contributing
-->

# Contributing to LongMemory

## Setup

```bash
git clone https://github.com/CaviraOSS/LongMemory.git
cd LongMemory
corepack enable
pnpm install --frozen-lockfile
pnpm release:check
```

Node.js 20 or newer and pnpm 11.5.2 are supported. Docker is optional.

## Pull requests

1. Open an issue or discussion before broad architectural changes.
2. Keep changes scoped and preserve immutable memory, project isolation, provenance, and read-only recall invariants.
3. Run `pnpm branding:check`, `pnpm typecheck`, `pnpm integration:check`, `pnpm bench:ci`, and production builds.
4. Update public docs and `CHANGELOG.md` for user-visible behavior.
5. Never commit credentials, benchmark corpora, runtime databases, generated builds, or proprietary agent stores.

## Style

Use existing TypeScript conventions, explicit types at public boundaries, structured parsers for structured data, and small comments only where behavior is not self-evident. Every comment-capable active file must carry the rendered `header.txt` header. Run `pnpm branding:apply` after adding files.

## Security

Do not open public issues for vulnerabilities. Follow [`SECURITY.md`](SECURITY.md).

Contributions are licensed under Apache License 2.0. The separately published
`@cavira/n8n-nodes-longmemory` community package remains MIT-licensed because
n8n's strict community-package validator requires that license.
