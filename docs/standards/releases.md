---
type: standard
kind: capability
description: Read when deciding when a change ships where (web, preview app, production app, store build), or when versioning, tagging, or rolling back a release.
version: 1.2.0
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
- **Default:** bundle native changes into one store build, at most every two weeks unless a fix cannot wait. The manager proposes the release on a decision card that links the version's changelog (see [Changelog](#changelog)); submission happens only after the owner's yes.
- Before building, confirm the production backend matches `main` and serves both the old and the new build.

### Android pause

Eric decided on 18 Nov 2026 that nothing is done with Android for now: the apps are iOS only. No app has a Play Store listing.

- **Default:** Android is off in every app repository until its GitHub repository variable `ANDROID_ENABLED` is `true`. While it is unset:
  - the preview OTA (every merge) and the daily production OTA publish iOS only;
  - Mobile Build ignores the `build:android` label and a manual Android run;
  - `pnpm builds build <app> <profile> android` refuses unless `ANDROID_ENABLED=true` is in the environment.
- The Android code, `eas.json` profiles, fingerprint checks, and the `ota-*-android` tags stay, so turning Android back on needs no code change.
- Agents do not ask for Android builds, Android fingerprints, or Android-only fixes, and they park Android parts of an issue in a sub-issue.
- **Re-enable switch**, per repository (`workouts`, `golf-app`, `gather`, `games`), with the owner's go:

  ```sh
  gh variable set ANDROID_ENABLED --body true --repo AppElent/<repo>
  ```

  The next merge publishes the Android preview update when a preview build has the current Android fingerprint. Otherwise its summary says a `preview-internal` rebuild is due. Production follows once the update has soaked on preview. To pause again, run `gh variable delete ANDROID_ENABLED --repo AppElent/<repo>`.

### Versioning

- **SemVer** `MAJOR.MINOR.PATCH` per app. The app version in `app.json` (`expo.version`) is the single source; web reads the same value (import it, or mirror it in the web `package.json`).
- Bump `MINOR` for each store build, `PATCH` for a hotfix store build, `MAJOR` only for a deliberate break (for example dropping support for old builds). OTA updates and web deploys do not bump the version.
- Build numbers stay with EAS (`appVersionSource: remote`, `autoIncrement`); never set them by hand.
- Every shipped artefact identifies itself as `<version>+<short sha>`, for example `1.4.0+a1b2c3d`:
  - web: the `/version` endpoint returns `version`, `commit`, `environment`, deploy time, and `convex` (the Convex deployment name the bundle calls, for example `limitless-bulldog-972`); the developer-home `Fleet status` workflow reads it daily;
  - Sentry: release `<app>@<version>+<short sha>` on web, Worker, and OTA uploads, with `environment` set;
  - mobile: the About or Settings screen shows the version, build number, OTA label, and channel (see [OTA label](#ota-label)).
- Tags: each store build gets `v<version>` on its commit and a GitHub release whose notes are that version's changelog. The daily job moves `ota-production`; CI moves `ota-preview`. Web deploys need no tags, because `/version` and Sentry carry the commit.

### OTA label

Every OTA update has one label, the same in every app: `<version> · <d mmm> · <short sha>`, for example `1.0.0 · 20 nov · a1b2c3d`.

- `version` is `expo.version` of the published commit, the date is the publish day in Europe/Amsterdam with a Dutch month abbreviation (`jan feb mrt apr mei jun jul aug sep okt nov dec`), and the sha is the published commit's first seven characters.
- One definition: [`releases/ota-label.mjs`](releases/ota-label.mjs) (`formatOtaLabel(version, publishedAt, sha)`). The publish script and the app import it, or copy it unchanged; do not reimplement the format.
- The publish step passes the short sha into the bundle (for example `EXPO_PUBLIC_GIT_SHA`) and uses the label as the EAS update message.
- About/Settings shows `Versie <version> (<build>) · update <label> · <channel>`; on the embedded bundle (no OTA update applied) it shows `geen update` in place of `update <label>`.

### Changelog

The developer-home `Changelog` workflow builds `changelog.json` daily from every PR merged into `main`, across the apps and developer-home, and the Control Room shows it.

- **Version:** a PR ships in the oldest `v<version>` tag whose commit contains its merge commit; before that it sits under the next MINOR after the newest `v` tag (no tag yet: after `app.json`'s version), marked unreleased.
- **Stages**, each empty until reached: `web` (production `/version` runs a commit that contains the merge), `preview` and `production` (the first OTA update on that channel whose commit contains the merge, with its OTA label), and `store` (the `v` tag).
- OTA workflows move the channel tag (`ota-<channel>`, or per platform `ota-<channel>-<platform>`) only when they really published, and put the publish in its own step that is skipped when the gate finds nothing to publish; the changelog reads both.
- Every user-facing PR body has `## User-facing change`: one line, plain language, what a user notices. PRs that change UI also have `## Screenshots`, with the images on the repository's `pr-assets` branch (under `<issue>/`) or at the root of a per-issue `pr-assets/<issue>` branch. A repository uses one form: git cannot hold both a `pr-assets` branch and `pr-assets/...` branches, so use per-issue branches where they already exist (gather). Both forms link as `https://github.com/<owner>/<repo>/blob/pr-assets/<issue>/<file>.png?raw=true`. The changelog shows that line and those images; without them it falls back to the PR title. Copy the PR template from developer-home's [`.github/pull_request_template.md`](https://github.com/AppElent/developer-home/blob/main/.github/pull_request_template.md).
- Write the PR title as a Conventional Commit (`feat(scope): …`): the type sets new, fixed, or faster, and `chore`, `ci`, `docs`, `test`, `build`, `refactor`, `style` or a tooling scope mark the change as not user-facing.

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
5. Show the [OTA label](#ota-label) in About/Settings, pass the short sha into the bundle, and use the label as the EAS update message.
6. Copy developer-home's `.github/pull_request_template.md` to `.github/pull_request_template.md`.

## Verify

- A merge shows staging, then production, deploys in one workflow run, with both smoke checks green.
- `curl <app>/version` returns the version and the commit at `main`.
- Sentry's latest release for each app matches `/version`.
- The daily job's summary says per platform whether it published, skipped (nothing changed / not soaked), or found a store build due.
- About/Settings on the preview app shows the same OTA label as the newest preview update in developer-home's `changelog.json` (`meta.apps.<app>.ota.preview.label`).

## Migration

From 1.1: copy `.github/pull_request_template.md` from developer-home; the publish steps pass the short sha into the bundle and use the [OTA label](#ota-label) as the update message; About/Settings shows the label; each store build gets a GitHub release with its changelog besides the `v` tag (Eric, 20 Nov 2026).

1.1 adds the Android pause: apps read `ANDROID_ENABLED` in their OTA and build workflows (Eric, 18 Nov 2026).

New in 1.0. Apps adopt it in their own threads: Foundry, Gather, and Arcade Club move production from `workflow_dispatch` to the chain; all four add `/version`, Sentry releases, and the daily production update job.
