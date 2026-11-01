---
type: runbook
description: Read before changing how the web app and Convex reach staging or production, or when a release is stuck.
---

# Deploys

A merge to `main` runs **Deploy** (`.github/workflows/deploy.yml`):

1. **checks**: `ci.yml` (Biome, typecheck, tests, build).
2. **stg**: Convex `staging` deployment, course catalog sync, Worker
   `golf-app-stg`, smoke check.
3. **production**: waits for approval on the `production` GitHub
   Environment (Actions → the run → *Review deployments*), then the same
   steps against production Convex and the `golf-app` Worker.
4. **mobile**: `mobile-update.yml` publishes an EAS update to channel
   `preview` when the app changed (see [mobile](mobile.md#builds)). It runs
   after production because `preview` builds use production Convex.

A manual **Run workflow** on another branch deploys that branch to staging
only. Production always deploys from `main`.

Dev is not a deployed environment: it is `pnpm dev` against your own
`convex dev` deployment. `pnpm deploy:dev` / `pnpm deploy:prod` remain as a
manual escape hatch; nothing automated calls them.

## One-time setup

1. Staging Convex deployment, inside the existing project:

   ```sh
   pnpm exec convex deployment create staging --type prod
   ```

   Never pass `--default`: it would make `staging` the project's production
   deployment, and `pnpm deploy:prod` would quietly deploy there. Set its
   Clerk issuer (the test instance, like dev):

   ```sh
   pnpm exec convex env set CLERK_JWT_ISSUER_DOMAIN <issuer> --deployment staging
   ```

2. Deploy keys (Convex dashboard → deployment → Settings → Deploy keys) for
   `staging` and for production. Both start with `prod:`; the workflow
   refuses anything else.
3. GitHub Environments (repo Settings → Environments):

   | Name | Secrets | Variables | Protection |
   | --- | --- | --- | --- |
   | `stg` | `CONVEX_DEPLOY_KEY` (staging key) | `VITE_CLERK_PUBLISHABLE_KEY` (test instance) | Branch: any |
   | `production` | `CONVEX_DEPLOY_KEY` (production key) | `VITE_CLERK_PUBLISHABLE_KEY` (production instance) | Required reviewer: you; branch: `main` |

   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `EXPO_TOKEN` stay at
   repo level. The repo-level `CONVEX_DEPLOY_KEY` stays the *preview* key for
   PR previews: an environment secret shadows a repo secret of the same name
   only inside a job that names that environment.

## Verify

- The run's summary links each environment's URL; the smoke check fetched it.
- The Convex dashboard still marks the original production deployment as
  the project default, not `staging`.

## When it goes wrong

- **Production never starts**: it is waiting for approval, or a newer merge
  replaced it in the queue. Approve the newest run.
- **Check environment fails**: the named value is missing on that GitHub
  Environment.
- **Catalog sync fails after the Convex deploy**: functions are live, the
  Worker is not flipped. Fix and re-run the job; the sync is idempotent.
