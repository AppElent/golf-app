---
type: runbook
description: Read when running Fairway locally, running its checks, or adding an environment variable.
version: 1.0.0
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
pnpm cf-typegen       # regenerate worker-configuration.d.ts after editing wrangler.jsonc
pnpm courses:sync     # write the course catalog into the dev deployment
pnpm env:plan|env:apply|env:check <local|preview|staging|production>
```

One test file: `pnpm exec vitest run path/to/file.test.ts`. CI's `check` job
also runs `node scripts/check-project.mjs --strict`.

Demo rounds for one user:
`pnpm exec convex run seed:seedDummyData --identity '{"subject":"user_…"}'`.

## Environment

- `env.manifest.ts` routes Infisical values (`/` shared, `/fairway`) through the
  `env:*` scripts ([environments](../standards/environments.md)).
- A new worktree gets its files from `node scripts/workspace.mjs prepare` (the
  `t3.json` hook), never by copying another checkout's.
- `convex dev` writes `CONVEX_DEPLOYMENT` in `.env.local`.
- Which Clerk instance and Convex deployment each environment uses:
  [deploy runbook](deploy.md#auth).
