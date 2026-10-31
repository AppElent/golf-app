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
| Repository, package manager, formatter, types, tests, CI, or toolkit sync | [Baseline](docs/standards/baseline.md) |
| Dependabot or automated dependency PRs | [Dependency updates](docs/standards/dependency-updates.md) |
| Web app stack, UI states, or browser capabilities | [Web baseline](docs/standards/web-baseline.md) |
| Expo setup, native configuration, builds, or releases | [Mobile baseline](docs/standards/mobile-baseline.md) |
| Verification | [Verification](docs/standards/verification.md), then the project's check commands |
| Environment variables and secrets | [Environments](docs/standards/environments.md) |
| Worktrees and isolated backends | [Workspaces](docs/standards/workspaces.md) |
| Authentication | [Auth](docs/standards/auth.md) |
| Convex query reads, subscription retention, or local read caches | [Convex query caching](docs/standards/convex-query-caching.md) |
| Localization | [i18n](docs/standards/i18n.md) |
| Error reporting and source maps | [Sentry monitoring](docs/standards/sentry-monitoring.md) |
| In-app problem reports | [Issue reporting](docs/standards/issue-reporting.md) |
| Pull-request previews | [Previews](docs/standards/previews.md) |
| Web manifest, installability, or service worker | [PWA](docs/standards/pwa.md) |
| Application CLI or browser login for it | [App CLI](docs/standards/app-cli.md) |
| MCP server or tools | [MCP](docs/standards/mcp.md) |
| Documentation or instruction changes | [Documentation](docs/standards/documentation.md) |
| Specialist tasks | [Specialist skills](docs/standards/specialist-skills.md) |

### Working with standards

- **Conform:** follow standards as written. Installed copies are never edited in the project.
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
  phone preferences (`src/prefs/local-preference.ts`) and the query cache, and
  deleting either never loses data. No offline write queue in v1.
- **Data access:** query hooks come from `src/convex/query-cache`, mutations from
  `convex/react`, `Id`/`Doc` types from `src/convex/api`.
- **Exception — tests:** Jest (`jest-expo`) inside `apps/mobile` only; the rest of
  the repo stays on Vitest. Scope: `apps/mobile/src/**/*.test.ts(x)`. Reason: the
  React Native transform and native-module mocks are only maintained for Jest.
- **Exception — Sentry:** not wired yet. Scope: mobile. Replacement:
  `src/monitoring/report-problem.ts` returns `false` and the UI explains it.
  Reason: no Sentry project or DSN exists for Fairway yet (#3).

Project facts (identity, env, builds): [mobile runbook](docs/runbooks/mobile.md).
