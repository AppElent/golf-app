# AGENTS.md

<!-- appelent-guidelines:start -->
Before implementing or reviewing code, read CODING_STANDARDS.md.
For UI work, also read DESIGN_SYSTEM.md. Follow their task-specific links.
<!-- appelent-guidelines:end -->

Fairway is a golf companion app: web (`src/`), Convex backend (`convex/`), Expo
phone app (`apps/mobile/`), shared `@fairway/core` (`packages/core/`). pnpm, always.

Before the task, read the matching project doc:

| When you are… | Read |
| --- | --- |
| Running the app locally, running checks, or adding an environment variable | [Local development](docs/runbooks/development.md) |
| Changing sign-in, the app shell, or who may read or write a user's data in Convex | [App shell and access](docs/contracts/app-shell-and-access.md) |
| Adding or correcting a course, or handling a course suggestion | [Course catalog](docs/runbooks/course-catalog.md) |
| Adding a feature or a web or mobile route, or deciding which platform it ships on | [Parity ADR](docs/adr/0001-the-phone-plays-rounds-and-the-web-authors-courses.md), `packages/core/src/features.ts` |
| Touching `apps/mobile/` | [apps/mobile/AGENTS.md](apps/mobile/AGENTS.md), [Mobile](docs/runbooks/mobile.md) |
| Adding i18n to the web app, or a locale or feature area to the mobile catalog | `add-i18n` skill (`.claude/skills/add-i18n/`) |
| Verifying a change before you call it done | `verify` skill (`.claude/skills/verify/`) |
| Deploying, or changing the deploy workflows | [Deploy](docs/runbooks/deploy.md) |
| Using or changing PR previews or mobile PR builds | [Previews](docs/runbooks/previews.md) |
| Changing error reporting, source maps, or the Convex forwarder | [Sentry](docs/runbooks/sentry.md) |
| Upgrading dependencies | `upgrade-dependencies` skill; never weaken or skip a test to make an upgrade pass — stop and report |
| Reviewing the app, or capturing a user-led review session | `review-app` skill |
| Watching a PR through CI and review | `babysit-pr` skill |

Adding, moving, or finding docs: [docs map](docs/README.md).

## Factory workflow

Linear (workspace `appelent`, team AppElent, key `APP`) is the source of truth. Work is a Linear issue with an app label and a blast radius.

- `ready-for-agent`: the issue has sharp, testable acceptance criteria and a blast radius, so an agent can pick it up.
- `ready-for-human`: Eric must do or decide something. Add a comment saying what, where, and roughly how long.
- The moment you start a T3 thread for an issue, post a Linear comment `T3 thread: <title> (<thread id>), started by <hub, grok, or claude-code>` and move the issue to In Progress. An issue with such a comment is taken; do not start a second thread for it.

Work in a worktree from `origin/main` on a branch `<type>/app-123-short-slug` (type: feat, fix, refactor, chore, docs, or test). Put `Fixes APP-123` in the PR description. End in a PR with tests (and a PR preview where the repo has one). Do not merge the PR yourself.

After opening the PR, review it by risk tier, in this same thread (state `Risk: low|med|high` with one line why in the PR body; when in doubt, pick the higher tier): **low** (copy, styling, small fixes, tests, docs) needs green CI and your own self-check against the acceptance criteria; **med** (new features, UI flows) needs one read-only review pass by one other model, 8 or higher with no blockers; **high** (Convex schema, auth, payments, data migrations, anything that can break installed mobile apps) needs a full council (Opus, Sol, Grok; read-only; at least two must run, each 9 or higher with no blockers) and then waits for Eric. Post the review as a PR comment, fix blockers, and end your final message with `Review verdict (<tier>): PROCEED` or `REVISE` with reasons. Do not start separate review or council threads.

UI changes: include screenshots in the PR (iOS simulator and web, light and dark, small screen); build with the app's design system tokens and components, no one-off styling; look up references (for example Mobbin) before a new screen; follow the Apple HIG and native controls on iOS. New screens or flows wait for Eric's approval of the screenshots before merge.

End your report with a **Leftover work** heading listing everything found but left out of scope, without fixing it.

Blast radius (`low` / `med` / `high`, also `blast-radius:low|med|high` on the PR):

- low: UI, copy, tests, refactors within one module, docs.
- med: data model changes with migration and rollback, new dependencies, CI/workflows, shared behaviour across several screens.
- high: auth, payments, production config, secrets, deleting data, permissions, anything affecting other users without a way back.

Coding agents never merge. The manager (the Claude Projects hub, the Grok fallback, or the Claude Code Chief of Staff thread) merges `low` and `med` after green CI, green QA, and the tier's review `PROCEED`; `high` and the changes the [factory runbook](https://github.com/AppElent/developer-home/blob/main/RUNBOOK.md) lists as waiting for Eric stay open for Eric. Never read or change production secrets, and never approve production deployments.
