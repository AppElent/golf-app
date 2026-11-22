---
type: standard
kind: capability
description: Read when adding or changing pull-request preview deployments.
version: 5.1.1
applies_to: [web, backend]
---

# Pull-request previews

A same-repository pull request labelled `preview:web` gets an isolated, disposable backend and Worker that never touch production.

## Rules

- Previews are opt-in per pull request: deploy only while the `preview:web` label is present, redeploy on pushes while it stays, and delete the Convex preview and the Worker when the label is removed.
- Closing a PR always runs cleanup, whatever its labels. Cleanup tolerates only an absent preview: Cloudflare error 10007 or 10090 (Worker not found; current Wrangler reports 10090) for the Worker; no match or HTTP 404 for the Convex preview. A run without the deploy key skips the Convex step (below). Any other failure fails the job.
- Unrelated label changes neither deploy nor cancel a running deploy: gate each job on the label and keep concurrency at job level.
- Build previews with a wrangler env that clears routes, `"pr": { "workers_dev": true, "routes": [] }`, and set `CLOUDFLARE_ENV: pr` on the job. Without it, `wrangler deploy --name APP_NAME-pr-<N>` still carries the top-level `routes` and moves the production custom domain to the PR Worker ([build-time env selection](deployments.md)).
- A guard step fails the job when the deploy output mentions `custom domain`. If a preview claimed the domain, redeploy production to take it back.
- Existing custom staging/production environment names and routes survive.
- The seed function is safe for a fresh disposable backend and never writes production resources.
- Previews use the Clerk development instance, and the per-PR backend trusts its issuer ([environments](environments.md)). Test-user values still never reach them: `VITE_*` values are public in the bundle.
- Only same-repository PRs deploy. Never switch to `pull_request_target` with an untrusted PR checkout to reach secrets. Review deploy-token permissions and branch trust.
- Cleanup deletes the Convex preview first, then attempts the Worker steps on `!cancelled()`, so a failed backend delete does not skip the Worker delete. Previews count against the Convex team's deployment quota until deleted, and the apps sharing a team share that quota: leftovers fail every app's preview deploy. Idle expiry is not cleanup. Every cleanup run also sweeps: it deletes each preview `pr-<M>` whose PR is no longer open, so a preview an earlier cleanup missed goes at the next close. It reads open PRs after listing deployments, so a new PR's preview is never swept; right before deleting another PR's preview it checks that PR is still closed, so a just-reopened PR keeps it; and the check after deleting looks only at this run's deletions, so a PR closing meanwhile cannot fail it. It never touches previews with other identifiers or any non-preview deployment. One known gap: removing the label mid-deploy cancels the deploy, but Convex may finish creating `pr-<N>` after cleanup listed; that preview idle-expires or is deleted from the dashboard.
- The Convex delete goes through the management API with `PREVIEW_CONVEX_DEPLOY_KEY`. It refuses a key without the `preview:` prefix, deletes only a deployment whose `deploymentType` is `preview` and whose `previewIdentifier` is `pr-<N>`, retries with connect and total timeouts, then lists again and fails if `pr-<N>` remains. The Convex step fails when the list is not exactly one JSON array, when a listed row has no string `deploymentType` or a preview has no string `previewIdentifier`, or when a matched name is not a plain deployment slug, so an API change cannot silently leak previews or send a stray delete. A run without the key skips it: a notice for Dependabot, a warning for anyone else. The Worker delete skips the same way without a Cloudflare token.

## Implementation

1. Adapt the [workflow template](previews/templates/preview.yml) as app-owned source: APP_NAME, seed function, build output, and deployment environments. Keep an existing customized preview workflow as the starting point.
2. Add the `pr` env to `wrangler.jsonc`.
3. Preview values live in GitHub repository scope as `PREVIEW_<name>`, written by `env:apply preview` ([environments](environments.md)). `PREVIEW_CONVEX_DEPLOY_KEY` is a Convex preview deploy key.
4. Create the `preview:web` label in the repository.

## Verify

- Run an isolated PR pilot: distinct Convex and Worker identities, seeded data, public build URL, auth redirects, refresh, and, on removing the label, deletion of both the Convex preview `pr-<N>` and the Worker.
- After a preview build, `jq .routes dist/server/wrangler.json` shows no routes.
- Run the Convex step with a PR number that has no preview: it reports no preview to delete and succeeds.
- Close a PR that never deployed: `cleanup` passes, and its log shows Wrangler's `[code: 10007]` or `[code: 10090]`.
- "No Convex preview to delete" while the project lists other previews is normal: other open PRs' previews count. It does not mean the management API's fields changed; the step fails on its own when previews lack `previewIdentifier`.

## Migration

From 5.0: replace the `Delete Convex preview` step and add `pull-requests: read` to the `cleanup` job's permissions. The next PR close deletes previews left behind by closed PRs.

From 4.x: replace the `cleanup` job with the template's. It needs `PREVIEW_CONVEX_DEPLOY_KEY` in repository scope (the deploy job already uses it), plus `curl` and `jq` on the runner. Delete previews already left behind for closed PRs from the Convex dashboard. An app whose Worker delete ends in `|| true` now fails on any error other than 10007 or 10090.

From 3.x: rename the repository secrets and variables to their `PREVIEW_` names with `pnpm env:apply preview --only github`, then update the workflow from the template. From 3.0, also add the `pr` env to `wrangler.jsonc`.
