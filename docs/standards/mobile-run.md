---
type: standard
kind: platform
description: Read before running, driving, or screenshotting an app's mobile build on an iOS simulator.
version: 1.0.0
applies_to: [mobile]
---

# Running the mobile app on a simulator

Every app runs its Expo dev client on a simulator the same way: `node scripts/run-mobile.mjs`, synced from developer-home. No app keeps its own simulator driver (Eric, 18 Nov 2026).

## Rules

- **One script, one config.** `scripts/run-mobile.mjs` is synced like the other toolkit scripts; never edit it in an app. Each app only declares `runMobile` in `apps/mobile/package.json`:

  ```json
  "runMobile": { "bundleId": "com.appelent.foundry.dev", "port": 8090 }
  ```

  `bundleId` is the development variant. Ports are fixed per app so checkouts don't collide: Foundry 8090, Fairway 8091, Gather 8092, Arcade Club 8093. Another checkout of the same app sets `RUN_MOBILE_PORT`.
- **Devices come from `sim`.** `up` claims the simulator with `~/.agents/bin/sim claim ios run-<checkout>` (named `agent-<repo>-run-<checkout>`), and `down` returns it with `sim release`, which deletes it. Run `down` before the thread ends. Developer-home's `pnpm simulators prune` deletes any a thread left behind. Never create a simulator by hand.
- **Bash only.** Drive the app with `run-mobile.mjs ad …` (agent-device), `maestro --device "$(node scripts/run-mobile.mjs udid)"`, or `xcrun simctl` with that UDID. Never use the Claude desktop app's iOS Simulator tool or computer use on Simulator: the desktop app asks Eric to approve every new device ([agent permissions](agent-permissions.md#driving-simulators-unattended)).
- **Backend check.** `up` stops when the bundle Metro serves inlines a different `EXPO_PUBLIC_CONVEX_URL` than `apps/mobile/.env.local` (and `.env`). Make no writes until `backend` passes. The check prints only Convex origins: bundles inline the test user's password, so never grep or print a bundle.

## Commands

```bash
R="node scripts/run-mobile.mjs"       # from the repo root
$R up                                  # claim sim, install dev client, Metro, open app
$R up --lang nl                        # Dutch simulator (en is the default)
$R up --clear --env KEY=VALUE          # Metro without cache / with extra env (down first if running)
$R signin                              # press "Sign in" on a pre-filled form, wait for the tab bar
$R signin --email E --password P       # another user (throwaway users for destructive flows)
$R ad snapshot -i                      # accessibility tree with @refs
$R ad press 'label="Settings"' --settle
$R ad wait text "Saved" 20000          # assert; exit 1 on timeout
$R ss .screenshots/APP-123/ios-home-light.png
$R reload | logs 40 | backend | udid | state
$R down                                # close session, stop our Metro, release the simulator
```

## Dev client

`up` installs the newest `.app` whose `CFBundleIdentifier` is `bundleId`, from Xcode DerivedData (`Debug-iphonesimulator`) or `~/Developer/.builds/<repo>/`. Build one with the app's `expo run:ios` / `devbuild:ios` script, or point at a build with `RUN_MOBILE_APP=/path/App.app`. After native or config-plugin changes, rebuild and run `down` so the next `up` installs the new build.

## Gotchas

- agent-device sessions are keyed by cwd; always go through `$R ad`, which runs in the state dir. The pinned `npx agent-device` is used, not T3's host wrapper.
- Refs such as `@e12` go stale after any action; use `label="…"` selectors or the `@eN~sNNN` form from the latest diff.
- `up` takes over the simulator from a stale agent-device session (`DEVICE_IN_USE`).
- New simulators inherit the Mac's language (Dutch); `up` forces English unless `--lang nl`.
- `up` passes `disableOnboarding`, `disableFab` and `disableAutoLaunch` to expo-dev-launcher so the dev menu doesn't cover header buttons.
- Wait with `$R ad wait …` or `simctl bootstatus -b`, not `sleep`, which the harness blocks.
- Many Metros run at once; `up` refuses a port whose Metro belongs to another checkout.
