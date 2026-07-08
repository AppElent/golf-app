---
name: verify
description: Verify that a code change actually does what it's supposed to by exercising it end-to-end and observing behavior — drive the affected flow, not just tests or typecheck. Run before committing nontrivial changes.
---

# Verify

## Route → module map

TODO — fill this in as routes are built out. For each real route, map it to the
files that implement it (route file, main components, Convex functions it calls),
e.g.:

```
/some-route  ->  src/routes/some-route.tsx  ->  components: ..., convex: ...
```

Don't guess this map speculatively; add an entry only once the route exists.

## Logging in during a preview

If the app uses `@appelent/auth`'s `TestLoginButton`/`shouldShowTestLogin`, the
sign-in screen shows a "▶ Dev: log in as test user" button whenever
`VITE_CLERK_PUBLISHABLE_KEY` is a Clerk **test** key (`pk_test_...`, never
`pk_live_...`) *and* both `VITE_TEST_USER_EMAIL`/`VITE_TEST_USER_PASSWORD` are
set. Use this to authenticate when verifying a feature behind the login wall on
the dev server or a non-prod preview — don't assume a real Clerk login is
required or that auth-gated pages are unreachable for automated verification.
If the button isn't showing, check `.env.local` (or the relevant preview's env)
for those two vars before concluding the app can't be tested logged-in.

## Scope

Local-first: drive the affected flow via the dev server (`.claude/launch.json`,
`preview_start`) and observe actual behavior, not just typecheck/lint/tests.
On web (no Convex/Clerk runtime creds available), verification falls back to
the static suite: `pnpm run typecheck`, `pnpm run check`, `pnpm test`, `pnpm build`.
