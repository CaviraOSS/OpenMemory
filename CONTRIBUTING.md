# Contributing

OpenMemory is currently in an architectural cleanup phase.

## Active Area

Contributions should target `packages/openmemory-js` unless a maintainer asks otherwise.

## Local Checks

```bash
cd packages/openmemory-js
npm install
npm run build
npx tsx tests/test_omnibus.ts
```

## Guidelines

- Keep changes scoped to the JavaScript server/package path.
- Do not reintroduce deferred app, dashboard, or secondary SDK surfaces during the cleanup.
- Update `docs/ai-context.md`, `docs/ai-rules.md`, or `docs/decisions.md` when reusable architecture context changes.

