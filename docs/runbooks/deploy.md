---
type: runbook
description: Read before changing how the web app and Convex reach staging or production, or when a release is stuck.
---

# Deploys

A merge to `main` runs **Deploy** (`.github/workflows/deploy.yml`), which calls
`deploy-web.yml` once per target:

1. **checks**: `ci.yml` (Biome, typecheck, tests, build).
2. **staging**: builds against the production Convex URL and ships only the
   Worker `golf-app-staging` on https://fairway-stg.appelent.nl, then a smoke
   check. Staging is a frontend on the production backend; it has no Convex
   deployment of its own, so a merge cannot change the production backend.
3. **production**: runs right after staging (the `production` GitHub
   Environment only restricts deploys to `main`; it has no required reviewer),
   deploys production Convex, syncs the course catalog, and ships the `golf-app`
   Worker on https://fairway.appelent.nl.

Because a merge ships to production and mobile without a stop, the approval is
the merge itself: a change that is `high` or could block the installed mobile
apps waits for Eric's yes on a decision card before it merges (factory
[runbook](https://github.com/AppElent/developer-home/blob/main/RUNBOOK.md)).

Between steps 2 and 3, staging runs new frontend code against the backend
production last shipped. A change that needs new Convex functions works on
staging only after production deploys; test those on a PR preview, which gets
its own backend.
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
per-PR backend use the Clerk development instance. Staging, the installed
preview app (EAS `preview`, written from `staging`) and production read Infisical
`prod` and use the production instance (`clerk.appelent.nl`). That instance signs
in only on `*.appelent.nl`, so staging web is served on the custom domain
`fairway-stg.appelent.nl` (`wrangler.jsonc` `env.staging.routes`); the first
staging deploy creates it.

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

Staging and production both read Infisical `prod`. Only production gets
`CONVEX_DEPLOY_KEY` (`convex-deploy-key` in Infisical `prod`); staging gets the
production `VITE_CONVEX_URL` instead. `convex-deploy-key` in Infisical `staging`
is the preview key PR previews use.

## One-time setup

1. Production deploy key (Convex dashboard → deployment → Settings → Deploy
   keys), with full permissions: the deploy also runs the internal
   `courseCatalog:sync`. It starts with `prod:`; the workflow refuses anything else. Store it
   in Infisical `prod` under `/fairway` as `convex-deploy-key`.
2. GitHub Environments `staging` (no protection) and `production` (branch:
   `main`, no required reviewers or wait timer), then the `env:apply` commands above.

## Verify

- The run's summary links each environment's URL; the smoke check fetched it.

## When it goes wrong

- **Production never starts**: a newer merge replaced it in the queue, or
  someone added a reviewer gate back to the `production` Environment. Remove
  the gate; approvals happen before the merge, not in the Actions UI.
- **Build targets the wrong Worker**: the Cloudflare Vite plugin writes the
  Worker name into `dist/server/wrangler.json` from `CLOUDFLARE_ENV` at build
  time, and `wrangler deploy --env` is ignored. The deploy step refuses a
  mismatched name.
- **Check environment fails**: the named value is missing on that GitHub
  Environment, or production's `CONVEX_DEPLOY_KEY` is not a `prod:` key. Run
  `pnpm env:plan <environment>`, fix Infisical, and apply again.
- **Catalog sync fails after the Convex deploy**: functions are live, the
  Worker is not flipped. Fix and re-run the job; the sync is idempotent.
  `deployment:functions:runInternalMutations` means the deploy key is scoped
  too narrowly. Create a full one with
  `pnpm exec convex deployment token create <name> --deployment eric-jansen:golf:prod`,
  store it as `convex-deploy-key` in Infisical `prod` under `/fairway`, run
  `pnpm env:apply production --only github`, then re-run the failed job.
