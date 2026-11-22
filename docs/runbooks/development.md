---
type: runbook
description: Read when running Fairway locally, running its checks, or adding an environment variable.
version: 1.1.1
---

# Local development

A pnpm workspace (always pnpm, never npm or yarn):

| Part | Where | Stack |
| --- | --- | --- |
| Web app | repo root, routes in `src/routes/` | TanStack Start (React 19, SSR via Vite) on a Cloudflare Worker (`wrangler.jsonc`, `@cloudflare/vite-plugin`), `@clerk/react`, Tailwind v4 |
| Backend | `convex/` | Convex, for web and mobile |
| Mobile app | `apps/mobile/` | Expo, Expo Router, `@clerk/expo` ([mobile runbook](mobile.md)) |
| Shared logic | `packages/core/` (`@fairway/core`) | Dependency-free TypeScript |

Biome lints and formats. Vitest tests everything except `apps/mobile`, which uses
Jest.

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
pnpm verify           # check + typecheck + test + test:mobile; run before calling work done
pnpm build            # production web build
pnpm test:e2e         # Playwright smoke at desktop and phone widths (below)
pnpm cf-typegen       # regenerate worker-configuration.d.ts after editing wrangler.jsonc
pnpm courses:sync     # write the course catalog into the dev deployment
pnpm env:plan|env:apply|env:check <local|preview|staging|production>
```

One test file: `pnpm exec vitest run path/to/file.test.ts`. CI's `check` job
also runs `node scripts/check-project.mjs --strict`.

`pnpm test:e2e` (Playwright, `e2e/`) drives a running app in Chromium at 1440 and
390px wide. It is not part of `pnpm verify` or CI: it needs a live backend and
signs in as the Clerk development test user. Set `E2E_BASE_URL` (default
`http://localhost:3000`, or a PR preview URL), `E2E_USER_EMAIL` and
`E2E_USER_PASSWORD` (the `test-user-*` values), and run
`pnpm exec playwright install chromium` once. Screenshots land in
`test-results/`. The `sign-out` project (`e2e/sign-out.spec.ts`, 390px) signs
in and out in a session of its own, so it never revokes the session the
`desktop` and `phone` projects share; `--project=phone` alone skips it.

Demo rounds for one user: `seed:seedDummyData` seeds the user it runs as, but it
is an internal action and `convex run --identity` only runs public functions, so
it cannot be called directly. On a dev or worktree deployment (never
production), push a throwaway public action that calls it with
`ctx.runAction(internal.seed.seedDummyData, {})`, run that with
`pnpm exec convex run <file>:<name> --identity '{"subject":"user_…"}'`, then
delete the file and push again. A deployment made by
`node scripts/workspace.mjs prepare` is disposable and fits.

## Environment

- `env.manifest.ts` routes Infisical values (`/` shared, `/fairway`) through the
  `env:*` scripts ([environments](../standards/environments.md)).
- A new worktree gets its files from `node scripts/workspace.mjs prepare` (the
  `t3.json` hook), never by copying another checkout's.
- `convex dev` writes `CONVEX_DEPLOYMENT` in `.env.local`.
- Which Clerk instance and Convex deployment each environment uses:
  [deploy runbook](deploy.md#auth).
