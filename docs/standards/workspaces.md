---
type: standard
kind: platform
description: Read when creating, preparing, or cleaning a worktree and its backend resources.
version: 3.6.0
applies_to: [all]
---

# Workspaces

Every worktree is prepared by one script from the canonical source, the same way in
every app and editor, and cleans up what it created.

## Rules

- The editor's worktree setup hook runs `node scripts/workspace.mjs prepare --editor
  <host>` from the new worktree. No other setup script, and no copying of another
  checkout's dotenv files, `.dev.vars`, or deployment keys (`.worktreeinclude` lists no
  `.env*`).
- **Default:** `backend.mode: "none"`. Prepare writes local files from Infisical
  (`env apply local --only file`), so every worktree uses the dev deployment named in
  Infisical `dev`. Its data and functions are shared: use throwaway accounts for
  destructive checks, and push backend changes from a `local` or `cloud` worktree.
- `local` mode selects the project's local Convex deployment (`<project>:local`, run on
  this machine) for offline work or isolation without a cloud deployment. Prepare does
  not start the backend: start it as a separate editor action (`convex dev` takes the
  next free port from 3210). When no backend listens on the selected URL, prepare
  finishes `ready` with a `workspace.backend-environment.deferred` warning and leaves
  `backend-environment` pending; start the backend, then run prepare again with the
  same options to apply the backend values (only that step runs). That rerun first
  checks the generated files and stops with `workspace.resume.drift` on a hand edit
  instead of adopting it (changed deployment selectors alone are accepted, since
  `convex dev` may rewrite the URL). Resuming a failed prepare accepts the same
  selector rewrite, so starting `convex dev` after a failure does not strand the
  ledger. When routing values
  into a running backend fails, the error names the port and the process that holds it.
  `clean` and `gc --apply` only release a local deployment's ledger entry; the shared
  deployment and other worktrees' backends stay.
- Use `cloud` (policy `backend.mode`, or `prepare --backend cloud` for one worktree,
  with a `team:project` and a finite `expiration`) when a change needs its own
  backend: schema migrations, seeds, destructive data work. The script provisions it,
  applies its Convex values, writes client URLs, seeds, and records it for cleanup.
  Each cloud worktree costs one deployment of the team quota, so before creating one,
  `prepare` first reconciles this repository's workspaces whose checkout is gone.
  When creation is refused for quota (`DeploymentQuotaReached`), nothing was created, so the ledger records the
  deployment as absent and `clean` finishes at once instead of waiting for an expiry.
- Cleanup removes only what the ledger owns: scoped credentials, unchanged generated
  files, and the cloud deployments it created. `clean` and `gc --apply` delete an
  owned deployment through the Convex Management API with the signed-in CLI's token,
  only after its reference still selects the recorded deployment and the API reports
  it as a non-default dev deployment with that reference; otherwise it waits for its
  expiry. Modified or unowned files stay; the checkout is never deleted. A failed
  cleanup is outstanding work, not permission to erase the ledger.
- A finished branch does not keep its cloud deployment until expiry. On the Mac,
  the daily worktree cleanup (`pnpm worktrees --apply` in developer-home) runs
  `clean` for a worktree whose branch has a pull request, none of them open, when
  nothing but its ledger keeps it, so the deployment goes within a day of the merge
  or close. A worktree with an open pull request, or none yet, keeps it.
- `env apply` never overwrites an output file it did not generate. Prepare replaces
  a pre-existing one that holds only what the Convex CLI writes (its comment and
  deployment selectors); any other names the file in the failure, to move aside.
- Provider commands drop inherited deployment selectors and credentials and run from
  a staging directory with a minimal `package.json`, which the Convex CLI requires. Keep Convex
  selectors out of any unmanaged `.env` a package script could load.
- After a successful `clean`, `prepare` starts over and accepts a changed policy;
  after an interrupted `clean`, finish `clean` first. A failed `prepare` names the
  step and one credential-scrubbed line of output.
- Never reclaim a lock because it is old: confirm no operation is active first.
- Persistent processes (Convex, web, Metro) run as separate editor actions, not in
  setup. Physical devices need a device-reachable backend URL, not loopback.

## Implementation

1. Add the `workspace` policy to `appelent.json` ([example](workspaces/examples/appelent.json)):

   | Key | Purpose |
   | --- | --- |
   | `schemaVersion` | Always `1`. |
   | `workspace.backend` | `mode`, `project`, `expiration`, `scopedCredential`, `push`. |
   | `workspace.install`, `buildScripts`, `seedScript` | Install and build before the environment step; seed a new backend. |
   | `workspace.outputs` | Generated files and the mobile URL name. |
   | `workspace.ports` | Web and Metro ports. |
   | `envManifest` | Manifest path; defaults to `env.manifest.ts`. |

2. Point the editor's setup hook at the script; configure cleanup before checkout
   removal where the editor supports it. Configure editors without a hook API through
   their own settings; never invent a repository config file for them.

   ```sh
   node scripts/workspace.mjs prepare --editor t3 --dry-run
   node scripts/workspace.mjs prepare --editor t3
   node scripts/workspace.mjs clean
   node scripts/workspace.mjs gc --dry-run
   node scripts/workspace.mjs gc --apply
   ```

The script needs only Node built-ins and the authenticated provider CLIs, so it runs
before dependencies are installed. State and ledgers live in the operating system's
application state directory, outside the checkout, and never hold secret values.

## Verify

- A new worktree has `.env.local` (and the mobile file) marked as generated, without
  any manual copy.
- `prepare` resumes after an interrupted run; `clean` then leaves no owned files, and
  `gc --dry-run` reports nothing outstanding.
- With `cloud`: the worktree's Convex URL differs from the dev deployment, and the
  deployment is deleted after `clean` (or after `gc --apply` once the worktree is
  removed).

## Migration

From 2.x: point the editor hook at `workspace.mjs prepare` and verify a fresh
worktree; then remove copy scripts (`copy-env.sh`, `copy-worktree-env.mjs`, custom
`setup-worktree.mjs`) and `.env*` lines in `.worktreeinclude`, and delete the
"worktrees share the dev deployment" exception: that is now the default. Apps that
relied on isolated worktrees set `backend.mode` to `cloud` or `local`. Keep existing
ledgers so cleanup still finds old resources. Remove the legacy `features` key from `appelent.json`.

To 3.4: no project change. Ledgers written before 3.4 have no selector-free digest,
so a deferred rerun there treats any change to a generated file, selectors included,
as drift; clean and prepare again to clear it.
