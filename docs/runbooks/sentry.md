---
type: runbook
description: Read when changing Fairway's Sentry coverage, project binding, sampling, or source-map uploads.
version: 1.0.0
---

# Sentry (Fairway)

Project facts for the shared [Sentry standard](../standards/sentry-monitoring.md)
and its [setup detail](../standards/sentry-monitoring/setup.md).

## Project binding

Every surface reports to one Sentry project, `appelent/fairway`, with one DSN
(Infisical `sentry-dsn` in `/fairway`). Surfaces are told apart by the `app` tag:

| Surface | `app` tag | Code | Coverage |
| --- | --- | --- | --- |
| Browser | `fairway-web` | `src/instrument.client.ts`, `src/client.tsx`, `src/router.tsx` | React render/query errors (`onUncaughtError`/`onCaughtError`/`onRecoverableError`), failed Convex mutations/actions returned to this browser, route navigation traces |
| Worker SSR | `fairway-web-server` | `src/server.ts` (`wrangler.jsonc` `main`) | Uncaught Worker exceptions and SSR responses ≥ 500 that TanStack Start turned into a response, request traces |
| Convex | `fairway-convex` | `scripts/convex-sentry.mjs` (`pnpm sentry:convex`) | Failed function executions, including scheduled ones — **inactive until the forwarder runs somewhere** (see below) |
| Mobile | `fairway-mobile` | `apps/mobile/src/monitoring/` | See the [mobile runbook](mobile.md) |

One project because it is one product with one team and low volume: a broken
Convex function shows up next to the web and phone errors it causes, and there
is one DSN, one upload target and one alert configuration to keep right.
Revisit if a surface's volume or alerting needs to diverge.

## Policy

- **Local is silent.** The browser initializes only with a DSN, outside
  `vite dev`, and when `window.location` is not a local host; the Worker
  dispatches local requests straight to the app without entering Sentry's
  wrapper (`isLocalReportingUrl` in `src/lib/observability/config.ts`,
  regression test in `src/server.test.ts`). LAN addresses and tunnels are not
  detected — don't build with the DSN to test on a phone over Wi-Fi.
- **Environment = deployment.** `VITE_SENTRY_ENVIRONMENT` is set by the command
  that deploys: `staging` and `production` (deploy.yml, or
  `pnpm deploy:prod` by hand), `development` (`pnpm deploy:dev`), `preview`
  (preview.yml, which also sets the Worker's `environment_name`), `ci`
  (ci.yml's check build). A build without it reports
  as `unknown`.
- **Release** = `SENTRY_RELEASE`, else the git commit; one value is inlined in
  the browser bundle and the Worker and names the uploaded maps.
- **User**: the opaque Clerk user id only, set and cleared on sign-out/unmount
  by `SentryUser` in the Clerk provider. No email, name or IP.
- **Privacy** (`src/lib/observability/privacy.ts`, same rules in
  `scripts/convex-sentry.mjs`): automatic collection is off; events keep
  method + query-less URL, the stack, tags and the user id. Dropped: headers,
  cookies, bodies, query strings, `extra`, stack-frame locals, console
  breadcrumbs, and breadcrumb data other than url/method/status/from/to. Error
  text has emails, bearer tokens, JWTs, secret query params and Convex
  validator `Object:`/`Value:` echoes replaced with `[Filtered]`. Player names,
  scores and positions must never reach an event.
- **Expected errors**: a `ConvexError` is shown by the UI and is not reported.
  Plain `Error`s thrown by Convex functions are.
- **Trace headers** go to same-origin requests only; Convex and Clerk get none.

### Sampling and cost

| Signal | Web | Notes |
| --- | --- | --- |
| Errors | 100% | |
| Transactions | 10% in `production`, 100% elsewhere | Browser navigation + Worker requests, static lifecycle so the redaction hooks run |
| Replay, feedback, profiling, logs | Off | A replay or screenshot of a scorecard carries names. "Report a problem" exists on mobile only. |

Alerts and retention are configured in Sentry, not here.

## Build and upload

| Value | Where it comes from |
| --- | --- |
| `VITE_SENTRY_DSN` | Manifest: `.env.local` (local, so laptop deploys bundle it) and the GitHub **variable** `VITE_SENTRY_DSN` (preview.yml) |
| `SENTRY_AUTH_TOKEN` | Manifest: the GitHub **secret** `SENTRY_AUTH_TOKEN` (preview.yml) and EAS. Never a file, never `VITE_*` |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Default to `appelent` / `fairway` in `vite.config.ts`; overridable |

`vite build` emits hidden source maps (no `sourceMappingURL`). When the
process has `SENTRY_AUTH_TOKEN`, `@sentry/vite-plugin` uploads the client and
Worker maps for the release and an upload error fails the build; without it
nothing is uploaded. `scripts/remove-client-sourcemaps.mjs` then deletes every
map from `dist/client` (part of `pnpm build` and `pnpm build:development`), so
deployed static assets serve none. Worker maps stay in `dist/server`; they are
not served.

- **ci.yml** builds without token or DSN (`VITE_SENTRY_ENVIRONMENT=ci`): no
  release per CI run.
- **preview.yml** builds with the variable + secret above.
- **Laptop deploys** don't upload unless the token is supplied to the process:

  ```sh
  node scripts/env.mjs exec production --only github -- pnpm deploy:prod
  node scripts/env.mjs exec production --only github -- pnpm deploy:dev
  ```

  `--only github` selects the workflow placements (`SENTRY_AUTH_TOKEN`,
  `VITE_SENTRY_DSN`, plus the unused `EXPO_TOKEN`) from Infisical for that
  command only. (`pnpm env …` hits pnpm's built-in `env` command; use
  `node scripts/env.mjs` or `pnpm run env …`.)

An upload command succeeding does not prove symbolication: open a deployed
error in Sentry and check the stack resolves to `src/` files.

## Convex forwarder

Convex's managed exception reporting needs the Pro plan, which this project is
not on. Browser capture only sees failures returned to an active user, so the
backend path is a log forwarder:

The script is a verbatim copy of the toolkit's
[forwarder](../standards/sentry-monitoring/examples/convex-sentry.mjs); refresh
it by copying again after a toolkit sync. `pnpm sentry:convex` supplies the
Fairway parts: `SENTRY_APP=fairway-convex` (the default tag would be
`golf-app-convex`) and `SENTRY_DSN` from `VITE_SENTRY_DSN` when unset, which
is the name the manifest's workflow placement uses. `SENTRY_CONVEX_DSN` wins
over both.

```sh
SENTRY_DSN=<dsn> pnpm sentry:convex --prod
SENTRY_DSN=<dsn> SENTRY_ENVIRONMENT=development pnpm sentry:convex --deployment <dev deployment>
# or let the manifest supply the DSN:
node scripts/env.mjs exec production --only github -- pnpm sentry:convex --prod
```

It runs `convex logs --jsonl` (CLI login or a private `CONVEX_DEPLOY_KEY` for
that deployment), forwards failed completions only (not retried OCC
conflicts), tags `func`, `func_type`, `caller`, `request_id`, and never sends
log lines, arguments, results or identity. On restart it replays the last 100
records; stable event ids deduplicate them. The reader reconnects with backoff
(5 s doubling to 60 s). Delivery is in memory: failures while it is down beyond
that history, or not yet sent at a crash, are lost. There is no user
attribution and no backend tracing.

**Status: inactive.** No always-on host runs it yet, so unattended backend
failures (scheduled jobs, crons) are not reported. Run one reader per
deployment on a supervised host to activate it. If managed Convex reporting is
ever enabled, stop the reader for that deployment first to avoid duplicates.

## Acceptance (not yet done)

On a labelled PR preview (`preview:web`), with the DSN variable and token
secret set: throw a controlled error in the browser, one in SSR, and one in a
Convex function with the forwarder running against that preview's deployment;
check each event's `app` tag, `environment=preview`, release, opaque user id,
redaction and a resolved stack.
