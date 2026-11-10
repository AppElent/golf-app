# AGENTS.md

<!-- appelent-guidelines:start -->
Before implementing or reviewing code, read CODING_STANDARDS.md.
For UI work, also read DESIGN_SYSTEM.md. Follow their task-specific links.
<!-- appelent-guidelines:end -->

## Stack

pnpm workspace, **pnpm always** (never npm or yarn):

- Web app at the repo root: TanStack Start (React 19, file routes in `src/routes/`,
  SSR via Vite) on a Cloudflare Worker (`wrangler.jsonc`, `@cloudflare/vite-plugin`),
  Clerk (`@clerk/react`), Tailwind v4.
- `convex/`: the backend for web and mobile.
- `apps/mobile`: the Fairway mobile app (Expo, Expo Router, `@clerk/expo`). Read
  `apps/mobile/AGENTS.md` before touching it.
- `packages/core` (`@fairway/core`): dependency-free domain logic shared by both apps.

Biome lints and formats. Vitest tests everything except `apps/mobile`, which uses Jest.

## Commands

```bash
pnpm dev              # Vite dev server only, port 3000
pnpm dev:watch        # Convex dev (watching) + Vite; use when editing convex/
pnpm generate-routes  # route tree codegen
pnpm check            # Biome + mobile structure + repo layout checks
pnpm lint:fix         # biome check --write
pnpm typecheck        # root, convex, packages/core, apps/mobile
pnpm test             # Vitest: web, convex (convex-test), packages/core
pnpm test:mobile      # Jest in apps/mobile
pnpm build            # production web build
pnpm cf-typegen       # regenerate worker-configuration.d.ts after editing wrangler.jsonc
pnpm courses:sync     # write the course catalog into the dev deployment
pnpm env:plan|env:apply|env:check <local|preview|staging|production>
```

Single test file: `pnpm exec vitest run path/to/file.test.ts`.

## Architecture

- **Root shell**: `src/routes/__root.tsx` wraps the app in `ClerkProvider` →
  `ConvexProvider` → `AuthGate`. The gate shows Clerk's sign-in when signed out
  and mounts children once Convex has the token. Dark mode follows the OS through
  a `prefers-color-scheme` media query in `src/styles.css`.
- **Clerk ↔ Convex**: `convex/auth.config.ts` reads `CLERK_JWT_ISSUER_DOMAIN`, a
  Convex deployment env var. The web client uses `ConvexProviderWithClerk`
  (`src/integrations/convex/provider.tsx`).
- **Auth in Convex**: every per-user function calls `getUserId` (`convex/lib.ts`)
  and checks ownership of the documents it touches. Seeds and the catalog sync
  are internal functions (admin key only). `convex/functions.test.ts` covers
  these rules; extend it when you add a public function.
- **Courses** are a fixed dataset in `convex/catalog/`, written by the idempotent
  internal `courseCatalog:sync`. They are read-only to users, who can fork a private
  copy or suggest a correction. Read `docs/runbooks/course-catalog.md` before
  touching course data. `seed:seedDummyData` adds demo rounds for one user:
  `pnpm exec convex run seed:seedDummyData --identity '{"subject":"user_…"}'`.
- **Env vars**: `env.manifest.ts` routes Infisical values (`/`, `/fairway`) with
  the `env:*` scripts (see `docs/standards/environments.md`). Web PR previews use the
  Clerk development instance; staging and production use the production instance.
  A new worktree gets its files from `node scripts/workspace.mjs prepare` (the
  `t3.json` hook), never by copying another checkout's. `CONVEX_DEPLOYMENT` in
  `.env.local` is written by `convex dev`.
- **Sentry**: one project (`appelent/fairway`) for browser (`src/instrument.client.ts`
  via `src/client.tsx`), Worker SSR (`src/server.ts`, the `wrangler.jsonc` `main`),
  Convex (`pnpm sentry:convex` log forwarder, not yet hosted) and mobile; shared
  helpers in `src/lib/observability/`. Local hosts never report. Read
  `docs/runbooks/sentry.md` before touching it.
- **Deploy**: Worker `golf-app` on `fairway.appelent.nl` (production Clerk signs in
  only on `*.appelent.nl`), with a `staging` env whose Worker is `golf-app-stg` on `fairway-stg.appelent.nl`.
  Staging is a frontend on the production Convex deployment; only production deploys
  Convex. The Vite plugin
  picks the Worker env at build time from `CLOUDFLARE_ENV`; `wrangler deploy --env`
  is ignored. A merge to `main` runs `.github/workflows/deploy.yml`. Read
  `docs/runbooks/deploy.md` before changing it.
- **PR previews**: label `preview:web` runs `.github/workflows/preview.yml`: a
  per-PR Convex preview deployment and a route-free `golf-app-pr-<N>` Worker on
  workers.dev (`CLOUDFLARE_ENV=pr`). Labels `build:ios` and `build:android` build the
  mobile dev client (`mobile-build.yml`). See `docs/standards/previews.md`.
- **Supply chain**: `pnpm-workspace.yaml` sets `allowBuilds` (default deny) and
  `minimumReleaseAge: 4320` with `verifyDepsBeforeRun: install`.

## Upgrading dependencies

Follow the `upgrade-deps` skill (`.claude/skills/upgrade-deps/SKILL.md`). Never weaken or skip tests to make an
upgrade pass; stop and report instead.

## Docs

- Runbooks: `docs/runbooks/` (deploy, mobile, course catalog, Sentry). Map: [docs/README.md](docs/README.md).
- `.claude/skills/verify` is project-specific. `review-app`, `review-session` and
  `upgrade-deps` there are copies of the `appelent` plugin's skills; port
  non-project fixes back to the plugin.
