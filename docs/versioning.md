# Versioning Policy

OpenMemory uses SemVer for the active JavaScript package, `openmemory-js`.

## Package

- Version source of truth: `packages/openmemory-js/package.json`.
- Tags: release tags use `v<version>`, for example `v1.4.0`.
- Publish target: npm package `openmemory-js`.

## Rules

- Patch: bug fixes, test-only changes, docs, packaging fixes, and compatible cleanup.
- Minor: new compatible unprefixed durable APIs, new SDK methods, or optional runtime features.
- Major: breaking API changes, removed public exports, incompatible storage migrations, or changed default runtime behavior.

## Release Checklist

- Run `npm run build` and `npm test` from the repo root.
- Run `cd packages/openmemory-js && npm pack --dry-run`.
- Confirm the tarball contains `dist`, `bin`, and package metadata only.
- Update release notes with user-visible API, storage, and migration changes.
- Create a `v<version>` tag only after the package version has been updated.
