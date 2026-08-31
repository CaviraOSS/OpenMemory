<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : GOVERNANCE.md
 usage : supports LongMemory governance
-->

# Governance

LongMemory is maintained by CaviraOSS through an open contribution process.

## Roles

- Contributors submit issues, documentation, code, integrations, or review.
- Maintainers triage work, review changes, manage releases, and enforce project policy.
- Release managers publish npm, container, and editor artifacts after release checks pass.

## Decisions

Routine decisions use pull-request review and maintainer consensus. Changes to persistence contracts, public APIs, security boundaries, licensing, or governance require a documented proposal and approval from at least two maintainers when available. Security incidents may be handled privately until remediation is published.

## Releases

Releases use Semantic Versioning and signed Git tags where possible. The release commit must pass `pnpm release:check`, document user-visible changes, contain no active legacy branding, and have matching package and tag versions.

## Conflicts of interest

Reviewers must disclose financial, employment, or personal conflicts that could reasonably affect judgment and recuse themselves when appropriate.
