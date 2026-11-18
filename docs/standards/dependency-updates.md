---
type: standard
kind: capability
description: Read when enabling or changing Dependabot, or reviewing automated dependency PRs.
version: 2.0.0
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
- Workflows that need Actions secrets skip Dependabot PRs (`github.event.pull_request.user.login != 'dependabot[bot]'`), or the needed values are added as Dependabot secrets. Never switch to `pull_request_target` to supply them.
- **Default:** a workflow labels each Dependabot PR with its blast radius. AppElent/golf-app#39 implements every rule below; AppElent/workouts#198 predates the `.github/` and `high` rules.
  - A patch (`version-update:semver-patch` from `dependabot/fetch-metadata`) gets `blast-radius:low`. A grouped PR reports its largest update.
  - Minor, major, unknown, or missing update types get `blast-radius:med`, as does a failed metadata step.
  - GitHub Actions updates, and any PR that changes a file under `.github/`, get `blast-radius:med`, even for a patch.
  - An existing `blast-radius:high` is never lowered. Otherwise every run (opened, reopened, synchronize) recomputes `low` or `med` and removes the stale one.
  - The job runs only for `dependabot[bot]` PRs, on a plain `pull_request` trigger, with `contents: read` and `pull-requests: write`.
- **Default:** weekly npm updates grouped by dependency type and minor/patch, at most 5 open PRs; monthly grouped GitHub Actions updates.
- **Default:** merge by hand after CI passes and the changelog is reviewed. Auto-merge, if adopted, covers only dev-dependency minor/patch groups behind required checks.

## Implementation

1. Enable alerts and security updates:
   `gh api -X PUT repos/<owner>/<repo>/vulnerability-alerts` and
   `gh api -X PUT repos/<owner>/<repo>/automated-security-fixes`.
   Enable **Grouped security updates** in Settings → Advanced Security; it has no REST endpoint.
2. Copy the [Dependabot template](dependency-updates/templates/dependabot.yml) to `.github/dependabot.yml` (project-owned). Keep the npm entry at the workspace root (`directory: "/"`) and remove any member-directory entries, set the cooldown from `pnpm-workspace.yaml`, drop the Expo ignores for web-only apps, and add patched packages. Keep the peer groups for packages the project uses and add one for any other peer-linked set.
3. Guard secret-dependent PR workflows as above. Builds that read optional secrets (such as a source-map upload token) must still pass without them. To label blast radius, add the labeler workflow described above; it uses the repository's existing `blast-radius:*` labels.
4. Note the Dependabot setup in the project's dependency-upgrade runbook.

## Verify

- `gh api repos/<owner>/<repo>/automated-security-fixes` reports `enabled: true`.
- After merge, the first run under Insights → Dependency graph → Dependabot completes without lockfile errors (Dependabot can trail new pnpm releases). A `misconfigured_tooling` error means the npm entry lists a member directory.
- The first Dependabot PR's CI passes, and secret-dependent jobs are skipped, not failed.
- If the labeler is adopted, the first Dependabot PR gets the expected `blast-radius:*` label.

## Migration

From 1.1: in `.github/dependabot.yml`, set the npm entry to `directory: "/"` and remove the member-directory entries (`directories: ["/", "/apps/mobile", ...]`). The root job still updates every workspace package.
