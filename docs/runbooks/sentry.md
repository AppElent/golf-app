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
| Convex | `fairway-convex` | `scripts/convex-sentry.mjs` (`pnpm sentry:convex`) | Failed function executions, including scheduled ones — production only, from the always-on forwarder (see below) |
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
  that deploys: `staging` and `production` (deploy-web.yml), `preview` (preview.yml, which also sets the Worker's `environment_name`), `ci`
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
| `VITE_SENTRY_DSN` | Manifest: the GitHub **variable** `VITE_SENTRY_DSN` in the `staging` and `production` Environments (deploy-web.yml), `PREVIEW_VITE_SENTRY_DSN` at repository scope (preview.yml) |
| `SENTRY_AUTH_TOKEN` | Manifest: the GitHub **secret** `SENTRY_AUTH_TOKEN` in those Environments, `PREVIEW_SENTRY_AUTH_TOKEN` at repository scope, and EAS. Never a file, never `VITE_*` |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Default to `appelent` / `fairway` in `vite.config.ts`; overridable |

`vite build` emits hidden source maps (no `sourceMappingURL`). When the
process has `SENTRY_AUTH_TOKEN`, `@sentry/vite-plugin` uploads the client and
Worker maps for the release and an upload error fails the build; without it
nothing is uploaded. `scripts/remove-client-sourcemaps.mjs` then deletes every
map from `dist/client` (part of `pnpm build`), so
deployed static assets serve none. Worker maps stay in `dist/server`; they are
not served.

- **ci.yml** builds without token or DSN (`VITE_SENTRY_ENVIRONMENT=ci`): no
  release per CI run.
- **deploy-web.yml** and **preview.yml** build with the variable + secret above.

  `pnpm env:apply <environment> --only github` writes them from Infisical.

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
SENTRY_DSN=<dsn> SENTRY_ENVIRONMENT=development pnpm sentry:convex --deployment <dev deployment>
```

Production runs as a service; see [Production service](#production-service)
for how it gets the DSN and log access.

It runs `convex logs --jsonl` (CLI login, or a private deploy key with
`deployment:logs:view` for that deployment), forwards failed completions only
(not retried OCC conflicts), tags `func`, `func_type`, `caller`, `request_id`, and never sends
log lines, arguments, results or identity. On restart it replays the last 100
records; stable event ids deduplicate them. The reader reconnects with backoff
(5 s doubling to 60 s). Delivery is in memory: failures while it is down beyond
that history, or not yet sent at a crash, are lost. There is no user
attribution and no backend tracing.

Run one reader per deployment. If managed Convex reporting is ever enabled,
stop the reader for that deployment first to avoid duplicates.

### Production service

**Status: active for production.** One reader runs on Eric's always-on Mac
Studio as a launchd user agent. Staging, previews and dev deployments have no
reader. The service lives outside this repo:

| What | Where |
| --- | --- |
| launchd label | `com.appelent.convex-sentry.fairway` (`~/Library/LaunchAgents/com.appelent.convex-sentry.fairway.plist`) |
| Wrapper | `~/Developer/.services/bin/convex-sentry-run fairway`; host notes in `~/Developer/.services/README.md` |
| Checkout | `~/Developer/.services/golf-app`, a dedicated clone |
| Log | `~/Library/Logs/convex-sentry-fairway.log` |

The agent has `RunAtLoad`, `KeepAlive` and `ThrottleInterval` 30, so it
restarts after a crash (at most every 30 s) and after a reboot once this user
is logged in. On each start the wrapper updates the checkout to `origin/main`
when its tree is clean (otherwise it keeps the existing checkout and logs
why), installs dependencies when the lockfile changed, then runs the
equivalent of:

```sh
pnpm env:exec production --only github -- \
  sh -c 'unset CONVEX_DEPLOY_KEY CONVEX_DEPLOYMENT_TOKEN
         SENTRY_ENVIRONMENT=production pnpm sentry:convex --deployment eric-jansen:golf:prod'
```

- **DSN**: `env:exec` loads Infisical `sentry-dsn` as `VITE_SENTRY_DSN`; the
  `sentry:convex` script maps it to `SENTRY_DSN` and sets
  `SENTRY_APP=fairway-convex`.
- **Log access**: the logged-in Convex CLI on the Mac. The deploy keys are
  unset because the production deploy key can deploy but lacks
  `deployment:logs:view`.
- **Deployment**: `--deployment eric-jansen:golf:prod` (the public project
  selector from `env.manifest.ts`). `--prod` alone fails here: the service
  clone has no `.env.local`, so there is no `CONVEX_DEPLOYMENT` to resolve it.

Do not run the production forwarder from a T3 worktree or from
`~/Developer/golf-app`: keep one reader per deployment, and only the service
is supervised.

Restart, then watch the log:

```sh
launchctl kickstart -k "gui/$(id -u)/com.appelent.convex-sentry.fairway"
tail -f ~/Library/Logs/convex-sentry-fairway.log
```

A healthy start logs `[Production] eric-jansen:golf:production (prod)` and a
`Watching logs for …` line. Stop it with:

```sh
launchctl bootout "gui/$(id -u)/com.appelent.convex-sentry.fairway"
```

`bootout` unloads the agent until the next login; to start it again without
logging out, `launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.appelent.convex-sentry.fairway.plist`.

## Acceptance (not yet done)

On a labelled PR preview (`preview:web`), with the DSN variable and token
secret set: throw a controlled error in the browser, one in SSR, and one in a
Convex function with the forwarder running against that preview's deployment;
check each event's `app` tag, `environment=preview`, release, opaque user id,
redaction and a resolved stack.
