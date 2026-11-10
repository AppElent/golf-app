---
type: runbook
description: Read before changing how the web app and Convex reach staging or production, or when a release is stuck.
---

# Deploys

A merge to `main` runs **Deploy** (`.github/workflows/deploy.yml`), which calls
`deploy-web.yml` once per target:

1. **checks**: `ci.yml` (Biome, typecheck, tests, build).
2. **staging**: Convex `staging` deployment, course catalog sync, Worker
   `golf-app-stg`, smoke check.
3. **production**: waits for approval on the `production` GitHub
   Environment (Actions → the run → *Review deployments*), then the same
   steps against production Convex and the `golf-app` Worker on
   https://fairway.appelent.nl.
4. **mobile**: `mobile-update.yml` publishes an EAS update to channel
   `preview` when the app changed (see [mobile](mobile.md#builds)). It runs
   after production because `preview` builds use production Convex.

A manual **Run workflow** on another branch deploys that branch to staging
only. Production always deploys from `main`. There is no `dev` environment and
no local deploy script: local work runs against your worktree's own Convex
deployment (`appelent.json` `workspace.backend`).

## Auth

Auth follows the Infisical tier ([environments](../standards/environments.md)).
PR previews read Infisical `staging`, whose `clerk-publishable-key` and
`clerk-jwt-issuer-domain` reference the `dev` values, so their web build and
per-PR backend use the Clerk development instance. The installed preview app
(EAS `preview`, written from `staging`) and production read Infisical `prod` and
use the production instance (`clerk.appelent.nl`).

**Exception, until staging gets a host under `appelent.nl`:** the production
instance signs in only on `*.appelent.nl`, and the staging Worker is served on
workers.dev. Staging web and its Convex backend therefore read
`staging-clerk-publishable-key` and `staging-clerk-jwt-issuer-domain`
(Infisical `prod`, `/fairway`, references to the `dev` values) instead of
production auth. When staging gets a subdomain, add it as the Worker's route,
move staging to the regular Clerk landings in `env.manifest.ts`, delete those two
keys, and delete this exception.

## Values

Each target's values live in its GitHub Environment (`staging`, `production`);
PR previews and the mobile workflows read repository-scope `PREVIEW_<name>`
values. All of them come from Infisical through `env.manifest.ts`:

```sh
pnpm env:plan staging                 # review, then
pnpm env:apply staging --only github
pnpm env:apply production --only github
pnpm env:apply preview --only github
```

Staging and production both read Infisical `prod`. The staging deploy key is
`convex-staging-deploy-key` in Infisical `prod` (`/fairway`); `convex-deploy-key`
in Infisical `staging` is the preview key PR previews use.

## One-time setup

1. Staging Convex deployment, inside the existing project:

   ```sh
   pnpm exec convex deployment create staging --type prod
   ```

   Never pass `--default`: it would make `staging` the project's production
   deployment, and every `--prod` command would quietly target it.

2. Deploy keys (Convex dashboard → deployment → Settings → Deploy keys) for
   `staging` and for production. Both start with `prod:`; the workflow
   refuses anything else. Store them in Infisical `prod` under `/fairway`
   (`convex-staging-deploy-key` and `convex-deploy-key`).
3. GitHub Environments `staging` (no protection) and `production` (required
   reviewer: you; branch: `main`), then the `env:apply` commands above.

## Verify

- The run's summary links each environment's URL; the smoke check fetched it.
- The Convex dashboard still marks the original production deployment as
  the project default, not `staging`.

## When it goes wrong

- **Production never starts**: it is waiting for approval, or a newer merge
  replaced it in the queue. Approve the newest run.
- **Build targets the wrong Worker**: the Cloudflare Vite plugin writes the
  Worker name into `dist/server/wrangler.json` from `CLOUDFLARE_ENV` at build
  time, and `wrangler deploy --env` is ignored. The deploy step refuses a
  mismatched name.
- **Check environment fails**: the named value is missing on that GitHub
  Environment, or `CONVEX_DEPLOY_KEY` is not a `prod:` key. Run
  `pnpm env:plan <environment>`, fix Infisical, and apply again.
- **Catalog sync fails after the Convex deploy**: functions are live, the
  Worker is not flipped. Fix and re-run the job; the sync is idempotent.
