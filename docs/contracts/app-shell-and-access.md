---
type: contract
description: Read when changing sign-in, the web app shell, or who may read or write a user's data in Convex.
version: 1.2.0
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
- **Sign-out:** the Account section at the foot of `/profile`
  (`src/integrations/clerk/account-section.tsx`) calls Clerk's `signOut()` and
  leaves simulation mode. Clerk returns the tab to `afterSignOutUrl` (`/`), and
  `AuthGate` shows the sign-in card on every protected path. The web score
  queue (`src/offline`) is kept per Clerk user id, so a golfer's unsent scores
  go when they sign back in, and the next golfer on that browser neither sends
  nor counts them. The queue from before that split stays unclaimed: any
  account's flush may try it, Convex accepts only the owner's entries, and it
  is never moved into an account.
- **Account deletion:** the same Account section (and Profile → Delete
  account on the phone) first asks what to delete, because Gather, Foundry,
  Fairway and Arcade Club share one AppElent (Clerk) login (APP-392):
  - **Fairway data only** (listed first): `account.deleteMyData` with the
    caller's `expectedSubject`, repeated until it returns `done`, then that
    account's web score queue (phone: the last-known copy), then sign-out on
    this device. The Clerk user and any Apple grant are untouched, no
    tombstone is kept, and the sign-in card (phone: an alert) confirms that
    the login still works in the other apps. Signing in again starts an empty
    profile.
  - **Whole AppElent account**: the same purge, then the Clerk user
    (`user.delete()`, behind Clerk's reverification prompt on the web when the
    instance asks for one). If Clerk refuses, the data is gone and a retry
    deletes the Clerk user.
  - Simulation mode goes off. If the purge fails partway, the golfer stays
    signed in and a retry deletes what is left.
- **Clerk webhook:** `POST /clerk/webhook` (`convex/http.ts`) verifies the
  Svix signature against `CLERK_WEBHOOK_SECRET` and, on `user.deleted`, runs
  the same purge (`purgeUserData` in `convex/userData.ts`) for `data.id`
  through `account.purgeDeletedUser`, which reschedules itself until done. So
  a login deleted in another app or the Clerk dashboard takes its Fairway data
  with it. Unsigned or badly signed deliveries get 401 and do nothing; other
  events get 200 and do nothing.
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
