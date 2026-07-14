# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

TanStack Start (React 19, file-based routing under `src/routes/`, SSR via Vite) +
Convex (backend, `convex/`) + Clerk (auth, `@clerk/clerk-react`) + Cloudflare Workers
(deploy target, `wrangler.jsonc` + `@cloudflare/vite-plugin`) + Tailwind v4 + Biome
(lint/format) + Vitest (tests). **Package manager: pnpm, always** — never npm or yarn.

## Commands

```bash
pnpm dev              # Vite dev server only, port 3000
pnpm dev:all          # push Convex functions once, then start Vite (no ongoing Convex watch)
pnpm dev:watch        # Convex dev (watching) + Vite together — use this when editing convex/
pnpm generate-routes  # tsr generate (route tree codegen)
pnpm build            # production build
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest run (passWithNoTests: true — no tests exist yet)
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
  + Clerk's `useAuth` (not the plain `ConvexProvider`) so Convex functions can see the
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
- **Convex functions**: `convex/todos.ts` (schema in `convex/schema.ts` also has an
  unused `products` table left from scaffolding). No `convex/seed.ts` yet.
- **Env vars**: `.env.local` (gitignored) holds `VITE_CLERK_PUBLISHABLE_KEY`,
  `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL` — see `.env.example` for the full list
  (values never committed). `CLERK_JWT_ISSUER_DOMAIN` lives on the Convex deployment,
  not in a local env file — set on dev (`pnpm exec convex env set`) and as the
  `preview` deployment-type default (`pnpm exec convex env default set ... --type
  preview`), both already configured. **Not yet set on the prod deployment** — the
  first real `pnpm deploy:prod` will need `CLERK_JWT_ISSUER_DOMAIN` set via
  `pnpm exec convex env set CLERK_JWT_ISSUER_DOMAIN <value> --prod` first, or Convex
  functions can't read the signed-in identity in production.
- **Deploy target**: Cloudflare Workers, name `golf-app` (`golf-app-dev` for
  `wrangler deploy --env dev`). `wrangler.jsonc`'s `env.dev` block exists for this;
  add a top-level `vars` + `env.dev.vars` block if per-environment runtime vars are
  ever needed.
- **PR previews**: `.github/workflows/preview.yml` spins up a per-PR Convex preview
  deployment + a per-PR `golf-app-pr-<N>` Worker on open/sync/reopen, and tears the
  Worker down on close. The repo has a GitHub remote (`AppElent/golf-app`) and all
  required secrets are set (`CONVEX_DEPLOY_KEY`, `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID`, `PREVIEW_CLERK_PUBLISHABLE_KEY`, `NODE_AUTH_TOKEN`). It has
  no `--preview-run` seed step yet — there's no `convex/seed.ts` in this app, so PR
  previews currently deploy a genuinely empty Convex backend; wire seeding once seed
  data exists (see the baseline skill's preview-seeding subsection). `.github/workflows/ci.yml`
  runs check/typecheck/test/build on every push to `main` and every PR.
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
