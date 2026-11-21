---
type: runbook
description: Read when running, building, or releasing the Fairway mobile app (apps/mobile).
version: 1.4.0
---

# Mobile app (Fairway)

Project facts for `apps/mobile`. Shared steps live in
[mobile baseline](../standards/mobile-baseline.md); this file only binds them.

On an iOS simulator, run and drive the dev client with `node scripts/run-mobile.mjs`
([mobile run](../standards/mobile-run.md); Metro on port 8091). `down` releases the simulator.

## Identity

| Variant (`APP_VARIANT`) | Name | Bundle ID / package | Scheme |
| --- | --- | --- | --- |
| unset or `development` | Fairway Dev | `com.appelent.fairway.dev` | `fairway-dev` |
| `test` | Fairway Test | `com.appelent.fairway.test` | `fairway-test` |
| `preview` | Fairway Preview | `com.appelent.fairway.preview` | `fairway-preview` |
| `production` | Fairway | `com.appelent.fairway` | `fairway` |

- EAS project: `@appelent/fairway`, ID `e42512f9-8d86-4f78-8dd5-85383f239df7`
  (`app.json` → `extra.eas.projectId`).
- Convex: the same deployment as the web app (project "golf"; dev
  `dev:amiable-cuttlefish-923`). The phone needs the cloud URL, never localhost.
- Clerk: the web app's Clerk application; native sign-in uses `@clerk/expo`.

## Local development

```bash
pnpm env:apply local --only file                      # writes apps/mobile/.env.local from Infisical
pnpm --filter @fairway/mobile exec expo run:ios       # first time / after native changes
pnpm --filter @fairway/mobile exec expo start --dev-client
pnpm test:mobile                                      # Jest (mobile only)
pnpm check && pnpm typecheck && pnpm test             # repo-wide
```

- Local iOS builds (`expo run:ios`, `expo prebuild`, `eas build --local`) run
  `pod install`, which crashes with a Ruby `Encoding::CompatibilityError` unless
  the terminal's locale is UTF-8. Run
  `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` first (or put it in your shell
  profile).
- Native folders (`ios/`, `android/`) are generated and gitignored. Rebuild the dev
  client after adding a native module or changing `app.json` plugins.
- Install Expo packages with `pnpm --filter @fairway/mobile exec expo install <pkg>`.
- Test login: a Clerk `+clerk_test` address with code `424242` (dev instance only).
- Simulator GPS for on-course testing: set a location on a hole of the seeded
  course (De Oosterhoutse, around `51.6168,4.8700`) with the simulator's location
  setting. Play counts GPS only within the hole's reach (back tee or dogleg corner)
  + 120 m of the green.

## Environment

Values are routed by `env.manifest.ts` from Infisical (`/` shared, `/fairway`
app-specific): `pnpm env:plan <environment>`, `pnpm env:apply <environment>`,
`pnpm env:check <environment>`. Local apply writes `apps/mobile/.env.local`, and a
new worktree gets it from `node scripts/workspace.mjs prepare`. EAS `preview` (the
installed preview app) is written from `staging`: `pnpm env:apply staging --only eas`.

| Variable | Lands in | Notes |
| --- | --- | --- |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env.local`, EAS development/preview/production | `pk_test_` locally and in development, `pk_live_` for preview and production |
| `EXPO_PUBLIC_CONVEX_URL` | `.env.local`, EAS development/preview/production | Dev deployment locally, production for preview/production builds |
| `EXPO_PUBLIC_TEST_USER_*` | `.env.local` only | Honoured with `pk_test_` keys only |
| `EXPO_PUBLIC_SENTRY_DSN` | EAS preview/production | No DSN → no reporting |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | EAS preview/production | Debug-symbol and source-map upload |
| `GOOGLE_MAPS_ANDROID_API_KEY` | EAS (optional, not set) | Android satellite view only; iOS uses Apple Maps. Without it Android draws the schematic |
| `EXPO_TOKEN` | GitHub repository secret `PREVIEW_EXPO_TOKEN` | The Mobile Build and Mobile Update workflows |

## Builds

> **Android is paused (Eric, 18 Nov 2026).** Until the repository variable
> `ANDROID_ENABLED` is `true`, Mobile Build ignores `build:android`, and Mobile
> Update and Mobile Update (production) publish iOS only. Re-enable with
> `gh variable set ANDROID_ENABLED --body true` (developer-home
> `standards/releases.md`, "Android pause").

- CI: label a PR `build:ios` / `build:android`, or run **Mobile Build** manually
  (`.github/workflows/mobile-build.yml` → `eas-local-build.yml`). Builds run
  `eas build --local` on the runner and spend no EAS Build credits.
- Cloud EAS builds and store submissions are manual release steps; nothing in CI
  submits.
- Updates: after each production deploy, **Deploy** runs **Mobile Update**
  (`.github/workflows/mobile-update.yml`). When the app changed since the
  `ota-preview` tag (formerly `mobile-ota/preview`), it publishes to channel `preview` per platform if
  an earlier update or a finished EAS build there has the same runtime
  fingerprint; otherwise the run summary says a `preview-internal` rebuild is
  due. A local build is not recorded on EAS: after installing one, run the
  workflow by hand with `force` once. Before any hand-run publish, make sure
  production Convex has the same commit: the app relies on functions and
  fields the server fills in, such as `currentHoleIndex`.
- The score sheet saves through `rounds.saveHole` (APP-145). Production Convex
  must have `saveHole` before any mobile build or OTA update that calls it
  ships; an older server rejects every score save. Merging deploys Convex
  first, so a build or update made from `main` after that deploy is safe.
- The app checks for an update on launch and on resume (at most hourly), and
  Home shows "Update ready" once one has downloaded; tapping it restarts into
  it. It never restarts by itself.

### Production updates

The store app follows channel `production`. **Mobile Update (production)**
(`.github/workflows/mobile-update-production.yml`) runs every morning at 06:23
CET (07:23 CEST) and publishes, per platform (one matrix job each), the
newest code that ran on that platform's `preview` channel for at least 24 hours, following the
[releases standard](https://github.com/AppElent/developer-home/blob/main/standards/releases.md).
It publishes only when that commit changed what the app bundles since the
platform's `ota-production-<platform>` tag, a Deploy on `main` whose production
job succeeded includes it, and an update
or finished EAS build on `production` has the same runtime fingerprint. It
builds with `APP_VARIANT=production` and the EAS `production` environment, then
moves `ota-production-<platform>` to the commit. Before the first publish
there is no tag; the first soaked commit publishes, still fingerprint-gated.
Production updates have no Sentry source maps yet, so their stack traces are
minified. The run summary says per platform:
published, skipped (with the reason), or **store build due**.

- A rollback on `preview` to the embedded bundle blocks promotion: the job
  publishes nothing older than it until a newer preview update has soaked.
- No decision card per daily update. It never forces past a fingerprint
  mismatch: a native change waits for a store build.
- After a publish, check Sentry for the release `fairway@<version>+<sha>`.
- Roll back a bad update and fix forward:
  `pnpm exec eas update:rollback` (pick channel `production`), or republish
  the previous group with `eas update:republish --group <id> --destination-branch production`.
- Run it by hand from the Actions tab (on `main`) to publish sooner than the
  schedule; the same gates apply.

### Store builds

A native change (new native module, config plugin, entitlement, Expo SDK
upgrade) changes the fingerprint; the PR's runtime comment says so. It merges
as usual and needs a new `preview-internal` build; the store app keeps getting
updates for its own fingerprint until the next store build.

- Native changes are bundled into one store build, at most every two weeks
  unless a fix cannot wait. The manager proposes it to Eric on a decision card
  with the changelog (merged PR titles since the previous `v` tag); nothing is
  submitted before his yes.
- Before building, bump `expo.version` in `app.json` in its own PR: `MINOR`
  for a store build, `PATCH` for a hotfix build, `MAJOR` only for a deliberate
  break. Build numbers stay with EAS (`autoIncrement`). OTA updates and web
  deploys never bump the version.
- After the build, tag its commit `v<version>`, push the tag, and create the
  GitHub release with the same changelog. The `production` channel's daily
  updates then resume on the new fingerprint.

### Versions

`expo.version` in `app.json` is the app's one SemVer; web reads it too
([deploy](deploy.md#versions)). Profile's footer shows the version, the build
number, the OTA label of the running update (`update 1.0.0 · 20 nov · a1b2c3d`,
`geen update` when the bundled code runs) and the channel. The label is
developer-home's `formatOtaLabel` (`src/updates/ota-label.mjs`, copied
unchanged); the Mobile Update workflows use the same label as the EAS update
message (`scripts/ota-label.mjs`). Updates published by CI report to Sentry as `fairway@<version>+<short sha>`
(`EXPO_PUBLIC_COMMIT_SHA`, `src/monitoring/release.ts`); a store or local
build's bundled code keeps the SDK's default release, the name its source
maps are uploaded under.

| Tag | Moved by | Points at |
| --- | --- | --- |
| `ota-preview` | Mobile Update | Last `preview` publish |
| `ota-production-ios`, `ota-production-android` | Mobile Update (production) | Last `production` publish per platform (the standard's `ota-production`, split because each platform publishes on its own) |
| `v<version>` | The manager, per store build | The store build's commit |

### On your own iPhone

Three internal builds install side by side (the phone's UDID is registered with
the Apple team on EAS; add another with `eas device:create`):

| Profile | App | JS from | Backend |
| --- | --- | --- | --- |
| `preview-internal` | Fairway Preview | bundled; updates on channel `preview` after each deploy | production Convex + Clerk production |
| `test` | Fairway Test | bundled; updates on channel `test` | Convex dev + Clerk test instance |
| `development` | Fairway Dev | Metro on your Mac (same Wi‑Fi) | `EXPO_PUBLIC_*` of EAS *development* |

```bash
cd apps/mobile
SENTRY_DISABLE_AUTO_UPLOAD=true pnpm exec eas build -p ios --profile preview-internal --local --output <dir>/preview.ipa
pnpm exec eas build -p ios --profile test          # first run: Apple login creates the ad hoc profiles
pnpm exec eas build -p ios --profile development
pnpm exec eas update --channel test --environment development -m "…"   # JS-only change to the test build
```

- Fairway Preview is the daily driver: your real account and rounds.
- Fairway Test exists to try unmerged backend changes on the phone, because
  production Convex only has `main`'s functions. Its data is the dev
  deployment's, which gets reseeded.
- The first build per bundle ID needs an interactive Apple ID login, which
  creates the ad hoc profiles for the app and its widget extension and assigns
  the `group.<bundle ID>` app group to both; afterwards `--non-interactive`
  works. An App Store Connect API key (`EXPO_ASC_*`) can register the bundle
  IDs and capabilities but cannot assign app groups, so its profiles fail
  signing with "doesn't support the group… App Group".
- `test` and `development` set `SENTRY_DISABLE_AUTO_UPLOAD`: the *development*
  EAS environment has no Sentry token, and a Release build fails on the upload.
  A local `preview-internal` build sets it on the command line, as CI does.
- Clerk accounts on the test instance are separate from production. An account
  made there with Apple or Microsoft has no password: sign in with Apple,
  Microsoft or an email code.
- Native sign-in (Apple) needs the bundle ID registered as an iOS app on the
  Clerk instance (team `D8AMB5N29A`), and Microsoft needs
  `<scheme>://sso-callback` allowlisted. Test instance (shared with other
  apps): `.dev`, `.test`, `.preview`. Production instance: `.preview`; add
  `com.appelent.fairway` before the first store build. Callbacks: all four
  schemes on the instance their builds use.

### Runtime fingerprint check

**Mobile runtime** (`.github/workflows/mobile-runtime.yml`) runs on PRs that
touch the app or the lockfile. It compares the PR's runtime fingerprints with
the base branch's (`apps/mobile/scripts/fingerprint.mjs diff`) and comments
whether merging needs new builds. It also lists version changes of the
packages in `WATCHED` (`@clerk/expo`, `expo-application`), and its last step
(`fingerprint.mjs check`) fails the PR when a fingerprint (any variant, iOS or
Android) misses a watched package or any module that Expo autolinking links for
that platform (`expo-modules-autolinking resolve --platform apple|android`), so an
iOS-only module is never expected on Android. Mobile Update runs the same check
before it publishes. Its tests run with `pnpm test`
(`apps/mobile/scripts/fingerprint.test.mjs`), including the CLI's exit code
against fixture fingerprints.

- `@clerk/expo` 4.15.0 enforces the Clerk Dashboard's minimum app version per
  bundle ID. It reads the build's version through `expo-application`; without
  that module the check always reports "supported".
- `@expo/fingerprint` 0.21.7 threw on expo-widgets' Maven gradle plugin (no
  `sourceDir`) and dropped every Expo module from the Android fingerprint
  (APP-71). An override in `pnpm-workspace.yaml` keeps it at ^0.21.8, which
  skips such plugins; remove it once `expo` is 58.0.22 or later.

```bash
node apps/mobile/scripts/fingerprint.mjs            # hashes per variant
node apps/mobile/scripts/fingerprint.mjs check      # autolinked modules + watched packages present
node apps/mobile/scripts/fingerprint.mjs diff <base checkout>
```

### Preview sign-in test

`apps/mobile/.maestro/preview-sign-in.yaml` signs in to a Fairway Preview
build (`com.appelent.fairway.preview`) and fails if sign-in breaks or Clerk's
"Update required" screen appears. Run it after a Clerk SDK bump or a change to
Clerk's minimum versions. It needs a Preview build on the Clerk **test**
instance with the dev-login credentials from `.env.local`; never a `pk_live_`
build.

```bash
pnpm env:apply local --only file          # or copy apps/mobile/.env.local from the main checkout
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8   # pod install crashes without a UTF-8 locale
cd apps/mobile
APP_VARIANT=preview pnpm exec expo prebuild -p ios --clean   # --clean: ios/ may hold another variant
cd ios && APP_VARIANT=preview SENTRY_DISABLE_AUTO_UPLOAD=true xcodebuild \
  -workspace FairwayPreview.xcworkspace -scheme FairwayPreview \
  -configuration Release -sdk iphonesimulator -derivedDataPath build/dd \
  -destination id=<simulator udid> CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual \
  DEVELOPMENT_TEAM= PROVISIONING_PROFILE_SPECIFIER= build
xcrun simctl install <simulator udid> build/dd/Build/Products/Release-iphonesimulator/FairwayPreview.app
cd .. && pnpm e2e:preview-sign-in         # maestro test .maestro/preview-sign-in.yaml
```

- Build with `xcodebuild` and ad hoc signing (`CODE_SIGN_IDENTITY=-`).
  `expo run:ios --configuration Release` asks for a signing certificate, and an
  unsigned build (`CODE_SIGNING_ALLOWED=NO`) has no keychain entitlement, so
  the app stalled on the splash screen in testing.

- It covers the Preview bundle ID on the test instance. The installed
  `preview-internal` build uses the production instance, whose minimum
  versions only the owner checks in the Clerk Dashboard.

- After Home appears, the flow waits up to 15 s for "Update required" before
  it asserts the screen is absent. Clerk re-reads the minimum version after
  sign-in, and a slow response would otherwise arrive after the check and
  the test would pass. Maestro counts wait timeouts from the last
  interaction, so a `waitForAnimationToEnd` right after Home restarts the
  clock; without it a slow sign-in would use up the 15 s. A passing run takes
  about 15 s longer.

#### Why it does not run in CI

It runs locally only, by decision (APP-72). A CI job would need:

- **A test-instance Preview build.** No workflow produces one. Mobile Build
  makes `development` and `preview-internal` device builds (`preview-internal`
  uses production Clerk), not a simulator `.app` for
  `com.appelent.fairway.preview` on the test instance. The `test` EAS profile
  (Fairway Test) is a different bundle ID.
- **New secrets.** The pre-filled sign-in needs `EXPO_PUBLIC_TEST_USER_EMAIL`
  and `EXPO_PUBLIC_TEST_USER_PASSWORD` in the CI build, and they would be
  embedded in the build artifact.
- **macOS minutes.** Prebuild, a Release `xcodebuild` and a simulator boot
  take tens of minutes on a `macos-26` runner per run.
- **A live network dependency.** It signs in against the shared Clerk test
  instance and Convex, so outages and rate limits would fail unrelated PRs.

The risk it guards against changes rarely: a Clerk SDK bump (Dependabot) or a
change to the minimum versions in the Clerk Dashboard. Run it by hand for
those. Revisit CI if it misses a regression.

#### Proving it fails on "Update required" (APP-108)

Done by the Clerk Dashboard owner, on the **test** instance only:

1. Build and install the Preview app as above, and run the test once. It
   should pass. The build's version is `expo.version` in
   `apps/mobile/app.json` (`1.0.0` today).
2. In the Clerk Dashboard (test instance), find the iOS native app
   `com.appelent.fairway.preview` and set its minimum app version above the
   build's version (for example `99.0.0`). Leave the other bundle IDs alone;
   the test instance is shared with other apps.
3. Run `pnpm e2e:preview-sign-in` from `apps/mobile` again. It must fail,
   and the "Update required" screen must be on the simulator when it does
   (Maestro's failure screenshot shows it). Clerk can block before the
   sign-in screen, at sign-in or after Home, so the failing step may be any
   of the waits or an `Update required` assertion. A pass here means the
   test is blind; reopen APP-72.
4. Remove the minimum version, run the test again, and confirm it passes.
   Record both runs (pass/fail output) on APP-108.

### TestFlight and the App Store

The App Store Connect app is `6833832527` (`submit.production.ios.ascAppId` in
`eas.json`); the store name is "Fairway: Golf GPS & Scorecard" ("…& Scorekaart"
in nl-NL). Production builds use production Clerk and Convex, so deploy the
backend first. Build and upload:

```bash
cd apps/mobile
APP_VARIANT=production pnpm exec eas build -p ios --profile production
# eas submit --non-interactive cannot set up an App Store Connect API key, so upload the IPA with asc:
curl -sSLo Fairway.ipa "$(pnpm exec eas build:view <BUILD_ID> --json | jq -r .artifacts.buildUrl)"
asc builds upload --app 6833832527 --ipa Fairway.ipa --wait
```

External testers join through the **Public** group's link,
`https://testflight.apple.com/join/5SAF8udZ`. Add each new build to that group
(`asc builds add-groups --app 6833832527 --latest --group 764aa696-537e-4ac1-8690-af453a3f77ae --submit --confirm`)
and give it What to Test notes (`asc builds test-notes create`, en-US and nl-NL);
a new version needs Beta App Review again. `asc status --app 6833832527` shows
where things stand, and `asc validate --app 6833832527 --version <v>` lists what
still blocks App Review. Review needs these fields:

| Field | Value |
| --- | --- |
| Privacy Policy URL (App Information) | `https://fairway.appelent.nl/privacy` |
| Support URL, Marketing URL | `https://fairway.appelent.nl/support`, `https://fairway.appelent.nl` |
| Feedback email | `privacy@appelent.nl` (Cloudflare Email Routing forwards it) |
| Sign-in for review | `appreview@appelent.nl` in production Clerk, shared with the other Appelent apps; its password is set in the Clerk dashboard |
| Review notes | The catalog covers Dutch courses only; Profile → Course simulator plays a course from anywhere |
| App Privacy | Email, name, user ID, precise location (marked shots), user content (rounds) and problem reports (customer support, which may hold a name and email) linked to the user; crash and diagnostic data not linked; nothing used for tracking |
| Categories, age rating | Sports, then Health & Fitness; every age-rating answer "none" |
| Pricing and availability | Free, every territory, new territories included |
| Content rights | Uses third-party content with the rights to it: the OpenStreetMap course layouts (ODbL), credited as "© OpenStreetMap contributors" under every hole map on web and phone. Keep that credit wherever OSM data is drawn |

Profile links to the policy page (`src/routes/privacy.tsx`). Profile → Delete
account deletes the shared Appelent Clerk user, so a review that tests it removes
the reviewer for every Appelent app: recreate it before the next submission.

#### Store screenshots

`node scripts/store-screenshots.mjs --issue APP-433 --name fairway` (synced from
developer-home; [mobile run](../standards/mobile-run.md#store-screenshots)) makes the
iPhone 6.9" and iPad 13" sets in en-US and nl-NL under
`~/Developer/.screenshots/APP-433/fairway/`. It drives
`apps/mobile/.maestro/store-screenshots.yaml` on the dev client, with the labels
of `store-screenshots.json`. It needs:

- A dev client build of `com.appelent.fairway.dev`. The script looks in Xcode
  DerivedData and `~/Developer/.builds/<checkout folder>/`; for a build elsewhere set
  `RUN_MOBILE_APP=/path/FairwayDev.app`.
- `apps/mobile/.env.local` with the dev-login credentials (the flow signs in with the
  pre-filled form and never shows the sign-in screen or Profile, which carry the
  test email).
- A dev Convex deployment with the catalog synced (`pnpm courses:sync`) and the
  demo data for the test user: three finished rounds and a round in progress on hole
  5 of De Oosterhoutse. `seed:seedDummyData` is an internal action and
  `convex run --identity` only runs public functions, so push a throwaway public
  action that calls it with `ctx.runAction(internal.seed.seedDummyData, {})`, run
  that with `--identity '{"subject":"user_…"}'`, then delete it again. A deployment
  made by `node scripts/workspace.mjs prepare` is disposable and fits.
- The flow only reads. The simulator location is set on hole 5 with Maestro's
  `setLocation`, so the live distances show.

The set is the home screen, the live hole, the live scorecard, stats, a finished
round and its scorecard. The course picker and round setup are not in it: with a
round in progress they show "A round is in progress".

Store screenshots are 1320×2868 (iPhone 6.9"), one set per locale. Upload with
`asc screenshots upload --app 6833832527 --version <v> --locale <l> --path <dir> --device-type IPHONE_69`
(`IPAD_PRO_3GEN_129` for the iPad 13" set) after reading the contact sheets; never
`--replace` an existing set without Eric's go.

## Runtime notes

- Online first: Convex is the source of truth; a write counts as saved when the
  server acknowledges it. Anything stored on the phone (`expo-sqlite/kv-store`
  preferences, the query cache) can be deleted at any time without data loss.
- "GPS while locked" (Profile) is opt-in, needs Always location, and runs
  background updates only while the Play screen is mounted. On iOS the "Change to
  Always" prompt answers late; `background-location-preference.ts` re-reads for 15 s.
- Monitoring: Sentry project `appelent/fairway` (`src/monitoring/`). Errors
  only — no tracing, replay, sessions or screenshots — with user, request and
  console arguments scrubbed (`options.ts`). Reports from preview/production
  builds; a development bundle stays silent unless
  `EXPO_PUBLIC_SENTRY_DEBUG=1`. "Report a problem" opens Sentry User Feedback
  when reporting is on, otherwise shows an explanation. Convex backend errors
  go through the shared incident inbox's log forwarder in [Sentry](sentry.md).
- Courses: the catalog is read-only on the phone; round setup links to
  "Suggest a correction". See [course catalog](course-catalog.md).
