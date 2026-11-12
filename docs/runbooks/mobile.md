---
type: runbook
description: Read when running, building, or releasing the Fairway mobile app (apps/mobile).
version: 1.0.0
---

# Mobile app (Fairway)

Project facts for `apps/mobile`. Shared steps live in
[mobile baseline](../standards/mobile-baseline.md); this file only binds them.

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

- CI: label a PR `build:ios` / `build:android`, or run **Mobile Build** manually
  (`.github/workflows/mobile-build.yml` → `eas-local-build.yml`). Builds run
  `eas build --local` on the runner and spend no EAS Build credits.
- Cloud EAS builds and store submissions are manual release steps; nothing in CI
  submits.
- Updates: after each production deploy, **Deploy** runs **Mobile Update**
  (`.github/workflows/mobile-update.yml`). When the app changed since the
  `mobile-ota/preview` tag, it publishes to channel `preview` per platform if
  an earlier update or a finished EAS build there has the same runtime
  fingerprint; otherwise the run summary says a `preview-internal` rebuild is
  due. A local build is not recorded on EAS: after installing one, run the
  workflow by hand with `force` once. Before any hand-run publish, make sure
  production Convex has the same commit: the app relies on functions and
  fields the server fills in, such as `currentHoleIndex`.
- The app checks for an update on launch and on resume (at most hourly), and
  Home shows "Update ready" once one has downloaded; tapping it restarts into
  it. It never restarts by itself.

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
  go through the production log forwarder in [Sentry](sentry.md).
- Courses: the catalog is read-only on the phone; round setup links to
  "Suggest a correction". See [course catalog](course-catalog.md).
