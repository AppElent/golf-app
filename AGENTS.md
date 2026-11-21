# AGENTS.md

<!-- appelent-guidelines:start -->
Before implementing or reviewing code, read CODING_STANDARDS.md.
For UI work, also read DESIGN_SYSTEM.md. Follow their task-specific links.
<!-- appelent-guidelines:end -->

Fairway is a golf companion app (web, Convex, Expo phone app, shared `packages/core`). pnpm, always.

Before the task, read the matching project doc:

| When you are… | Read |
| --- | --- |
| Running the app locally, running checks, or adding an environment variable | [Local development](docs/runbooks/development.md) |
| Changing sign-in, the app shell, or who may read or write a user's data in Convex | [App shell and access](docs/contracts/app-shell-and-access.md) |
| Adding or correcting a course, or handling a course suggestion | [Course catalog](docs/runbooks/course-catalog.md) |
| Adding a feature or a web or mobile route, or deciding which platform it ships on | [Parity ADR](docs/adr/0001-the-phone-plays-rounds-and-the-web-authors-courses.md), `packages/core/src/features.ts` |
| Touching `apps/mobile/` | [apps/mobile/AGENTS.md](apps/mobile/AGENTS.md), [Mobile](docs/runbooks/mobile.md) |
| Deploying, or changing the deploy workflows | [Deploy](docs/runbooks/deploy.md) |
| Using or changing PR previews or mobile PR builds | [Previews](docs/runbooks/previews.md) |
| Changing error reporting, source maps, or the Convex forwarder | [Sentry](docs/runbooks/sentry.md) |
| Upgrading dependencies | `upgrade-dependencies` skill; never weaken or skip a test to make an upgrade pass — stop and report |
| Reviewing the app, or capturing a user-led review session | `review-app` skill |
| Watching a PR through CI and review | `babysit-pr` skill |

Adding, moving, or finding docs: [docs map](docs/README.md).

## Factory workflow

The [factory runbook](https://github.com/AppElent/developer-home/blob/main/RUNBOOK.md) (on the Mac: `~/Developer/developer-home/RUNBOOK.md`) owns this process; where this section differs, the runbook wins.

Linear (workspace `appelent`, team AppElent, key `APP`) is the source of truth; an issue has the app label and a blast radius. Track work there, never as GitHub Issues.

- `ready-for-agent`: the issue has sharp, testable acceptance criteria and a blast radius, so an agent can pick it up.
- `ready-for-human`: Eric must do or decide something. Add a comment saying what, where, and roughly how long.
- The moment you start a T3 thread for an issue, post a Linear comment `T3 thread: <title> (<thread id>), started by <hub, grok, or claude-code>` and move the issue to In Progress. An issue with such a comment is taken; do not start a second thread for it.

Work in a worktree from `origin/main` on a branch `<type>/app-123-short-slug` (type: feat, fix, refactor, chore, docs, or test). Put `Fixes APP-123` in the PR description. End in a PR with tests (and a PR preview where the repo has one).

Blast radius, which is also the review tier (`Risk: low|med|high` with one line why in the PR body, and `blast-radius:low|med|high` on the PR; when in doubt, pick the higher tier):
- low: copy, styling, small fixes, tests, refactors within one module, docs.
- med: new features (for example a game), UI flows, new dependencies, shared behaviour across several screens.
- high: Convex schema, data migrations, deleting data, auth, permissions, payments, production config, secrets, CI or deploy config, and anything that can break the installed mobile apps or affect other users without a way back.

Review the PR in this same thread as the runbook's [Review by risk tier](https://github.com/AppElent/developer-home/blob/main/RUNBOOK.md#review-by-risk-tier) says: `low` is green CI plus your self-check against the acceptance criteria; `med` and `high` get read-only reviewer subthreads, never separate review or council threads. The Codex GitHub review is advisory: address its comments, do not wait for it. Post the review on the PR, fix blockers, and end your final message with `Review verdict (<tier>): PROCEED` or `REVISE` with the open blockers, then a **Leftover work** heading listing everything found but left out of scope, without fixing it.

UI changes follow [general design](docs/standards/general-design.md): screenshots in the PR, and new screens or flows wait for Eric's approval before merge.

Coding agents never merge; the manager merges per the runbook. Never read or change production secrets, and never approve production deployments.
