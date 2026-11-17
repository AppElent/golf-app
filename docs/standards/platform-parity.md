---
type: standard
kind: capability
description: Read when deciding which platforms a feature ships on, adding or moving a route on web or mobile, or adding shareable links.
version: 1.0.0
applies_to: [web, mobile]
---

# Platform parity

Each platform has a stated goal that decides which features it gets. A typed feature list makes every exception explicit, and CI fails when the routes drift from it.

## Terms

- **Leading platform:** the platform the project's parity ADR names as the main one. New features land there by default.
- **Floor:** features both platforms must have: sign in, sign up, and password reset; account and profile editing; account deletion; data export; language; theme; privacy page; links that open on either platform.
- **Share target:** anything a user can send to someone else (a join link, an invite, a shared item). The receiver may not have the app.
- **Status:** `parity` (on both platforms), `exclusive` (on one platform by design), `pending-port` (meant for both, on one platform for now).
- **Layout:** `responsive` (works at phone width) or `large-screen` (needs a large screen to be useful).

## Rules

- Each project records its platform goals in one decision record in `docs/adr/`, the parity ADR. It names the leading platform (or states that both are equal), what each platform is for, and any reduced floor with its reason.
- `packages/core/src/features.ts` lists every feature with its `status`, `platforms`, route patterns, and, unless the status is `parity`, a `reason`. Copy the types from [`features.ts`](platform-parity/examples/features.ts).
- Every web and mobile route file belongs to at least one feature, and every route pattern matches at least one file. A feature can list a platform without routes when it lives inside another screen. A floor feature that exists on neither platform is `pending-port` with no platforms.
- Floor features and share targets are `parity` or `pending-port`, never `exclusive`. A project that reduces its floor records the reduction in its parity ADR, and lists the affected features as `exclusive` with a reason that links to that ADR.
- Data parity: data export and account deletion cover every table on both platforms. A platform does not need to *show* data whose feature is exclusive to the other platform.
- Share targets are fully usable in a browser by someone without the app. Shared links are `https` links on the web origin. The apps claim those links with iOS universal links and Android app links, so the same link opens the app when it is installed.
- Web pages are `responsive`. A page that needs a large screen is marked `layout: "large-screen"` with a `layoutReason`. At phone width it renders with a "best on a larger screen" notice instead of blocking.
- A project ships one web client. Expo web is not a deploy target; to reuse a web component inside the app, use Expo DOM components (`"use dom"`).
- The issue or spec for a new feature states its platforms and why. The PR that adds it adds or updates its entry in `features.ts`.
- **Default:** a new feature ships on the leading platform only, unless it is floor or a share target.

## Implementation

1. Copy [`features.ts`](platform-parity/examples/features.ts) to `packages/core/src/features.ts` and fill `FEATURES`.
2. Copy [`feature-manifest-check.ts`](platform-parity/examples/feature-manifest-check.ts) to `scripts/` and add a test next to it that the root Vitest run picks up:

   ```ts
   import { FEATURES } from "@app/core/features";
   import { expect, it } from "vitest";
   import { checkFeatureManifest, listRouteFiles } from "./feature-manifest-check";

   it("maps every route to a feature", () => {
     const routes = {
       web: listRouteFiles("src/routes"),
       mobile: listRouteFiles("apps/mobile/app"),
     };
     expect(checkFeatureManifest(FEATURES, routes)).toEqual([]);
   });
   ```

3. Universal links and app links:
   - Serve `public/.well-known/apple-app-site-association` and `public/.well-known/assetlinks.json` as `application/json` (a `public/_headers` rule on Workers static assets).
   - Add `ios.associatedDomains: ["applinks:<host>"]` and an Android `intentFilters` entry with `autoVerify: true` for the share paths to the app config.
   - Map each https share path to an app route with `+native-intent.tsx` or matching route files.
   - Link changes need a new native build. An OTA update cannot ship them.

## Verify

- The feature-manifest test passes in CI.
- `curl -sI https://<host>/.well-known/apple-app-site-association` returns `200` with `content-type: application/json`. Do the same for `assetlinks.json`.
- On a device with the app installed, a share link opens the app. Without the app, it opens the web page and the action can be completed there.
- A changed `responsive` page has a screenshot at phone width.
