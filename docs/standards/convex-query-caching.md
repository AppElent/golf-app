---
type: standard
kind: capability
description: Read when adding, changing, or reviewing Convex query reads, subscription retention, or local read caches in an Expo app.
version: 1.4.0
applies_to: [mobile]
---

# Convex query caching

Screens return to recently viewed data without reloading, through one query module and a fixed set of flavors, with no cache code in screens.

## Rules

### All flavors

- **Default:** the `retention` flavor (Layer 1), for online-first apps where revisits should be instant. Choose `last-known` (Layers 1 and 2) only when the project has decided to keep disposable copies of account data on the device so cold starts paint before queries answer. A project adopts exactly one flavor and records it in `CODING_STANDARDS.md` as `Convex query caching: <flavor>`; with none recorded, the standard is not adopted, so ask before adding one. Never combine parts of flavors or add per-screen or per-feature caches. Lifetimes and size limits are app values, not part of the flavor.
- One app-owned query module provides `useQuery`, `useQueries`, and `usePaginatedQuery`. Screens never import these from `convex/react`; Biome's `noRestrictedImports` enforces it. Mutations, actions, imperative `client.query`, and connection/auth hooks may still come from `convex/react`.
- Convex queries are live subscriptions with no stale time: never add pull-to-refresh or manual refetch for subscribed data.
- The cache stays below the authentication gate required by [auth](auth.md). It never shows data before Convex authenticates, except an [offline-readable copy](#offline-readable-copy-last-known-only-opt-in) shown by the gate's offline fallback.
- A direct account switch disables the protected query subtree until its live backend identity matches the locally selected account. Convex's authentication boolean alone can still describe the previous account during the transition.

### Layer 1: subscription retention (`retention`, `last-known`)

- `useQuery` and `useQueries` read through `convex-helpers/react/cache`, which keeps a subscription alive after its last consumer unmounts, so remounting with the same function and arguments returns data immediately.
- Retention is always bounded by a finite expiration and a maximum idle count. The app defines both once in the query module and records them with its flavor in `CODING_STANDARDS.md`; there are no per-query lifetimes.
- The provider is keyed by account, so sign-out or account change disposes every subscription. Backgrounding releases idle subscriptions and disables retention until the foreground; mounted subscriptions continue.
- Hooks pass arguments through unchanged and never skip queries on hidden screens.
- `usePaginatedQuery` passes through to `convex/react` unretained.

### Layer 2: last-known value on disk (`last-known` only)

- A disposable copy of query results is read synchronously on mount and shown until the live result replaces it and is written back.
- Arguments and values use Convex's `convexToJson`/`jsonToConvex` codec inside JSON, preserving bigint, bytes, and non-finite numbers. The key, not schema validation, provides correctness: cache version, account, function name, and arguments. The cache version changes with every JS bundle (native build plus OTA update id), so new code never reads an old shape.
- Startup and sign-out delete entries outside the current version and account. Writes are synchronous, so none survives account cleanup. Oversized values are skipped and every insertion enforces the total entry bound; the app records both limits with its retention values.
- Every failure (missing storage, read, parse, write, quota) is a cache miss: the cache never breaks a screen, blocks a write, or holds the only copy of data.
- Persistence is opt-in per backend module through one allowlist in the query module, covering `useQuery` and each `useQueries` request; callers do not change. Batched errors stay errors, never disk fallbacks.
- A cached value is for display only. Code that seeds a form, decides a write, or reads state that must be current (an active session, a lock, a balance) uses the module's `useLiveQuery` or `useLiveQueries`, which skip Layer 2.
- Disk fallback requires Convex-confirmed authentication and a connected socket; an offline cold start never paints persisted data, except for an [offline-readable copy](#offline-readable-copy-last-known-only-opt-in).
- Never persist search results, paginated or growing history, or functions excluded in the allowlist.
- **Default:** `expo-sqlite/kv-store` for synchronous reads.

### Offline-readable copy (`last-known` only, opt-in)

For the few things a person needs without network, such as a card shown at a till. The copy is disposable: when it is missing, unreadable, outdated, or from another bundle, the app behaves exactly as if there were no copy, and the screen waits for Convex. It is a read-only fallback, not offline support.

- A second allowlist in the query module names the offline-readable backend modules. Every one of them is also persisted. Record them with the flavor in `CODING_STANDARDS.md`.
- It uses the Layer 2 store, key, and codec. Never add tables, schemas, migrations, a second store, a write queue, sync, or offline edits.
- Persist only what the screen draws. Files and photos stay online, and anything the device can derive (barcode images, bundled assets) is derived on the device.
- Offline paint requires that the device is not connected, that the auth provider restored a session locally, and that the account matches the last account Convex confirmed on this device. That marker sits in the same store, and confirmed sign-out deletes it together with the entries.
- The auth gate shows the copy as its offline fallback: display-only views of offline-readable modules that read the copy alone and make no Convex calls. They hide or disable every write and show that the data is offline. Every protected screen and query stays behind the gate, and once Convex authenticates the gate swaps in the normal screens.
- When Convex connects, live data replaces the copy. If it confirms a different account, the offline screens unmount and the entries are pruned before anything else renders.

## Implementation

1. Install `convex-helpers` at a version whose `convex` peer matches the app. Recheck the retention starter's registry adapter when upgrading it. For `last-known`, also run `pnpm exec expo install expo-sqlite` and rebuild a development client if SQLite is newly added.
2. Copy the flavor's starter into the app's client query folder: [retention](convex-query-caching/examples/retention.tsx), or that file plus [last-known](convex-query-caching/examples/last-known.ts). Mount its `QueryCacheProvider` (`retention`: around the authenticated subtree; `last-known`: above the auth gate, kept mounted while signed out) and pass `account`, `confirmedAccount`, and `fallback`, plus `bundleVersion` for `last-known`, as the starter's header comment specifies. `confirmedAccount` is the live backend viewer query's result, derived from `ctx.auth`; never a disk copy or local identity.
3. Merge the [baseline](baseline.md) Biome fragment, which scopes `noRestrictedImports` to consumer directories. Exclude every app-owned query boundary file (the copied starters and the identity-query adapter); their direct Convex imports implement the boundary.
4. Change screen imports to the module. With `last-known`, move editors and current-state reads to `useLiveQuery`/`useLiveQueries`.
5. Delete per-feature retention or mirrors that the flavor replaces.
6. `last-known` only: to persist another area later, add its backend module to the allowlist, exclude any of its functions that must stay live-only, verify its screens, and delete its local retention.

## Verify

All flavors:

- Leave a screen and return within the expiration: no loading state, and no new subscription on the wire.
- Sign out and switch accounts, including directly while Convex still reports the previous identity: no previous account data appears, protected screens stay unmounted until the live backend account matches, and no old result is written under the new account's key.
- Background the app: idle subscriptions are released, and returning works normally.
- Paginated lists load and paginate as before.

`last-known` only:

- Relaunch on a persisted screen, with auth still loading and then offline: last-known data appears only once the same account authenticates and Convex connects, then updates to live. Confirmed sign-out, even right after a live result, deletes the account's entries.
- Change the bundle version, corrupt a value, make storage throw, and exceed the entry limit: no earlier entries are read, screens load from Convex, and the stored count stays bounded.

Offline-readable copy:

- Open the screen once online, then relaunch in airplane mode: the copy appears, marked offline, with every write unavailable. Other screens stay behind the gate.
- In airplane mode, with no copy, a corrupted copy, a new bundle, or after sign-out: nothing is painted, and nothing crashes. Reconnecting loads from Convex.
- Relaunch offline after signing in as another account: no copy from the previous account appears.
- bigint, bytes, and non-finite arguments and results round-trip in single and batched reads; batched errors still surface; an editor opened over cached data waits for live data.
