---
name: verify
description: Verify that a code change actually does what it's supposed to by exercising it end-to-end and observing behavior — drive the affected flow, not just tests or typecheck. Run before committing nontrivial changes.
---

# Verify

## Route → module map

Web routes are file routes: `/rounds/new` is `src/routes/rounds.new.tsx`, and that
file imports its components and Convex functions. Mobile routes are in
`apps/mobile/app/`, each importing a screen from `apps/mobile/src/features`.

## Logging in during a preview

The web app has no test-login button: `AuthGate`
(`src/integrations/clerk/auth-gate.tsx`) shows Clerk's sign-in, and nothing behind
it renders while signed out. The dev server and PR previews use the Clerk test
instance, so sign in with a test account; if you have none, ask the user to sign in
in the preview.

## Scope

Local-first: drive the affected flow via the dev server (`.claude/launch.json`,
`preview_start`) and observe actual behavior, not just typecheck/lint/tests.
On web (no Convex/Clerk runtime creds available), verification falls back to
the static suite: `pnpm run typecheck`, `pnpm run check`, `pnpm test`, `pnpm build`.
