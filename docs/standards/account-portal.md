---
type: standard
kind: capability
description: Read when adding or changing an app's account portal contract (`convex/accountPortal.ts`), or building the portal that calls it.
version: 1.0.0
applies_to: [backend, web]
---

# Account portal contract

Every app exposes the same four functions in `convex/accountPortal.ts`, so the central account portal can show, export, and delete one person's data per app without a database of its own.

## Rules

- The portal has no backend data. Its browser opens one Convex client per app with the shared Clerk session's `convex` token, which every app's `auth.config.ts` already accepts ([auth](auth.md)). No app trusts the portal origin for anything beyond that token.
- Each function resolves the caller from the token, never from an argument, and takes no user id. It wraps the app's existing export, deletion, and blocker code from [Convex backend](convex.md#account-deletion-and-export); it does not duplicate their registries.
- A caller who never used the app gets `null` from `summary` and an empty export, never an error, and no user row is created by any portal call.
- `summary` (query) returns `null` or `{ contract: 1, lastActiveAt, counts }`:
  - `lastActiveAt`: epoch ms of the caller's latest write, or `null` when the app does not track it.
  - `counts`: `{ key, count, more }[]`, one per kind of data the person owns, in display order. `key` is a stable camelCase name (`recipes`, `sets`); the portal owns the labels per app and locale. Each count reads at most 1,000 rows (`take(1001)`); `more: true` means "1,000 or more". Apps with a stored counter return the exact number and `more: false`.
- `deletionBlocker` (query) returns `null` or `{ code, params }`, a stable code from the app's error catalog (an active session, data others depend on). The portal shows it and offers no delete while it is set.
- `exportPage` (query) takes `{ cursor: string | null }` and returns `{ contract: 1, app, tables, next }`. `tables` is `Record<string, unknown[]>` for this page only; `next` is an opaque string or `null` when done. The cursor encodes the app's own step (table, group, page cursor) as JSON; the portal never parses it. Pages stay within one query's read limits; the content rules are those of the app's in-app export.
- `deleteAppData` (mutation) takes `{ expectedSubject }` and returns `{ done }`. It deletes one bounded batch of this app's data for the caller and keeps the Clerk user; the portal repeats it until `done`. It refuses while `deletionBlocker` is set and when the subject differs. Deleting the whole AppElent account (all apps, then the Clerk user) is the portal's job, in that order.
- Bump `contract` only for a breaking change; the portal handles every contract it lists and shows an app with an unknown contract as unreachable.

## Implementation

1. Add `convex/accountPortal.ts` with the four functions, each a thin wrapper:
   ```ts
   export const summary = query({
     args: {},
     handler: async (ctx) => {
       const userId = await getOptionalUserId(ctx)
       if (!userId) return null
       return portalSummary(ctx, userId) // null when the person has no data here
     },
   })
   ```
2. Count with the owner index the export registry already names, capped as above.
3. Test with the app's Convex test harness: never-used caller (`null`, empty export, no row created), a populated caller (counts, full export across pages ends with `next: null`), a blocked caller, and a subject mismatch on `deleteAppData`.

## Verify

- `pnpm verify` passes with the four tests above.
- Against the app's dev deployment, a signed-in portal session reads `summary` and drains `exportPage` to `next: null`; a second account sees none of the first account's rows.
