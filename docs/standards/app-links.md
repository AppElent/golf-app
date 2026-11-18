---
type: standard
kind: capability
description: Read when making a shared, join, or invite link open the installed app, or when setting up the associated domains that let password managers fill and save app logins.
version: 2.2.0
applies_to: [web, mobile]
---

# App links

A link on the web origin opens the installed app on the matching screen, survives sign-in, and still works in a browser without the app. The same domain association lets password managers offer the website's saved logins in the app.

## Rules

- Shared links are `https` links on the production web host ([platform parity](platform-parity.md)). Each claimed path has a web route that works without the app.
- One module lists the claimed links with [`createAppLinks`](app-links/examples/app-links.ts): host, every variant's scheme, and per link the path, its validators, and the app route. A link is a path with one variable segment (`/join/<token>`) or an exact path with query keys (`/join?token=…`); unknown or invalid keys are dropped. `app.config.ts`, `+native-intent.tsx`, the auth guards, and the test all read it. No second list of paths.
- Claim narrowly: exact paths, never `/*`. The app keeps working when the web adds pages.
- One `public/.well-known/apple-app-site-association` per web origin, built by `buildAasa`, with both `applinks` and `webcredentials`. It lists the Production and Preview bundle IDs as `<TeamID>.<bundle ID>`, Preview first. Serve it as `application/json` through `public/_headers`; it has no extension and iOS rejects other types.
- Production and Preview builds claim the production host; both use the production backend ([mobile distribution](mobile-distribution.md)). Development and Test builds claim nothing, so a local build never takes over real links.
- `ios.associatedDomains` comes from `iosAssociatedDomains(host, claims)`: `applinks:<host>` and `webcredentials:<host>` when the variant claims links, and no key at all otherwise (an empty list still adds the entitlement). Set `ios.appleTeamId` beside it.
- `+native-intent.tsx` routes through `systemPath`: a claimed link opens its route, any other web link or malformed claimed link opens home, other scheme links (sign-in callbacks) pass through. An app with its own rewrites (a share extension) runs them first and then `systemPath`.
- A link opened while signed out opens its screen after sign-in, through [`pending-link.ts`](app-links/examples/pending-link.ts). It is held in memory only.
- The target screen validates its parameter again and handles an expired or unknown one with a message and a way home; it never assumes the link was valid.
- Link and domain changes are native config: they need a new build, and an OTA update cannot ship them. Merge them with the build planned, per [releases](releases.md).
- **Default:** iOS only. Android app links (`assetlinks.json`, `intentFilters` with `autoVerify`) wait until a project ships Android builds; park them in a sub-issue.

## Implementation

1. Copy [`app-links.ts`](app-links/examples/app-links.ts) and [`pending-link.ts`](app-links/examples/pending-link.ts) to `apps/mobile/src/lib/`. Define the app's links there and export the result as `appLinks`.
2. In `app.config.ts`:

   ```ts
   const claims = variant === "production" || variant === "preview";
   ios: {
     ...config.ios,
     bundleIdentifier: id,
     appleTeamId: APPLE_TEAM_ID,
     ...iosAssociatedDomains(APP_LINK_HOST, claims),
   },
   ```

3. `app/+native-intent.tsx`:

   ```ts
   export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
     return appLinks.systemPath(path);
   }
   ```

4. Wire the guards as the header of `pending-link.ts` describes.
5. Write the AASA file from `buildAasa(APP_IDS, LINKS)` and add to `public/_headers`:

   ```
   /.well-known/apple-app-site-association
     Content-Type: application/json
   ```

6. Copy [`app-links.example-test.ts`](app-links/examples/app-links.example-test.ts) to `scripts/app-links.test.ts`, import the app's values, and add the app's own valid and malformed links.
7. Before the first build that claims links, the owner runs `eas credentials -p ios` interactively (signed in to Apple) for each claiming profile, so EAS adds the Associated Domains capability to the App ID and regenerates the profile. A non-interactive build reuses the old profile and fails at signing with "doesn't include the Associated Domains capability". An agent hands the owner the exact command instead of exporting an App Store Connect key.
8. Build Preview (`preview-internal`) and install it.

## Verify

- The link test passes in CI.
- `curl -sI https://<host>/.well-known/apple-app-site-association` returns `200` and `content-type: application/json`, on production and staging.
- On a device with the Preview build: a claimed link tapped in Notes or Messages opens the app on its screen (pasting into Safari's address bar never opens an app). Signed out, the same link opens that screen after sign-in. A long press shows "Open in <App>".
- Without the app, the link opens the web page and the action can be completed there.
- With the login fields set up per [auth](auth.md), the sign-in screen's keyboard bar offers the website's saved login.
- iOS caches the AASA through Apple's CDN for up to a day. When a new file does not take effect, check `https://app-site-association.cdn-apple.com/a/v1/<host>` before debugging the app.

## Migration

From 1.0: re-copy `app-links.ts`. `associatedDomains(host, claims)` is now `iosAssociatedDomains(host, claims)`, spread into `ios` (`...iosAssociatedDomains(host, claims)`), so Development and Test builds get no empty entitlement. Links with an uppercase scheme or host now open their route.

From 2.1: the test example is now `app-links.example-test.ts`, so test runners skip the toolkit copy. The next sync removes `docs/standards/app-links/examples/app-links.test.ts`; until then, exclude `docs/standards/**` from the test runner.
