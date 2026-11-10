---
type: standard
kind: platform
description: Read when setting up or changing repository, package-manager, formatter, type, test, or CI configuration, or when installing or updating the toolkit.
version: 2.2.1
applies_to: [all]
---

# Shared baseline

Every JavaScript/TypeScript repository uses the same package manager, checks, and CI gates, with app-owned layout.

## Rules

- New JavaScript/TypeScript apps use pnpm, TypeScript, and Biome. Versions and formatter options live in configuration.
- Commit the lockfile. CI installs it frozen and runs the affected targets' lint/format, types, tests, and build.
- Existing test runners stay: Vitest on [web](web-baseline.md), Jest with Expo support on [mobile](mobile-baseline.md).
- Layout, package names, and deployment identities are project-owned.

### Dependencies

- Start `pnpm-workspace.yaml` from the [template](baseline/templates/pnpm-workspace.yaml): `minimumReleaseAge: 4320`, an `allowBuilds` ledger where every entry carries its reason, `virtualStoreDirMaxLength: 60`, and `verifyDepsBeforeRun: install`. A cooldown exemption names its date and reason.
- Approve build scripts only for native builds the dependency graph actually requires.
- A security override needs a demonstrated advisory and a compatible resolution. Never copy overrides from another app.
- Every dependency has an explicit version or semver range. Never `latest`, `*`, or a dist-tag; the lockfile pins what installs. Use `expo install` versions for SDK packages.
- One TypeScript channel: `typescript` from npm on the 6.0 line (`~6.0.x`), with no npm aliases. No `@typescript/native` and no alias to `@typescript/typescript6`: toolkit checks use the 6.0 compiler API, and Expo and Vite target 6.0. Move every app to 7 in one coordinated change.

### Configuration

- Every tsconfig keeps the root's strictness: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedSideEffectImports`. `noUncheckedIndexedAccess`: optional, per app, all targets at once.
- New TypeScript configuration comes from the framework scaffold. Never overwrite a framework-specific tsconfig with a generic one.
- Merge the [Biome fragment](baseline/templates/biome.fragment.json) into `biome.json`: tabs and double quotes; in `apps/mobile`, `noReactNativeRawText` (skipping the app's `AppText`) and `noRestrictedImports` that sends Convex query hooks through `src/convex/query-cache` ([Convex query caching](convex-query-caching.md)).
- CI starts from the [shared workflow](baseline/templates/ci.yml): check, env:check, typecheck for web, core, and mobile, Vitest, mobile Jest when present, and build. Monorepos apply root settings once and run target-specific workflows in the target's working directory. An optional [lefthook pre-commit](baseline/templates/lefthook.yml) runs `biome check --staged`.

### Toolkit

- Install and update the toolkit with `scripts/sync-devtools.mjs` (Node 22.15+, GitHub CLI authenticated for AppElent/developer-tools). Commit installed files and `.appelent/devtools.json`.
- Never edit toolkit-owned files in the project: change them upstream.
- Sync never runs downloaded code, provisions resources, enables a capability, or migrates application code. Review changed scripts before running them.
- After an update, apply the migration notes of changed standards you use, then run the app's checks.
- Install skills separately with the skills CLI.

## Implementation

Run from the repository root.

1. For a new web or Expo app, create it with the upstream scaffold, then follow [web](web-baseline.md) or [mobile](mobile-baseline.md); their scripts include this shared setup.
2. Install compatible Biome, TypeScript, and test dependencies first; setup adds scripts only for declared tools.
3. Run setup. Its header comment (`scripts/baseline.mjs`) lists what it creates and preserves.

   ```sh
   node scripts/baseline.mjs --dry-run
   node scripts/baseline.mjs --apply
   node scripts/check-project.mjs
   ```

   A non-pnpm lockfile blocks setup: review `pnpm import`, install, and remove the old lockfile only as an explicit package-manager migration.
4. `--ci` adds a workflow only when the required package scripts exist, and keeps an existing `ci.yml`. Inspect other workflows first to avoid duplicate checks.
5. Install or update the toolkit. Copy a reviewed `scripts/sync-devtools.mjs` once to bootstrap; it updates itself. Options, conflicts, interruption recovery, and upgrades from earlier updaters: [toolkit sync detail](baseline/toolkit.md).

   ```sh
   node scripts/sync-devtools.mjs --dry-run   # preview upstream changes
   node scripts/sync-devtools.mjs             # install or update everything
   node scripts/sync-devtools.mjs --check     # offline drift check
   npx skills add https://github.com/AppElent/developer-tools/tree/main/skills --skill '*' -a codex claude-code -g
   npx skills update
   ```

## Verify

- `node scripts/sync-devtools.mjs --check` passes.
- `node scripts/check-project.mjs` passes. It reads metadata and routing files only: no app code, dotenv values, or provider calls.
- Install, check, typecheck, test, and build pass for every target.

## Migration

From 2.1: compare `pnpm-workspace.yaml`, `biome.json`, and CI with the templates and add what is missing. Replace `latest` ranges with the installed versions. Add the root's strictness flags to `apps/mobile/tsconfig.json` and fix what they report. Record existing differences, such as another formatter style or an aliased TypeScript, as exceptions until they are migrated.
