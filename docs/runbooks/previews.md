---
type: runbook
description: Read when using or changing Fairway's pull-request previews or mobile PR builds.
version: 1.0.0
---

# Pull-request previews

Project facts for the shared [previews standard](../standards/previews.md).

| Label | Workflow | Result |
| --- | --- | --- |
| `preview:web` | `.github/workflows/preview.yml` | A per-PR Convex preview deployment, seeded, and a route-free Worker `golf-app-pr-<N>` on workers.dev (`CLOUDFLARE_ENV=pr`) |
| `build:ios`, `build:android` | `.github/workflows/mobile-build.yml` | A mobile dev client (`development` profile), rebuilt on each push while the label stays |

- Web previews use the Clerk development instance ([deploy runbook](deploy.md#auth)).
- Values come from repository-scope `PREVIEW_<name>` variables, written by
  `pnpm env:apply preview --only github`.
