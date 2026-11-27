---
type: standard
kind: capability
description: Read when changing a project's `.claude/settings.json` or hooks, adding an allow rule, when an agent command is blocked by the deny list, or before driving a simulator or emulator.
version: 1.8.0
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
- Deny rules match the command as written, so `sh -c '…'`, `npx eas-cli submit` or `git -C x push -f` slip past them. A `PreToolUse` hook, [`irreversible-guard.mjs`](agent-permissions/irreversible-guard.mjs) in `.claude/hooks/`, registered as `node "$CLAUDE_PROJECT_DIR/.claude/hooks/irreversible-guard.mjs"` with matcher `Bash`, closes that gap. It reads every command in a Bash call (also inside `sh -c`, `eval`, `$(…)`, backticks, `if`/`for`/`{ }` blocks, `sh <<EOF` scripts, `bash <<<` here-strings and wrappers such as `timeout`, `env`, `sudo`, `npx`, `pnpm exec`; other heredoc bodies are data, so a commit message may name a denied command) and denies the same actions in any spelling, plus: recursive `rm` outside the project, its `additionalDirectories` and the temp folders; `eas build` without `--profile` (EAS builds `production` by default); `wrangler secret`/`versions deploy`/`rollback` on production; and any `deploy`/`ship` script except `:dev`, or any script ending in `:prod`/`:production`. It also denies, without a matching deny rule: `npm`/`pnpm`/`yarn`/`bun publish` (except `--dry-run`); `eas workflow:run`; `wrangler pages deploy` without a preview `--branch`, Pages secrets and deletes; remote D1 writes (`d1 execute` or `d1 migrations apply` with `--remote`, `d1 delete`, `d1 time-travel restore`) without a non-production `--env`; `git clean -x`/`-X`, which deletes ignored `.env` files; and `find … -delete` or `find … -exec rm` outside the project, or on a project root without a name or path filter. `deploy:preview` and `deploy:staging` stay denied: in our apps they run `--auto-submit` or deploy shared staging Convex. A shell that reads its script from a pipe is checked when the pipe comes from `echo`, `printf` or a heredoc, and gets a prompt otherwise (`curl … | sh`). A shell reading a script file (`bash < script.sh`) has that file checked, and gets a prompt when it cannot read it. An interpreter that reads its program from a pipe (`curl … | node`, `| python3`, `| perl`) gets a prompt unless the pipe comes from `echo`, `printf` or a heredoc, the same as `node -e`. Words `xargs` reads from stdin count as unresolvable targets, so `find … | xargs rm -rf` gets a prompt. A command name built by substitution (`$(echo eas) submit`, `$CMD -rf /`) gets a prompt when its arguments would be denied for any guarded program. A force push whose branch it cannot resolve (`$B`, `$(…)`) or an `rm` target it cannot resolve (also brace expansions such as `{a,b}`, and relative targets after a `cd` it cannot place, such as one under `CDPATH` or in a command with `( … )`) gets a prompt. A `cd` into a folder that a `mkdir` earlier in the same call creates counts as a successful `cd`. A refspec-less force push also follows the saved `push.default`. Every other command exits the hook silently and keeps the normal flow.
- A `Stop` hook, [`stop-checks.mjs`](verification/stop-checks.mjs), keeps a session from ending while lint, types or tests fail on its changes; see [verification](verification.md#stop-hook).
- The deny list and the hook go together; add both or neither. They sit next to the [Convex local guard](convex.md) and the [env guard](environments.md), which keep their own allow rules safe.
- An approved irreversible step never runs through an agent: it runs in its CI workflow (merge to `main`, the gated production OTA job) or Eric runs it himself, in his terminal or with `!` in Claude Code. Do not add an allow rule or a hook exception to let an agent run it.
- A new irreversible command (a new CLI, a new deploy script) goes into `BASELINE_DENY` and the hook in developer-home first, then into each project with the next toolkit sync.

## Fairway (golf-app) dev Convex push

Eric, 21 Nov 2026 (APP-457): agents may push Convex functions to golf-app's **dev** deployment only, using `convex dev --once` with **no deploy key**. That is the official no-deploy-key dev path; it cannot reach production. Production Convex (`convex deploy`, `--prod`, a `prod:` deployment or a deploy key) stays on the deny list and in `hard_deny`.

- Run it from an up-to-date `golf-app` checkout of `main` (or a worktree of current `main`), with `CONVEX_DEPLOY_KEY` unset and `CONVEX_DEPLOYMENT` set only to that project's configured **dev** deployment (`dev:…` from the repo env, never a `prod:` value):

  `env -u CONVEX_DEPLOY_KEY CONVEX_DEPLOYMENT=dev:<golf-app-dev> pnpm exec convex dev --once`

- Then verify with a read-only `convex function-spec` on the same `dev:` deployment, still without a deploy key. Do not print secrets, deploy keys, or the contents of `~/.convex`.
- This allowance is golf-app's dev deployment only. Other AppElent apps still need their own explicit go before an agent pushes Convex, even to a `dev:` deployment.
- Do not add a hook exception, an allow rule that shadows `BASELINE_DENY`, or a deploy-key path to make this work.

## Driving simulators unattended

Eric, 18 Nov 2026: agents must drive simulators without Eric at the Mac.

- **Drive simulators only from Bash**: `agent-device`, `maestro` and `xcrun simctl`, always with the claimed UDID (`--udid`, `--device`). Bash commands follow the project's permission rules and need no prompt from Eric.
- **Never use the Claude desktop app's iOS Simulator tool** (`mcp__Claude_Code_iOS_Simulator__control`) or computer use on the Simulator app. The desktop app asks Eric to approve each simulator by UDID. Agent simulators get a new UDID for every task, so every thread raised a new prompt. An unanswered prompt blocks retries for a while, and a declined one blocks that device for good.
- Claim and release devices with `~/.agents/bin/sim` (see the RUNBOOK's Local folders section). For an app's dev build, use [`scripts/run-mobile.mjs`](mobile-run.md), which claims and releases through `sim`.
- Wait for a simulator with a polling loop inside one command (`agent-device wait`, `simctl bootstatus -b`), not with `sleep`, which the harness blocks.

### Auto mode on the Mac

Remote Control and T3 sessions on the Mac run in auto mode, often from `~/Developer`, which has no project settings: there the project deny list and guard hooks do not load, and only the auto mode classifier stands between an agent and an action. By default the classifier trusts only the folder and repository a session started in, so it blocked routine work such as pushing a branch in a sibling repository, and it flagged simulator taps on "Delete" in a dev build and `simctl delete` inside a compound command.

`autoMode` is only read from user settings (`~/.claude/settings.json`) or managed settings, never from a project's `.claude/settings.json`. Eric's user settings carry the entries in [`auto-mode.json`](agent-permissions/auto-mode.json) (approved by Eric, APP-229):

- **environment** names what is trusted and why: the AppElent GitHub repositories, `~/Developer` with its worktrees and agent folders, the services we use (GitHub, Convex, Expo/EAS, Linear, Sentry, Clerk, Cloudflare, Notion, UptimeRobot) and their domains. It also names what is sensitive: production targets and the secret files on the deny list.
- **allow** marks routine work as expected: pushing branches and pull requests in any AppElent repository, worktree cleanup, development and preview releases (including the golf-app dev-only `convex dev --once` path above), Linear and Sentry tracking one issue at a time, and simulator testing in `.dev` builds. Each entry names what it leaves out (APP-444, after `claude auto-mode critique`): merging a pull request, `git worktree remove --force` and glob deletes, bulk changes in Linear and Sentry, `simctl delete all`, `erase all` and `delete unavailable`, and data in the `.preview` app, which runs on production data.
- **hard_deny** repeats the never-do list for sessions where the project deny list does not load: production deploys (every `convex deploy`, since with no flags it targets production), store submissions and production OTA outside the gated job (also `eas update --auto` or without an explicit `--channel`), and reading secrets.

Every list starts with `"$defaults"`, so the built-in rules stay. Change the entries in `auto-mode.json` first, then Eric runs `pnpm auto-mode diff` and `pnpm auto-mode apply` in `~/Developer/developer-home`; `apply` backs up the file, adds missing entries and removes the old wordings listed under `retired`. Rewording an entry therefore means moving its old text to `retired` in the same change; `apply` only adds the text it does not know. An agent does not edit Eric's user settings itself: the classifier blocks that as undermining oversight, also after a card approval. Check the result with `claude auto-mode config` and `claude auto-mode critique`.

These entries do not loosen the deny list or the guard hooks.

### Store builds on the Mac

Eric approved (25 Nov 2026, APP-865) that an agent runs a store build after his go for that build: `pnpm builds build <app> <profile> ios`, with or without `--submit`, in `~/Developer/developer-home`. The builds tool loads the app's secrets from Infisical without printing them and checks Convex drift, and `--submit` uploads to TestFlight. Releasing in App Store Connect and sending a build to App Review stay with Eric.

- developer-home's `.claude/settings.json` lists every allowed command in full, one rule per app (workouts, golf-app, gather, games) and profile (production, preview, preview-internal), with and without `--submit` and `caffeinate -i`. A `*` in a Bash rule also matches spaces and flags, so the rules use no wildcard: `--allow-convex-drift`, `--from` and passthrough arguments after `--` (which reach `eas build` inside the tool, where the guard hook cannot see them) still prompt.
- The `allow` entry in `auto-mode.json` names the same command for sessions that start elsewhere, and the store-submission `hard_deny` entry makes the builds tool its only exception. `auto-mode.json` lists reworded entries under `retired`, and `pnpm auto-mode apply` removes those from Eric's settings.
- Start a Remote Control session for a store build in `~/Developer/developer-home`, so the project allow rules load.

## Implementation

1. Copy `docs/standards/agent-permissions/irreversible-guard.mjs` to `.claude/hooks/irreversible-guard.mjs`.
2. In `.claude/settings.json`, add every `BASELINE_DENY` rule to `permissions.deny`, and register the hook under `hooks.PreToolUse` with matcher `Bash`.

## Verify

- `node scripts/check-project.mjs --strict` (part of CI) fails when a baseline rule or the hook registration is missing and warns when `.claude/hooks/irreversible-guard.mjs` differs from the distributed copy.
- In a Claude Code session in the project, `cat .env.local` and `npx convex deploy` are refused, while `pnpm verify` and `CONVEX_AGENT_MODE=anonymous npx convex dev --once` still run. In golf-app, the approved dev push (`env -u CONVEX_DEPLOY_KEY CONVEX_DEPLOYMENT=dev:<golf-app-dev> pnpm exec convex dev --once`) is also allowed; a `prod:` deployment or a deploy key is not.
