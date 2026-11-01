# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

TanStack Start (React 19, file-based routing under `src/routes/`, SSR via Vite) +
Convex (backend, `convex/`) + Clerk (auth, `@clerk/clerk-react`) + Cloudflare Workers
(deploy target, `wrangler.jsonc` + `@cloudflare/vite-plugin`) + Tailwind v4 + Biome
(lint/format) + Vitest (tests). **Package manager: pnpm, always** — never npm or yarn.

pnpm workspace: the web app at the root, the **Fairway mobile app** in `apps/mobile`
(Expo SDK 58, Expo Router, `@clerk/expo`, Convex — read `apps/mobile/AGENTS.md`
before touching it), and shared domain logic in `packages/core` (`@fairway/core`).
`convex/` serves both apps.

## Commands

```bash
pnpm dev              # Vite dev server only, port 3000
pnpm dev:all          # push Convex functions once, then start Vite (no ongoing Convex watch)
pnpm dev:watch        # Convex dev (watching) + Vite together — use this when editing convex/
pnpm generate-routes  # tsr generate (route tree codegen)
pnpm build            # production build
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest run (web, convex — functions via convex-test, packages/core)
pnpm test:mobile      # jest in apps/mobile
pnpm check            # biome check (lint + format check)
pnpm lint:fix         # biome check --write
pnpm cf-typegen       # regenerate worker-configuration.d.ts (rerun after editing wrangler.jsonc)
pnpm deploy:dev       # convex dev --once, build:development, wrangler deploy --env dev
pnpm deploy:prod      # convex deploy, build, wrangler deploy (aliased as `pnpm deploy`)
```

Single test file: `pnpm exec vitest run path/to/file.test.ts`.

## Architecture

- **Root shell**: `src/routes/__root.tsx` wraps the whole app in `ClerkProvider` (outer)
  → `ConvexProvider` (inner) → `Header`/`Footer`. A pre-paint theme script
  (`THEME_INIT_SCRIPT`, imported from `@appelent/auth`) is inlined in `<head>` to avoid
  a flash of unstyled content before React hydrates.
- **Clerk ↔ Convex auth bridge**: `convex/auth.config.ts` reads `CLERK_JWT_ISSUER_DOMAIN`
  (a Convex deployment env var, not a local `.env` var — set via
  `pnpm exec convex env set CLERK_JWT_ISSUER_DOMAIN <value>`, and via
  `convex env default set ... --type preview` for PR previews). The client side is
  wired in `src/integrations/convex/provider.tsx`, which uses `ConvexProviderWithClerk`
  - Clerk's `useAuth` (not the plain `ConvexProvider`) so Convex functions can see the
    signed-in user via `ctx.auth.getUserIdentity()`.
- **`@appelent/auth`** (private package, `@appelent:registry` mapped in `.npmrc` to
  GitHub Packages — see `.npmrc`/CI workflows for the auth-token wiring) supplies the
  theme utilities (`getInitialMode`, `applyThemeMode`, `ThemeMode`, `THEME_INIT_SCRIPT`)
  used in `src/components/ThemeToggle.tsx` and `__root.tsx`. Its `HeaderUser` /
  `AuthConfigProvider` / sign-in-flow components are **not** wired in yet — they need an
  `/account` route (and sign-in/sign-up routes) this app doesn't have. The current
  `src/integrations/clerk/header-user.tsx` is still the hand-rolled Clerk
  `SignedIn`/`SignedOut`/`UserButton` version; swap it for the package's `HeaderUser`
  once those routes exist.
- **Courses** are a fixed dataset in `convex/catalog/` (curated JSON per
  course + OSM geometry), written into a deployment by the idempotent
  `courseCatalog:sync` — read-only to users, who can fork a private copy or
  suggest a correction. Read `docs/runbooks/course-catalog.md` before touching
  course data. `convex/seed.ts`: `seedData` (= the catalog sync) and
  `seedDummyData` (handicap/clubs/3 finished rounds/1 active round for one
  `--identity`; skips if any round exists). `convex/seedPreview.ts` wraps the
  sync for `--preview-run` (Convex accepts one function name there).
- **Env vars**: routed by `env.manifest.ts` from Infisical (`/` and `/fairway`)
  with `pnpm run env plan|apply|check <local|preview|production>` (see
  `docs/standards/environments.md`). It owns the local `.env.local` files, the EAS
  environments, `CLERK_JWT_ISSUER_DOMAIN` on Convex dev and prod, and the
  `EXPO_TOKEN` secret. The Convex **preview** default and the web CI secrets are
  still set by hand (the preview default pairs with the test-instance
  `PREVIEW_CLERK_PUBLISHABLE_KEY`). `CONVEX_DEPLOYMENT` in `.env.local` is
  written by `convex dev`, not the manifest.
- **Sentry**: one project (`appelent/fairway`) for browser (`src/instrument.client.ts`
  via `src/client.tsx`), Worker SSR (`src/server.ts`, the `wrangler.jsonc` `main`),
  Convex (`pnpm sentry:convex` log forwarder, not yet hosted) and mobile; shared
  helpers in `src/lib/observability/`. Local hosts never report. Read
  `docs/runbooks/sentry.md` before touching it.
- **Deploy target**: Cloudflare Workers, name `golf-app` (`golf-app-stg` for
  `--env stg`, `golf-app-dev` for `--env dev`). A merge to `main` runs
  `.github/workflows/deploy.yml`: checks → staging (Convex `staging`
  deployment) → production after approval on the `production` GitHub
  Environment → EAS update to the mobile `preview` channel. Read
  `docs/runbooks/deploy.md` before changing it. `pnpm deploy:dev` /
  `deploy:prod` are a manual escape hatch.
- **PR previews** (opt-in, label `preview:web`): `.github/workflows/preview.yml`
  spins up a per-PR Convex preview deployment + a per-PR `golf-app-pr-<N>` Worker
  while the label is on (redeploying on push), syncs the course catalog
  (`--preview-run seedPreview:seedPreview`, no network calls), and tears the
  Worker down on unlabel or close. Labels `build:ios` / `build:android` build the
  mobile dev client the same way (`mobile-build.yml`, no EAS credits). Requires `CONVEX_DEPLOY_KEY` (a Convex
  **Preview**-kind deploy key), `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
  `PREVIEW_CLERK_PUBLISHABLE_KEY`, optionally `NODE_AUTH_TOKEN` — and the
  `CLERK_JWT_ISSUER_DOMAIN` **preview**-type default, since each preview deployment
  is a fresh backend that doesn't inherit dev/prod env vars. `.github/workflows/ci.yml`
  runs check/typecheck/test/build on every PR and as the first job of every deploy.
  The `main` ruleset requires a pull request with a passing `check` job.
- **Supply-chain hardening**: `pnpm-workspace.yaml` sets `onlyBuiltDependencies`
  (esbuild/lightningcss/workerd/sharp only — `@clerk/shared`'s postinstall is denied,
  it only prints a telemetry notice) and `minimumReleaseAge: 1440` (1 day, tuned down
  from the usual 3-day default because this stack's "latest"-pinned deps age out fast
  enough to otherwise block every `pnpm run`). `verifyDepsBeforeRun: warn` keeps that
  cooldown enforced at `pnpm install`/`add` time without hard-failing routine script runs.

## Claude Code workflow layer

`.claude/skills/review-app`, `.claude/skills/review-session`, and
`.claude/skills/upgrade-deps` are project-local copies of the `appelent` plugin's
bundled `skills/review-app`/`skills/review-session`/`skills/upgrade-deps` — **the
plugin's copies are the source of truth** for those three. `.claude/commands/review-session.md`
is a project-local copy of the global `~/.claude/commands/custom-review-session.md`
template — the global copy remains the source of truth for that one.
`.claude/commands/upgrade-deps.md` predates the skill-based refactor and is a
self-contained command (not a thin launcher); `.claude/commands/babysit.md` has no
external source, it's authored per-repo. If you fix something in a project-local copy
that isn't project-specific (a process fix, not this app's route→module map), port
that fix back to whichever source copy it traces to. `.claude/skills/verify/SKILL.md`
is the one exception: it's project-specific by design (its route→module map, currently
a TODO stub since most routes are still scaffold demo routes) and has no source-of-truth
counterpart at all.

## Known pre-existing issues (not yet fixed, scaffold-original)

- `pnpm typecheck` fails on `src/router.tsx` (unused imports: `ReactNode`, `QueryClient`,
  `TanstackQueryProvider`) and on `src/routes/demo/api.mcp-todos.ts` (a demo MCP route
  with an untyped request body) — pre-existing scaffold issues, not touched during
  bootstrap since they're unrelated to any specific change made here.
- `pnpm check` (Biome) reports 55 errors / 9 warnings across most of `src/**`: the scaffolded code
  uses single quotes and no semicolons, but `biome.json` is configured for double quotes
  — a project-wide reformat, not touched during bootstrap since it's unrelated to any
  specific change.

<!-- appelent-managed:start -->

## Appelent Managed Project

This is an Appelent-managed app. Opted-in features and their options are
recorded in `appelent.json`. Feature definitions live in the `appelent`
plugin (locally installed) or https://github.com/AppElent/appelent-packages
(`skills/<feature>/FEATURE.md`).

Before adding functionality that could apply to multiple apps, check the
feature catalog first. To add or update a feature, use `/appelent`.

<!-- appelent-managed:end -->

<!-- appelent-guidelines:start -->
Read [AGENTS.md](AGENTS.md).
<!-- appelent-guidelines:end -->
