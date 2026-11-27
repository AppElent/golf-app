---
type: runbook
description: Read when using or changing Fairway's pull-request previews or mobile PR builds.
version: 1.2.0
---

# Pull-request previews

Project facts for the shared [previews standard](../standards/previews.md).

| Label | Workflow | Result |
| --- | --- | --- |
| `preview:web` | `.github/workflows/preview.yml` | A per-PR Convex preview deployment, seeded, and a route-free Worker `golf-app-pr-<N>` on workers.dev (`CLOUDFLARE_ENV=pr`) |
| `build:ios`, `build:android` | `.github/workflows/mobile-build.yml` | A mobile dev client (`development` profile), rebuilt on each push while the label stays |

- Web previews use the Clerk development instance ([deploy runbook](deploy.md#auth)).
- Values come from repository-scope `PREVIEW_<name>` variables, written by
  `pnpm env:apply preview --only github`.

## Signed-in smoke

After each successful deploy, the `e2e` job runs `pnpm test:e2e` with
`E2E_BASE_URL` set to the preview Worker URL.

- **Advisory.** `e2e` is not a required check; only `check` is. A red `e2e`
  does not block a merge, but read it before you merge.
- **No secrets.** It signs in the passwordless dev user
  `fairway-e2e+clerk_test@example.com` with Clerk's test code. The job fails
  before testing unless the URL is this PR's `golf-app-pr-<N>` Worker, so it
  never targets staging or production.
- **One run per PR.** It shares the deploy's concurrency group, so a new push
  cancels a running smoke and closing the PR cancels it before cleanup.
- **On failure** it uploads `test-results/` (traces and screenshots) as the
  artifact `playwright-results-pr-<N>`. Open a trace with
  `pnpm exec playwright show-trace <trace.zip>`.
- **Sign-in timeouts** usually mean Clerk changed its sign-in screen
  (`e2e/sign-in.ts`) or the dev test user was deleted; recreate it on the
  development instance without a password.

## Cleanup

Removing `preview:web` or closing the PR runs the `cleanup` job, which deletes
the Convex preview first and then the Worker.

- **The Convex preview is deleted through the management API.** The preview
  deploy key may list and delete its own project's previews, so cleanup
  deletes the `preview` deployment whose identifier is `pr-<N>`, then lists
  again and fails if it is still there. Leftovers count against the Convex
  team's deployment quota, which Fairway shares with the other AppElent apps;
  a full quota fails every preview deploy. Removing the label mid-deploy can
  still leak one: cleanup cancels the deploy, but Convex may finish creating
  `pr-<N>` after cleanup listed. That preview idle-expires, or delete it from
  the dashboard.
- **No match is normal.** Cleanup reports "No Convex preview pr-<N> to delete"
  for a PR that never deployed, even while other open PRs' previews are
  listed. That does not mean the management API's field names changed; a
  changed response shape fails the step with its own error.
- **Worker delete tolerates only a missing Worker.** The `Delete Worker` step
  runs even when the Convex step failed, and passes when Wrangler reports
  Cloudflare error 10007 or 10090 (Worker not found; current Wrangler logs
  10090), as on a PR that never deployed. Any other Wrangler failure, such as
  a bad token, fails it. A wrong account the token can access also reports
  10090 and passes.
