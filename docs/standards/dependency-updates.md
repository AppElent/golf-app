---
type: standard
kind: capability
description: Read when enabling or changing Dependabot, or reviewing automated dependency PRs.
version: 2.2.0
applies_to: [web, mobile, backend]
---

# Dependency updates

Dependabot delivers security fixes and routine bumps as small, reviewable PRs; agents handle majors and SDK-aligned upgrades as planned work.

## Rules

- Enable Dependabot alerts and security updates on every repository.
- Version updates never propose majors. Majors and migrations go through the `upgrade-dependencies` skill and are discussed first.
- Packages whose versions an SDK selects (Expo: `expo`, `expo-*`, `@expo/*`, `react`, `react-dom`, `react-native`, `react-native-*`, `@react-native/*`, `jest-expo`, and SDK-pinned tooling) are ignored by version updates and upgraded with `expo install --fix`.
- Packages with a committed patch (`patchedDependencies`) are ignored by version updates.
- Every `ignore` entry names `update-types`; a bare `dependency-name` ignore also blocks security updates. Ignore majors in every ecosystem entry, GitHub Actions included.
- Packages linked by a peer dependency (a plugin and its host, a test harness and its runtime) share one group, listed before the dependency-type groups. Dependabot puts each update in the first group it matches; split across dev and prod groups, each half's PR fails CI. The template groups `wrangler` with `@cloudflare/*`, and `convex` with `convex-test` and `convex-helpers`. An `ignore` entry still applies to a package inside a group.
- In a pnpm workspace, the npm ecosystem entry uses only the workspace root (`directory: "/"`). The root job reads the `packages:` globs in `pnpm-workspace.yaml` and updates every member package. Entries for member directories (`/apps/mobile`, `/packages/core`) fail with `misconfigured_tooling`, so those packages get no updates, security fixes included (AppElent/golf-app#36, APP-21).
- `cooldown.default-days` is at least the pnpm `minimumReleaseAge` (in days); otherwise proposed lockfiles fail frozen installs.
- Workflows and composite actions pin every action from another repository to its full 40-character commit SHA, with the exact version in a trailing comment: `uses: actions/checkout@<sha> # v4.4.0`. A tag can be moved to other code; a SHA cannot. Dependabot's `github-actions` entry reads the comment and updates SHA and comment together. Local actions (`uses: ./.github/actions/setup`) need no pin.
- The `github-actions` entry lists every directory that holds a composite action next to `/` (`directories: ["/", "/.github/actions/*"]`); `/` alone covers only `.github/workflows`.
- Workflows that need Actions secrets skip Dependabot PRs (`github.event.pull_request.user.login != 'dependabot[bot]'`), or the needed values are added as Dependabot secrets. Never switch to `pull_request_target` to supply them.
- **Default:** a workflow labels each Dependabot PR with its blast radius. Copy the [labeler template](dependency-updates/templates/dependabot-blast-radius.yml) unchanged; it holds nothing app-specific.
  - `blast-radius:low` only when every entry in `dependabot/fetch-metadata`'s `updated-dependencies-json` is a patch (`version-update:semver-patch`). fetch-metadata's own `update-type` skips empty types, so a group of a patch and an unknown update reports a patch; the template checks each entry instead.
  - Minor, major, empty, unknown, or missing update types get `blast-radius:med`, for one entry of a group too, as does a failed metadata step.
  - GitHub Actions updates, and any PR that changes a file under `.github/`, get `blast-radius:med`, even for a patch.
  - Labels are read from the API just before the edit, never from the event payload, so a label set while the run waited counts. An existing `blast-radius:high` is never lowered or joined. Otherwise every run (opened, reopened, synchronize) sets `low` or `med` and removes the other.
  - Concurrency is one group per PR with `cancel-in-progress: false`. Cancelling would let a push to the PR stop the run that labels the previous push; queued, the newest push's run always runs last and labels the PR's final state.
  - A blast-radius label removed by hand comes back only on the next Dependabot push (or a close and reopen); the workflow does not react to label edits.
  - The workflow creates no labels and fails when one is missing; create them with Implementation step 3.
  - The job runs only for `dependabot[bot]` PRs (by author, so a person's push still relabels), on a plain `pull_request` trigger, with `contents: read` and `pull-requests: write`.
- **Default:** weekly npm updates grouped by dependency type and minor/patch, at most 5 open PRs; monthly grouped GitHub Actions updates.
- **Default:** merge by hand after CI passes and the changelog is reviewed. Auto-merge, if adopted, covers only dev-dependency minor/patch groups behind required checks.

## Implementation

1. Enable alerts and security updates:
   `gh api -X PUT repos/<owner>/<repo>/vulnerability-alerts` and
   `gh api -X PUT repos/<owner>/<repo>/automated-security-fixes`.
   Enable **Grouped security updates** in Settings → Advanced Security; it has no REST endpoint.
2. Copy the [Dependabot template](dependency-updates/templates/dependabot.yml) to `.github/dependabot.yml` (project-owned). Keep the npm entry at the workspace root (`directory: "/"`) and remove any member-directory entries, set the cooldown from `pnpm-workspace.yaml`, drop the Expo ignores for web-only apps, and add patched packages. Keep the peer groups for packages the project uses and add one for any other peer-linked set.
3. Guard secret-dependent PR workflows as above. Builds that read optional secrets (such as a source-map upload token) must still pass without them. To label blast radius, copy the [labeler template](dependency-updates/templates/dependabot-blast-radius.yml) unchanged to `.github/workflows/dependabot-blast-radius.yml`, delete any older labeler, and create the labels that are missing. This creates only absent labels and never changes an existing label's color or description:

   ```bash
   existing=$(gh label list --limit 500 --json name --jq '.[].name')
   create() { grep -qx "$1" <<<"$existing" || gh label create "$1" --color "$2" --description "$3"; }
   create blast-radius:low 0e8a16 "UI, copy, tests, single-module refactors, docs"
   create blast-radius:med fbca04 "Data model with migration, new dependencies, CI/workflows, shared behaviour"
   create blast-radius:high b60205 "Auth, payments, production config, secrets, data deletion, permissions"
   ```

4. Note the Dependabot setup in the project's dependency-upgrade runbook.

## Verify

- `gh api repos/<owner>/<repo>/automated-security-fixes` reports `enabled: true`.
- After merge, the first run under Insights → Dependency graph → Dependabot completes without lockfile errors (Dependabot can trail new pnpm releases). A `misconfigured_tooling` error means the npm entry lists a member directory.
- The first Dependabot PR's CI passes, and secret-dependent jobs are skipped, not failed.
- If the labeler is adopted, `gh label list --search blast-radius:` lists `blast-radius:low`, `blast-radius:med` and `blast-radius:high`, `.github/workflows/dependabot-blast-radius.yml` matches the template byte for byte, and the first Dependabot PR gets the expected `blast-radius:*` label.
- `grep -rnE 'uses: *[^." ][^@]*@' .github | grep -vE '@[0-9a-f]{40} # v[0-9]'` prints nothing: every external action is pinned with its version comment.

## Migration

From 2.1: replace the hand-built labeler (`dependabot-labels.yml`, `dependabot-labeler.yml` or an older `dependabot-blast-radius.yml`) with the [labeler template](dependency-updates/templates/dependabot-blast-radius.yml) at `.github/workflows/dependabot-blast-radius.yml`, and run the label step in Implementation step 3. Open Dependabot PRs relabel on their next push; a grouped patch PR with an unknown update type moves from `low` to `med`.

From 2.0: pin every external `uses:` in `.github/` to a commit SHA with a `# vX.Y.Z` comment (resolve the tag you use now, so behavior does not change), and add composite action directories to the `github-actions` entry.

From 1.1: in `.github/dependabot.yml`, set the npm entry to `directory: "/"` and remove the member-directory entries (`directories: ["/", "/apps/mobile", ...]`). The root job still updates every workspace package.
