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
| `preview` | Fairway Preview | `com.appelent.fairway.preview` | `fairway-preview` |
| `production` | Fairway | `com.appelent.fairway` | `fairway` |

- EAS project: `@appelent/fairway`, ID `e42512f9-8d86-4f78-8dd5-85383f239df7`
  (`app.json` → `extra.eas.projectId`).
- Convex: the same deployment as the web app (project "golf"; dev
  `dev:amiable-cuttlefish-923`). The phone needs the cloud URL, never localhost.
- Clerk: the web app's Clerk application; native sign-in uses `@clerk/expo`.

## Local development

```bash
cp apps/mobile/.env.example apps/mobile/.env.local   # fill in, never commit
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
app-specific): `pnpm run env plan local`, `pnpm run env apply local|preview|production`,
`pnpm run env check <environment>`. Local apply writes `apps/mobile/.env.local`.

| Variable | Lands in | Notes |
| --- | --- | --- |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env.local`, EAS development/preview/production | `pk_test_` locally and in development, `pk_live_` for preview and production |
| `EXPO_PUBLIC_CONVEX_URL` | `.env.local`, EAS all | Dev deployment locally, production for preview/production builds |
| `EXPO_PUBLIC_TEST_USER_*` | `.env.local` only | Honoured with `pk_test_` keys only |
| `EXPO_PUBLIC_SENTRY_DSN` | EAS preview/production | No DSN → no reporting |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | EAS preview/production | Debug-symbol and source-map upload |
| `GOOGLE_MAPS_ANDROID_API_KEY` | EAS (optional, not set) | Android satellite view only; iOS uses Apple Maps. Without it Android draws the schematic |
| `EXPO_TOKEN` | GitHub secret | The local-build workflow |

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

Two internal builds install side by side (the phone's UDID is registered with
the Apple team on EAS; add another with `eas device:create`):

| Profile | App | JS from | Backend |
| --- | --- | --- | --- |
| `development` | Fairway Dev | Metro on your Mac (same Wi‑Fi) | `EXPO_PUBLIC_*` of EAS *development* |
| `device` | Fairway Preview | bundled; updates over the air on channel `device` | Convex dev + Clerk test instance |

```bash
cd apps/mobile
pnpm exec eas build -p ios --profile device        # first run: Apple login creates the ad hoc profile
pnpm exec eas build -p ios --profile development
pnpm exec eas update --channel device --environment development -m "…"   # JS-only change to the device build
```

- The first build per profile needs an interactive Apple login; afterwards
  `--non-interactive` works.
- `device` exists because `preview` and `production` point at production
  Convex, which only has `main`'s functions.
- Both profiles set `SENTRY_DISABLE_AUTO_UPLOAD`: the *development* EAS
  environment has no Sentry token, and a Release build fails on the upload.
- Sign in with an email code. Native Sign in with Apple needs the bundle ID
  on the Clerk instance, and the dev instance is shared with other apps.

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
  go through the log forwarder in [Sentry](sentry.md), not yet hosted.
- Courses: the catalog is read-only on the phone; round setup links to
  "Suggest a correction". See [course catalog](course-catalog.md).
