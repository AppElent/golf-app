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
  not in a local env file.
- **Deploy target**: Cloudflare Workers, name `golf-app` (`golf-app-dev` for
  `wrangler deploy --env dev`). `wrangler.jsonc`'s `env.dev` block exists for this;
  add a top-level `vars` + `env.dev.vars` block if per-environment runtime vars are
  ever needed.
- **PR previews**: `.github/workflows/preview.yml` spins up a per-PR Convex preview
  deployment + a per-PR `golf-app-pr-<N>` Worker on open/sync/reopen, and tears the
  Worker down on close. It's dormant until this repo has a GitHub remote and the
  required secrets are set (`CONVEX_DEPLOY_KEY` — must be a Convex **Preview**-kind
  deploy key — `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
  `PREVIEW_CLERK_PUBLISHABLE_KEY`, optionally `NODE_AUTH_TOKEN`). `.github/workflows/ci.yml`
  runs check/typecheck/test/build on every push to `main` and every PR.
- **Supply-chain hardening**: `pnpm-workspace.yaml` sets `onlyBuiltDependencies`
  (esbuild/lightningcss/workerd/sharp only — `@clerk/shared`'s postinstall is denied,
  it only prints a telemetry notice) and `minimumReleaseAge: 1440` (1 day, tuned down
  from the usual 3-day default because this stack's "latest"-pinned deps age out fast
  enough to otherwise block every `pnpm run`). `verifyDepsBeforeRun: warn` keeps that
  cooldown enforced at `pnpm install`/`add` time without hard-failing routine script runs.

## Claude Code workflow layer

`.claude/skills/review-app` and `.claude/skills/review-session`, and
`.claude/commands/upgrade-deps.md`/`review-session.md`, are project-local copies of the
global `~/.claude/skills/custom-review-app` / `custom-review-session` /
`~/.claude/commands/custom-upgrade-deps.md` / `custom-review-session.md` templates
(renamed to avoid the duplicate-skill collision with the global versions). **The global
copies are the source of truth** — if you fix something in the project-local copy that
isn't project-specific (a process fix, not this app's route→module map), port that fix
back to the global file so future bootstrapped projects inherit it too.
`.claude/skills/verify/SKILL.md` is the one exception: it's project-specific by design
(its route→module map, currently a TODO stub since most routes are still scaffold demo
routes) and has no global counterpart.

## Known pre-existing issues (not yet fixed, scaffold-original)

- `pnpm typecheck` fails on `src/router.tsx` (unused imports: `ReactNode`, `QueryClient`,
  `TanstackQueryProvider`) and on `src/routes/demo/api.mcp-todos.ts` (a demo MCP route
  with an untyped request body) — pre-existing scaffold issues, not touched during
  bootstrap since they're unrelated to any specific change made here.
- `pnpm check` (Biome) reports ~60 errors across most of `src/**`: the scaffolded code
  uses single quotes and no semicolons, but `biome.json` is configured for double quotes
  — a project-wide reformat, not touched during bootstrap since it's unrelated to any
  specific change.
