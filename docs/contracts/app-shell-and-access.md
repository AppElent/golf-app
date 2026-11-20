---
type: contract
description: Read when changing sign-in, the web app shell, or who may read or write a user's data in Convex.
version: 1.3.0
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
- **Sign-out:** the Account section of `/profile`, the Account page
  (`src/integrations/clerk/account-section.tsx`), calls Clerk's `signOut()`.
  Clerk returns the tab to `afterSignOutUrl` (`/`, the public "Open the
  Fairway app" page), and `AuthGate` shows the sign-in card on every protected
  path.
- **Account deletion:** the same Account section deletes the account after an
  inline confirm step: `account.deleteMyData` first, while Convex still accepts
  the session, then that account's leftover web score queue
  (`fairway.scoreQueue:<userId>` in localStorage, written by the round screens
  retired in APP-235), then the Clerk user (`user.delete()`, behind Clerk's
  reverification prompt when the instance asks for one). If the data cannot go, nothing is deleted
  and the golfer stays signed in; if Clerk refuses, the data is gone and a retry
  deletes the Clerk user. With the user gone, `AuthGate` shows the sign-in card.
- **Public pages:** the paths in `PUBLIC_PATHS` (`src/components/LegalPage.tsx`),
  `/` ("Open the Fairway app"), `/privacy` and `/support`, render without
  `AuthGate` and without the tab bar, so anyone, App Store Connect and the phone
  app can open them. They read no user data.
- **Retired paths:** `/play`, `/card`, `/rounds/new` and `/progress` answer a
  301 to `/` from the Worker (`src/server.ts`), before the app renders.
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
