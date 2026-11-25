---
type: standard
kind: platform
description: Read before reporting any change as complete or accepted.
version: 2.5.0
applies_to: [all]
---

# Verification

Completion claims rest on the target's checks and observed runtime evidence, with untested paths stated.

## Rules

- Run the affected target's configured checks. Start with the changed behavior and failure paths, then complete its required gates. Build shared workspace outputs before dependent checks. A root suite does not cover an excluded target. Preserve assertions and checks; report pre-existing failures with evidence.
- For runtime work, identify the revision, bundle, backend, and device/browser before writes. Use the host's shared preview/device tools when available. Exercise the changed journey, recovery, and refresh/reopen; identify inaccessible paths.
- For mobile runtime work driven by an automation tool such as `agent-device`, run the loop: open the app, act, read the UI diff each action returns, then assert the end state (for example `wait text "…"`). A screenshot alone is not verification. Prefer id selectors (`testID` maps to Android's `resource-id`) over text selectors, since visible text changes with locale.
- For a supplied design, verify each state as [design studies](design-studies.md#verify) describes.
- For native sheets, keyboard accessories, overlays, or platform hosts, run the [editors](editors.md#verify) flow before polishing.
- Verify supported themes/locales, larger text, accessibility, Back/dismissal, relevant gestures, and offline/error states. Capture motion as a recording; a still image cannot verify it. Physical hardware is needed for tactile haptics.
- Automated tests, bundle exports, device behavior, and provider delivery are separate evidence. Record untested paths explicitly.

## Stop hook

A Claude Code session in an app cannot end while lint, types or related tests fail on its changes. The Stop hook [`stop-checks.mjs`](verification/stop-checks.mjs) runs each time the agent tries to finish:

- It looks at the files changed since the branch left the default branch (committed, uncommitted and untracked). With no changes, or the same changes that passed before, it exits 0 at once. Untracked files count, so keep tool output (`.wrangler`, `.expo`, `dist`) in `.gitignore`.
- Otherwise it runs, in order: `biome check` on the changed files, `pnpm run typecheck` in each changed workspace package and in every workspace package that depends on it through a `workspace:` dependency (skipping a package the root `typecheck` already filters to), then `vitest related` and `jest --findRelatedTests` for the changed code (at most 4 test workers on a Mac outside CI). A full check takes about 20 to 30 seconds, longer for a change in a shared package; a repeat of a passed state takes under a second.
- A failing check exits 2 with the failing check, its command, and the last lines of its output. Claude Code shows that to the agent, which must fix the cause and try again. It may not weaken or skip a check to get past the hook.
- Limits: the run has a 180-second budget (`APPELENT_STOP_CHECKS_BUDGET_MS`). After 3 blocked attempts in a row (`APPELENT_STOP_CHECKS_MAX_BLOCKS`) the session may end, and the hook tells the user that the checks still fail. A timeout, a check that cannot start, or missing `node_modules` never blocks: the hook lets the session end with a note to run `pnpm verify`. A new user message starts a new count.
- The hook is a fast first gate, not a replacement for `pnpm verify` and CI, which still run the full suite before a PR is reported done.
- `APPELENT_STOP_CHECKS=off` in the session environment turns it off, for example for a session that only reads.
- Only Claude Code runs it. Codex and Grok threads in T3 read their own configuration, not `.claude/settings.json`, so their briefs keep `pnpm verify` as an explicit step before they report done.

## Implementation

1. Report results in the PR. Write a verification [record](documentation.md#records) only when a contract or decision cites the evidence.
2. Save noisy diagnostic output locally and inspect the failure excerpt with its exit status.
3. Stop hook: copy `docs/standards/verification/stop-checks.mjs` to `.claude/hooks/stop-checks.mjs`, and register it in `.claude/settings.json`:

   ```json
   "Stop": [{ "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/stop-checks.mjs\"", "timeout": 240 }] }]
   ```

## Verify

- Documentation-only changes need the [documentation](documentation.md#verify) checks.
- `node scripts/check-project.mjs --strict` fails when the Stop hook is not registered or `.claude/hooks/stop-checks.mjs` is missing, and warns when it differs from the distributed copy.
