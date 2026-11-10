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
