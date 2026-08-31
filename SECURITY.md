<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : SECURITY.md
 usage : supports LongMemory security
-->

# Security policy

## Reporting

Use GitHub private vulnerability reporting for `CaviraOSS/LongMemory`. Do not disclose exploitable details in a public issue. Include affected versions, impact, reproduction steps, and any suggested mitigation. Maintainers will acknowledge valid reports, coordinate a fix, and publish an advisory when users can update safely.

## Supported version

Security fixes target the latest release line. Older releases may receive guidance but are not guaranteed patches.

## Deployment baseline

- Set `LONGMEMORY_API_KEY` for every network-accessible API or MCP deployment.
- Terminate TLS at the platform proxy and restrict `LONGMEMORY_ALLOWED_ORIGINS`.
- Mount `/data` on persistent encrypted storage and protect backups.
- Run the container as its included non-root user.
- Use least-privilege embedding and connector credentials.
- Keep tenant, user, project, agent, and framework identity server-bound.
- Treat recalled content as untrusted evidence, never authorization or executable instructions.
- Review connector import plans and keep destructive external writes disabled.

Secrets must never be committed to `.env`, plugin artifacts, benchmark reports, or session imports.
