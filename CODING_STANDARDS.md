---
version: 4.2.0
description: Coding rules and task-specific implementation references.
---

# Coding standards

<!-- appelent-standards:start -->
## Shared guidance

Read only what the task needs; never preload every standard.

1. **Every code change:** [general coding](docs/standards/general-coding.md), plus [mobile coding](docs/standards/mobile-coding.md) for native code.
2. **When the task matches a row:** the linked standard.

| Task | Read |
| --- | --- |
| Adding, moving, or naming native files | [Mobile structure](docs/standards/mobile-structure.md) |
| Deciding which platforms a feature ships on, adding or moving a web or mobile route, or shareable links | [Platform parity](docs/standards/platform-parity.md) |
| Making a shared, join, or invite link open the app; associated domains for password-manager autofill | [App links](docs/standards/app-links.md) |
| Repository, package manager, formatter, types, tests, CI, or toolkit sync | [Baseline](docs/standards/baseline.md) |
| Top-level folders, workspace packages, or shared code between web, Convex, and mobile | [Repository layout](docs/standards/repo-layout.md) |
| Dependabot or automated dependency PRs | [Dependency updates](docs/standards/dependency-updates.md) |
| Web app stack, UI states, or browser capabilities | [Web baseline](docs/standards/web-baseline.md) |
| Expo setup or native configuration | [Mobile baseline](docs/standards/mobile-baseline.md) |
| Native builds, getting one onto a phone, TestFlight, OTA updates, or releases | [Mobile distribution](docs/standards/mobile-distribution.md) |
| Running, driving or screenshotting the mobile app on an iOS simulator | [Mobile run](docs/standards/mobile-run.md) |
| Reporting work as done, verified, or accepted | [Verification](docs/standards/verification.md), then the project's check commands |
| Environment variables, secrets, `env.manifest.ts`, or `env:*` scripts | [Environments](docs/standards/environments.md) |
| Claude Code settings, hooks, allow or deny rules, or a command the deny list blocked | [Agent permissions](docs/standards/agent-permissions.md) |
| Creating, preparing, or cleaning a worktree | [Workspaces](docs/standards/workspaces.md) |
| Authentication | [Auth](docs/standards/auth.md) |
| Convex functions, schema, migrations, seeds, tests, or account deletion and export | [Convex backend](docs/standards/convex.md) |
| Convex query reads, subscription retention, or local read caches | [Convex query caching](docs/standards/convex-query-caching.md) |
| Localization | [i18n](docs/standards/i18n.md) |
| Error reporting and source maps | [Sentry monitoring](docs/standards/sentry-monitoring.md) |
| In-app problem reports | [Issue reporting](docs/standards/issue-reporting.md) |
| Pull-request previews | [Previews](docs/standards/previews.md) |
| Staging or production deploys, deploy workflows, or branch rules | [Deployments](docs/standards/deployments.md) |
| When a change ships where, release cadence, versioning, tags, or rollback | [Releases](docs/standards/releases.md) |
| Web manifest, installability, or service worker | [PWA](docs/standards/pwa.md) |
| Application CLI or browser login for it | [App CLI](docs/standards/app-cli.md) |
| MCP server or tools | [MCP](docs/standards/mcp.md) |
| Documentation or instruction changes | [Documentation](docs/standards/documentation.md) |
| Loading an external skill (Expo, Vercel React Native, better-*) | [Specialist skills](docs/standards/specialist-skills.md) |

### Working with standards

- **Conform:** follow standards as written. Rules are required unless marked **Default**. Installed copies are never edited in the project.
- **Improve:** when a standard is wrong, unclear, or missing a rule other projects would share, propose the change upstream with the `developer-tools` skill: a pull request when concrete, an issue when not.
- **Differ:** when this project needs something else, discuss it with the user first; never deviate silently. Record the agreed exception below: rule, scope, replacement, reason.

Project decisions below select implementations and explain deviations from shared defaults.
<!-- appelent-standards:end -->

## Project decisions

### Mobile (`apps/mobile`)

- **Workspace:** domain logic shared by web and mobile lives in `@fairway/core`
  (`packages/core`, raw TypeScript subpath exports such as `@fairway/core/geo`).
  Convex functions in `convex/` serve both apps.
- **Online first, disposable cache:** Convex is the only source of truth and a
  write is saved when the server acknowledges it. On-device storage is limited to
  phone preferences (`src/prefs/local-preference.ts`) and the query cache
  (including its last-known copy), and
  deleting either never loses data. No offline write queue in v1.
- **Convex query caching: `last-known`** (Layers 1 and 2), adopted for
  APP-146 under [convex-query-caching](docs/standards/convex-query-caching.md)
  1.4.0 and [auth](docs/standards/auth.md) 3.2.0, copied by hand from
  developer-home `2e49506` (the toolkit sync still ships 1.3.0 and 3.1.0, so
  `--check` reports both files as local drift until it catches up).
  Layer 1: 5 min expiration, 20 idle entries (`src/convex/query-cache.tsx`,
  mounted by `(app)/_layout` below `ConvexSessionGate`, keyed by account, ready
  once `account.viewer` names the Clerk account; it writes the
  confirmed-account marker and prunes other accounts and bundles). Layer 2:
  `src/convex/last-known.ts` on `expo-sqlite/kv-store`, values up to 1,000,000
  characters (a course with all hole geometry is ~300k), at most 50 entries,
  bundle version = runtime fingerprint + OTA update id. Persisted, whole:
  `rounds:active`, `courses:get`, `settings:get`, `clubs:list`
  (`src/convex/persisted.ts`). Offline-readable: the same four modules. The
  session gate's offline fallback draws the active round's play screen from
  them (`src/features/play/offline/`), display only: no Convex calls, no hole
  change written, no scoring or shot marking, when Clerk restored the session
  locally (`__experimental_resourceCache`) and its account is the one Convex
  last confirmed here. Confirmed sign-out deletes the copy and the marker.
  Forms and write decisions read `useLiveQuery` (round setup, course picker,
  score sheet, scorecard, Home, handicap, home course, club editor, course
  suggestion). Deviation from the `last-known` starter, as in Gather: the
  provider stays inside the gate and prunes when Convex confirms the account.
  Offline scoring is out of scope (Eric, 2026-11-17).
- **Data access:** query hooks come from `src/convex/query-cache`, mutations from
  `convex/react`, `Id`/`Doc` types from `src/convex/api`.
- **Exception — tests:** Jest (`jest-expo`) inside `apps/mobile` only; the rest of
  the repo stays on Vitest. Scope: `apps/mobile/src/**/*.test.ts(x)`. Reason: the
  React Native transform and native-module mocks are only maintained for Jest.

Project facts (identity, env, builds): [mobile runbook](docs/runbooks/mobile.md).

### Baseline and toolkit (recorded 2026-11-01)

- **Exception — CI triggers:** `ci.yml` runs on `pull_request` and
  `workflow_call` instead of `push: main`. `deploy.yml` calls it as its first job,
  so a merge is checked once and deploys only after it passes. Node is
  `22` (latest 22.x, ≥ 22.15), set once in `.github/actions/setup`, not a pinned
  `22.15.0`. One root `pnpm typecheck` covers web, convex, core and mobile.
- **Toolkit copies with Fairway settings:** `scripts/convex-sentry.mjs` is the
  toolkit forwarder verbatim; `pnpm sentry:convex` sets `SENTRY_APP=fairway-convex`
  and falls back to `VITE_SENTRY_DSN` ([Sentry runbook](docs/runbooks/sentry.md)).
  `scripts/check-mobile-structure.mjs` (mobile-structure 1.1) adds the app and
  language names to `UNTRANSLATED` and skips `console.*` calls, which upstream
  reports as toast text.
  `apps/mobile/scripts/fingerprint.mjs` and `.github/workflows/mobile-runtime.yml`
  (mobile-baseline templates) add `WATCHED` native packages, a `check` command
  and a final `check` step that fails the PR when one drops out of a
  fingerprint ([mobile runbook](docs/runbooks/mobile.md#runtime-fingerprint-check)).
- **Not yet migrated** (differences from shared standards, to be agreed or fixed):
  - [Convex backend](docs/standards/convex.md): the auth helper is `getUserId`
    in `convex/lib.ts`, not `convex/lib/auth.ts`; public functions declare no
    `returns` validators; `ConvexError` codes are not typed against a shared
    catalog; `account:deleteMyData` has no `expectedSubject` or batching and
    does not walk the per-table registry (`convex/userData.ts`) that data
    export (`account:exportPage`) reads by; a test checks that an export after
    deletion is empty.
  - [i18n](docs/standards/i18n.md): the web app hardcodes English; only
    `apps/mobile` has a catalog.
