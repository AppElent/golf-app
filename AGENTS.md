# AGENTS.md

Read `CLAUDE.md` for all project conventions (pnpm always, Biome, commands, testing).

## Upgrading dependencies

Follow the steps in `.claude/commands/upgrade-deps.md` (readable as plain markdown).
Never weaken or skip tests to make an upgrade pass; stop and report instead.

<!-- appelent-managed:start -->
## Appelent Managed Project

Read `CLAUDE.md` first.

Primary local source:
- `C:\Users\ericj\.claude\appelent`
- `C:\Users\ericj\.claude\skills`

Web/browser fallback committed in this repo:
- `.claude\appelent`
- `.claude\skills`

When adding generic functionality, prefer existing `@appelent/*` packages, bootstrap conventions, or capability skills before creating a new local-only pattern.

For how to use a shared `@appelent/*` package, read that package's own README — it is the source of truth (Claude skills are not visible here).

If global and repo-local instructions differ, prefer the global source locally. In web/browser environments, use the repo-local mirror and flag the drift.
<!-- appelent-managed:end -->
