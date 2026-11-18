---
type: standard
kind: capability
description: Read when deciding when a change ships where (web, preview app, production app, store build), or when versioning, tagging, or rolling back a release.
version: 1.0.0
applies_to: [web, backend, mobile]
---

# Releases

Web and backend ship continuously, one merge at a time; the installed apps get every merge on preview, a daily production update, and a new store build only when native code changes. Every shipped artefact carries a version that says what is running where.

## Rules

### Cadence per target

| Target | When it ships | Gate |
| --- | --- | --- |
| Web staging + staging Convex | Every merge to `main` | CI `check` |
| Web production + production Convex | Every merge, right after staging | Staging deploy and smoke passed |
| Preview app (`preview` channel OTA) | Every merge, after the production backend deployed | Runtime fingerprint matches a preview build |
| Production app (`production` channel OTA) | Once a day, a batch of everything merged since the last publish | Soaked on preview, see below |
| Store build (App Store / Play) | Only when the native fingerprint changed, batched | Owner's decision card before submission |

- **Do not batch web or backend deploys.** Small, single-change deploys are the lowest-risk unit: each one is easy to verify, attribute, and roll back. Batching hides which change broke production.
- **Production follows staging automatically.** The deploy workflow chains a `production` job after the staging job (`needs`, `environment: production`, ref `main` only) for every app ([deployments](deployments.md)). The gate is the merge: a change that could block installed app builds, or is `high`, waits for the owner's decision card before merging.
- **Backend changes are backward compatible.** Installed builds call production Convex for weeks. Use expand/contract: add the new function, field, or argument first (optional, with defaults); ship the client; remove the old shape only once no supported build calls it. A change that cannot be split this way is mobile-breaking and waits for the owner.
- **Keep `main` releasable.** Unfinished user-facing work merges behind a flag (off by default) or stays on its branch. A daily production update ships whatever is on `main`.

### Production app updates (daily)

- A scheduled job (once a day, morning Europe/Amsterdam) publishes the `production` channel through the publish wrapper ([mobile distribution](mobile-distribution.md)). It publishes only when all of these hold, per platform:
  - something the app bundles changed since the last production publish (diff against the `ota-production` tag);
  - the commit it publishes is at least 24 hours old on the `preview` channel, so it soaked on the owner's phone;
  - the production backend deploy for that commit succeeded;
  - an earlier update or a finished build on `production` has the same runtime fingerprint.
- When the fingerprint differs, the job publishes nothing and reports "store build due" in the run summary.
- After a publish, the job moves the `ota-production` tag and the manager checks Sentry for the new release. A regression is rolled back with `eas update:rollback` (or a republish of the previous group) and fixed forward.
- No decision card per daily update. Native changes, store submissions, and a forced publish on a fingerprint mismatch always wait for the owner.

### Store builds

- A native change (new native module, config plugin, entitlement, Expo SDK upgrade) collects on `main` as usual; preview gets a new `preview-internal` build.
- **Default:** bundle native changes into one store build, at most every two weeks unless a fix cannot wait. The manager proposes the release on a decision card with the changelog; submission happens only after the owner's yes.
- Before building, confirm the production backend matches `main` and serves both the old and the new build.

### Versioning

- **SemVer** `MAJOR.MINOR.PATCH` per app. The app version in `app.json` (`expo.version`) is the single source; web reads the same value (import it, or mirror it in the web `package.json`).
- Bump `MINOR` for each store build, `PATCH` for a hotfix store build, `MAJOR` only for a deliberate break (for example dropping support for old builds). OTA updates and web deploys do not bump the version.
- Build numbers stay with EAS (`appVersionSource: remote`, `autoIncrement`); never set them by hand.
- Every shipped artefact identifies itself as `<version>+<short sha>`, for example `1.4.0+a1b2c3d`:
  - web: the `/version` endpoint returns `version`, `commit`, `environment`, and deploy time;
  - Sentry: release `<app>@<version>+<short sha>` on web, Worker, and OTA uploads, with `environment` set;
  - mobile: the about or settings screen shows version, build number, channel, and update ID.
- Tags: each store build gets `v<version>` on its commit. The daily job moves `ota-production`; CI moves `ota-preview`. Web deploys need no tags, because `/version` and Sentry carry the commit.
- The changelog for a store release is the merged PR titles since the previous `v` tag, grouped by type; it goes on the decision card and in the GitHub release.

### Runtime version

- Keep `runtimeVersion.policy: "fingerprint"` with the shared [fingerprint config](mobile-baseline/templates/fingerprint.config.js). Never switch to `appVersion` or a hand-set runtime: the fingerprint is what keeps an update off a build it would crash.
- The mobile runtime PR comment is the early warning: a PR that changes the fingerprint means a new preview build after merge and a store build in the next release.

### Environments

- Environment names and value routing follow [environments](environments.md): `local`, `dev`, `preview` (web PR previews), `staging`, `production`.
- **Default:** staging web uses its own staging Convex deployment. An app whose staging web uses the production Convex deployment records it as an exception; there, a backend change reaches production on the staging deploy, so the backward-compatibility rule above is the only guard.
- The preview app always calls production Convex ([mobile distribution](mobile-distribution.md)).

## Implementation

1. Deploy workflow: chain `production` after `staging` ([deployments](deployments.md)); remove the separate production `workflow_dispatch` path, keeping dispatch only as a manual redeploy of `main`.
2. Add the `/version` endpoint and Sentry release naming `<app>@<version>+<sha>` to web and mobile.
3. Add a scheduled `mobile-update-production` workflow with the gates above, next to the existing preview update job.
4. Tag `v<current version>` on the commit of the build currently in the store, and `ota-production` on the last production update's commit (or the store build's commit when none).

## Verify

- A merge shows staging, then production, deploys in one workflow run, with both smoke checks green.
- `curl <app>/version` returns the version and the commit at `main`.
- Sentry's latest release for each app matches `/version`.
- The daily job's summary says per platform whether it published, skipped (nothing changed / not soaked), or found a store build due.

## Migration

New in 1.0. Apps adopt it in their own threads: Foundry, Gather, and Arcade Club move production from `workflow_dispatch` to the chain; all four add `/version`, Sentry releases, and the daily production update job.
