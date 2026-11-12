---
type: contract
description: Read when changing sign-in, the web app shell, or who may read or write a user's data in Convex.
version: 1.1.0
status: current
---

# App shell and access

A golfer sees only their own rounds and private courses, on web and phone, after
signing in with Clerk.

## Behavior

- **Shell:** `src/routes/__root.tsx` wraps the web app in `ClerkProvider` →
  `ConvexProvider` → `AuthGate` (`src/integrations/clerk/auth-gate.tsx`). Signed
  out, the gate shows Clerk's sign-in and renders nothing behind it; signed in, it
  mounts the app once Convex has the token. There is no test-login button.
- **Public pages:** the paths in `PUBLIC_PATHS` (`src/components/LegalPage.tsx`),
  `/privacy` and `/support`, render without `AuthGate` and without the tab bar, so
  App Store Connect and the phone app can link to them. They read no user data.
  `isPublicPath` matches them exactly (case-sensitive, trailing slashes ignored).
- **Theme:** dark mode follows the OS through a `prefers-color-scheme` media query
  in `src/styles.css`.
- **Clerk ↔ Convex:** the web client uses `ConvexProviderWithClerk`
  (`src/integrations/convex/provider.tsx`). `convex/auth.config.ts` trusts the
  issuer in `CLERK_JWT_ISSUER_DOMAIN`, a Convex deployment variable. Which Clerk
  instance each environment uses is in the [deploy runbook](../runbooks/deploy.md#auth).
- **Ownership:** every per-user Convex function calls `getUserId`
  (`convex/lib.ts`) and checks that the caller owns each document it reads or
  writes.
- **Admin-only functions:** seeds and the course catalog sync are internal
  functions, callable only with an admin key. Catalog courses are read-only to
  users ([course catalog](../runbooks/course-catalog.md#users)).

## States

- Signed out: Clerk's sign-in, nothing else, except on the public pages.
- Signed in, token not yet accepted by Convex: nothing behind the gate renders.

## Out of scope

- Shared or group data: every row belongs to one user.

## Acceptance

- `convex/functions.test.ts` covers the ownership and internal-only rules. Extend
  it whenever you add a public function.
