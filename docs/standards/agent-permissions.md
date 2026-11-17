---
type: standard
kind: capability
description: Read when changing a project's `.claude/settings.json` or hooks, adding an allow rule, or when an agent command is blocked by the deny list.
version: 1.0.0
applies_to: [web, mobile, backend]
---

# Agent permissions

Irreversible actions are hard-blocked for every agent in every project, in every permission mode, instead of left to prompt text or the auto mode classifier.

## Rules

- **The reversibility test.** "If an agent gets this wrong once, can we take it back?" If not, it belongs on the deny list, not in a prompt or a runbook line. Reversible actions (a branch, a PR, a local file, a preview OTA) stay in the normal permission flow.
- Each project's `.claude/settings.json` holds every rule in `BASELINE_DENY` from `scripts/lib/project/agent-permissions.mjs` (a toolkit script, synced into every project) under `permissions.deny`. Projects add their own deny rules next to it and never drop one. Deny wins over allow, so no allow rule can reopen a baseline rule.
- The baseline covers:
  - reading secrets: `.env` and `.env.*` (also `.env.example`; read `env.manifest.ts` for variable names), `.dev.vars*`, key and keystore files, `credentials.json`, and `~/.ssh`, `~/.aws`, `~/.gnupg`, `~/.config/gh`, `~/.convex`, `~/.expo`, `~/.netrc`, `~/.npmrc`;
  - recursive deletes of home, the filesystem root, or a parent folder;
  - force pushes and deletes of `main` or `master`;
  - `convex deploy` and Convex commands with `--prod`;
  - `eas submit`, `--auto-submit`, production `eas build`, and production `eas update`;
  - `wrangler deploy` without a non-production `--env`;
  - the package scripts that deploy or ship (`deploy`, `deploy:prod*`, `ship:production`, `mobile:update:production`).
- Deny rules match the command as written, so `sh -c '…'`, `npx eas-cli submit` or `git -C x push -f` slip past them. A `PreToolUse` hook, [`irreversible-guard.mjs`](agent-permissions/irreversible-guard.mjs) in `.claude/hooks/`, registered as `node "$CLAUDE_PROJECT_DIR/.claude/hooks/irreversible-guard.mjs"` with matcher `Bash`, closes that gap. It reads every command in a Bash call (also inside `sh -c`, `eval`, `$(…)`, backticks, `if`/`for`/`{ }` blocks, `sh <<EOF` scripts, `bash <<<` here-strings and wrappers such as `timeout`, `env`, `sudo`, `npx`, `pnpm exec`; other heredoc bodies are data, so a commit message may name a denied command) and denies the same actions in any spelling, plus: recursive `rm` outside the project, its `additionalDirectories` and the temp folders; `eas build` without `--profile` (EAS builds `production` by default); `wrangler secret`/`versions deploy`/`rollback` on production; and any `deploy`/`ship` script except `:dev`, or any script ending in `:prod`/`:production`. A force push whose branch it cannot resolve (`$B`, `$(…)`) or an `rm` target it cannot resolve (also brace expansions such as `{a,b}`, and relative targets after a `cd` it cannot place, such as one under `CDPATH` or in a command with `( … )`) gets a prompt. A refspec-less force push also follows the saved `push.default`. Every other command exits the hook silently and keeps the normal flow.
- The deny list and the hook go together; add both or neither. They sit next to the [Convex local guard](convex.md) and the [env guard](environments.md), which keep their own allow rules safe.
- An approved irreversible step never runs through an agent: it runs in its CI workflow (merge to `main`, the gated production OTA job) or Eric runs it himself, in his terminal or with `!` in Claude Code. Do not add an allow rule or a hook exception to let an agent run it.
- A new irreversible command (a new CLI, a new deploy script) goes into `BASELINE_DENY` and the hook in developer-home first, then into each project with the next toolkit sync.

## Implementation

1. Copy `docs/standards/agent-permissions/irreversible-guard.mjs` to `.claude/hooks/irreversible-guard.mjs`.
2. In `.claude/settings.json`, add every `BASELINE_DENY` rule to `permissions.deny`, and register the hook under `hooks.PreToolUse` with matcher `Bash`.

## Verify

- `node scripts/check-project.mjs --strict` (part of CI) fails when a baseline rule or the hook registration is missing and warns when `.claude/hooks/irreversible-guard.mjs` differs from the distributed copy.
- In a Claude Code session in the project, `cat .env.local` and `npx convex deploy` are refused, while `pnpm verify` and `CONVEX_AGENT_MODE=anonymous npx convex dev --once` still run.
