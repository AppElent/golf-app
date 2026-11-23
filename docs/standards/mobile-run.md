---
type: standard
kind: platform
description: Read before running, driving, or screenshotting an app's mobile build on an iOS simulator.
version: 2.1.0
applies_to: [mobile]
---

# Running the mobile app on a simulator

Every app runs its Expo dev client on a simulator the same way: `node scripts/run-mobile.mjs`, synced from developer-home. No app keeps its own simulator driver (Eric, 18 Nov 2026).

## Rules

- **One script, one config.** `scripts/run-mobile.mjs` is synced like the other toolkit scripts; never edit it in an app. Each app only declares `runMobile` in `apps/mobile/package.json`:

  ```json
  "runMobile": { "bundleId": "com.appelent.foundry.dev", "port": 8090 }
  ```

  `bundleId` is the development variant. Each app has its own base port: Foundry 8090, Fairway 8091, Gather 8092, Arcade Club 8093. When another checkout's Metro holds it, `up` moves to the next free port (up to +20) and later commands reuse it; `RUN_MOBILE_PORT` pins a port.
- **Devices come from `sim`.** `up` claims the simulator with `~/.agents/bin/sim claim ios run-<checkout>` (today named `agent-<checkout folder>-run-<checkout id>`; `up` logs the name), and `down` returns it with `sim release`. Run `down` before the thread ends, also after a failed `up` (it says when a simulator stays claimed). Never create a simulator by hand. Every boot follows [Simulator hygiene](#simulator-hygiene).
- **Bash only.** Drive the app with `run-mobile.mjs ad …` (agent-device), `maestro --device "$(node scripts/run-mobile.mjs udid)"`, or `xcrun simctl` with that UDID. Never use the Claude desktop app's iOS Simulator tool or computer use on Simulator: the desktop app asks Eric to approve every new device ([agent permissions](agent-permissions.md#driving-simulators-unattended)).
- **Backend check.** `up` stops when the bundle Metro serves inlines a different `EXPO_PUBLIC_CONVEX_URL` than `apps/mobile/.env.local` (and `.env`). Make no writes until `backend` passes. The check prints only Convex origins: bundles inline the test user's password, so never grep or print a bundle.

## Simulator hygiene

Eric, 21 Nov 2026: up to 6 T3 threads run in parallel on the Mac Studio (36 GB RAM), and a booted simulator takes about 3–4 GB.

```text
MAX_BOOTED_IOS_SIMULATORS = 4
```

- **Required: boot cap.** At most `MAX_BOOTED_IOS_SIMULATORS` iOS simulators are booted on the Mac at once, counting every thread. To retune the cap, change only that value; the rules below refer to it by name. A thread that needs a simulator when the cap is reached waits or queues; it never boots another.
- **Required: check before booting.** Run `xcrun simctl list devices booted` first. Shut down orphans with `xcrun simctl shutdown <udid>`: a booted agent-owned (`agent-*`, legacy `* run-mobile <hash>`) or pool (`sim-pool-*`) simulator that no running thread holds. Never shut down a stock Xcode device; Eric may have opened it. Then count again against the cap.
- **Required: fixed named pool.** Simulators come from a fixed named pool, `sim-pool-*`, reused across tasks. Never create a per-task or per-checkout simulator, and never delete a pool member. After a run, uninstall the app or erase the simulator as needed, then `xcrun simctl shutdown` it and return it to the pool.
- **Required: shut down when done.** A thread leaves no simulator booted when it ends or settles, also after a failed run.
- **Daily maintainer.** Besides `pnpm simulators prune --yes`, the round shuts down orphan booted simulators as defined above and lists what it shut down and what prune deleted. Prune never deletes the `sim-pool-*` pool or stock devices.
- **Optional, not installed: [simslim](https://github.com/MobAI-App/simslim).** It lowers a simulator's memory by disabling system daemons. Adopting it is Eric's decision; agents do not install it.

Until `sim` moves to the pool (see [Migration](#migration)), `sim claim` and `run-mobile.mjs` still create `agent-*` simulators and `sim release` still deletes them. Meanwhile the boot cap, the check before booting, and shutdown when done still apply; leftover `agent-*` simulators are deleted by `pnpm simulators prune`.

## Commands

```bash
R="node scripts/run-mobile.mjs"       # from the repo root
$R up                                  # claim sim, install dev client, Metro, open app
$R up --lang nl                        # Dutch simulator (en is the default)
$R up --clear --env KEY=VALUE          # Metro without cache / with extra env (down first if running)
$R signin                              # press Sign in / Inloggen (en or nl) on a pre-filled form, wait for the tab bar
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

## Store screenshots

App Store screenshots come from the same dev client, driven by a per-app Maestro flow (APP-62). `scripts/store-screenshots.mjs` is synced like `run-mobile.mjs` (Biome skips it the same way); before an app has it, run developer-home's copy. From the app repo root:

```bash
node scripts/store-screenshots.mjs --issue APP-123 --name <app> [--devices iphone,ipad] [--langs en,nl] [--keep]
```

- **What it does.** Within the [boot cap](#simulator-hygiene) (the two devices take two of its slots; check before booting), claims a 6.9" iPhone (iPhone 17 Pro Max, 1320x2868) and a 13" iPad (iPad Pro 13-inch M5/M4, 2064x2752) with `sim claim ios store-<device> "<device type>"`, starts its own Metro on the app's port (or the next free one), and per device and language sets `AppleLanguages`/`AppleLocale`, reboots, sets light appearance and the 9:41 status bar, reinstalls the dev client, opens it on Metro with the dev-launcher flags, and runs the flow. It checks every PNG for the store size, flattens it to RGB (App Store Connect rejects alpha), paints over iPadOS window chrome (the app name beside the date and the resize grabber), writes contact sheets, stops Metro and releases the simulators (`--keep` keeps them).
- **Output.** `~/Developer/.screenshots/<ISSUE>/<name>/<iphone-6.9|ipad-13>/<en-US|nl-NL>/NN-<screen>.png` and `contact-<device>.png`. Review the contact sheets before uploading.
- **The app's flow.** `apps/mobile/.maestro/store-screenshots.yaml` takes the shots with `takeScreenshot: NN-<screen>` (names sort into store order, 5 to 6 per device). `apps/mobile/.maestro/store-screenshots.json` holds the labels it taps per language (`{"languages": {"en": {"L_BACK": "Back", …}, "nl": {…}}}`), passed as `maestro -e`. The system back button is `Back` / `Vorige`. Use guest-playable, offline screens; wait for each screen's own text before `takeScreenshot` so no push animation is caught. State in the keychain survives a reinstall, so handle "continue saved game" prompts.
- **Screens to avoid.** Third-party names and marks: Hitster in Arcade Club (Music Timeline is fine), Open Food Facts in Foundry, any other brand or partner name. Also test users or emails, dev labels, LogBox error toasts, and screens that write to the backend (in Arcade, dice tables against the computer create a Convex table and fail when the dev deployment lags).
- **Upload.** Separate and explicit: read the sets first (`asc screenshots list --app <ID> --version <v>`), never delete or `--replace` existing screenshots without Eric's go, then `asc screenshots upload --version-localization <ID> --path <folder> --device-type IPHONE_67` (6.9" shots) or `IPAD_PRO_3GEN_129` (13" iPad) and confirm every asset reports `COMPLETE`. Never submit for review. `--replace` deletes the old set before it uploads, so a failed upload leaves the set partial: rerun the same upload with `--skip-existing` (no `--replace`) to fill it in (18 Nov 2026).

## Gotchas

- agent-device sessions are keyed by cwd; always go through `$R ad`, which runs in the state dir. The pinned `npx agent-device` is used, not T3's host wrapper.
- Refs such as `@e12` go stale after any action; use `label="…"` selectors or the `@eN~sNNN` form from the latest diff.
- `up` takes over the simulator from a stale agent-device session (`DEVICE_IN_USE`).
- New simulators inherit the Mac's language (Dutch); `up` forces English unless `--lang nl`. `signin` finds the submit button by the `sign-in-submit` testID, else by its English or Dutch label (`SIGN_IN_LABELS`), so it works in both; add the label there when an app gains a language.
- `up` passes `disableOnboarding`, `disableFab` and `disableAutoLaunch` to expo-dev-launcher so the dev menu doesn't cover header buttons.
- Wait with `$R ad wait …` or `simctl bootstatus -b`, not `sleep`, which the harness blocks.
- Many Metros run at once; `up` never reuses or stops another checkout's Metro.
- In an app, Biome skips `scripts/run-mobile.mjs` and `scripts/store-screenshots.mjs` like the other synced toolkit scripts (`"!scripts/run-mobile.mjs"`, `"!scripts/store-screenshots.mjs"` in `biome.json` `files.includes` where `scripts/**` is included).

## Migration

From 2.0: `signin` works on a Dutch simulator too. Apps only need to sync the script; giving the sign-in submit button `testID="sign-in-submit"` (Foundry, Fairway and Arcade already do) makes it independent of language.

From 1.2: simulator hygiene is new. Agents obey `MAX_BOOTED_IOS_SIMULATORS` (4), check for and shut down orphan booted simulators before booting, and shut theirs down when done. The relied-on "claim creates a per-checkout simulator, release deletes it" is replaced by the fixed `sim-pool-*` pool with shutdown; `sim claim`, `sim release` and `run-mobile.mjs` keep their current behavior until a follow-up points them at the pool. Apps need no change.
