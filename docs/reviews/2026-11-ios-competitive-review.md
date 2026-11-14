---
type: review
description: End-to-end review of the Fairway iOS app (November 2026) against 18Birdies, Golfshot, Hole19, Arccos and GolfLogix, with a recommended one-PR build scope.
issue: APP-139
---

# Fairway iOS: competitive review (2026-11-14)

## Summary

Fairway already does the core on-course job well. It has fast front/centre/back
numbers on satellite imagery, a hazard list that updates as you move, drag-to-measure
with a loupe, shot marking with a club tray, a next-tee offer, a clean score sheet,
WHS differentials and a share card. Its biggest gaps against the five competitors:

1. **Holes get skipped silently.** The next-tee offer moves on from a hole you
   have not scored.
2. **Club advice breaks with a sparse bag.** With one club in the bag, the tee
   target on a 361 m par 4 is "145 · 7 iron".
3. **The course picker puts your home course first** (75 km away), above the
   course you are standing on (180 m away).
4. **Saving a score waits for two server round trips in a row.** That is about
   0.6–0.8 s on a fast link, much longer on a weak course signal, and the sheet
   never closes offline.
5. **Missing features:** offline course data, "plays like" distances, match
   play/skins and strokes gained. Every competitor has at least some of these.

The [recommended build scope](#recommended-build-scope-one-pr) covers items 1–4,
plus quick scoring wins and a polish bundle. All of it fits in one PR with a low
or medium blast radius, no schema migration and no new native module.

## Setup and scope

| | |
| --- | --- |
| Revision | `docs/app-139-ios-competitive-review` @ `4471abb` (main) |
| Target | Fairway Dev (`com.appelent.fairway.dev`), Debug dev client built locally with `xcodebuild` (ad hoc signing), iPhone 18 Pro simulator, iOS 27.0 |
| JS | Metro (`expo start --dev-client --port 8095`) on the same Mac |
| Backend | Convex dev deployment + Clerk test instance (from `apps/mobile/.env.local`) |
| Account | Dev test account (`EXPO_PUBLIC_TEST_USER_*`, prefilled on the sign-in screen). It holds one finished 9-hole round and one stale active real round (Welderen, 0 of 18 played). |
| Mode | Autonomous review (`review-app` skill). The simulated round was played in simulation mode. The real active round was only viewed, never written to. |
| Language / theme | Dutch + light (simulator locale), then English + dark. Restored to Dutch + Auto afterwards. |
| Location | Simulator location set to De Oosterhoutse (51.6168, 4.8700) for the course picker and real-round play. |

Not covered, and why:

- **Live Activity / lock screen.** It needs "GPS while locked", Always location
  permission and a locked device. Only the source was reviewed
  (`src/features/live/hole/`).
- **Offline.** Simulator airplane mode only fakes the status bar. Offline
  behaviour is from source review.
- **Release-build speed.** All timings are from a Debug build on Metro, so
  production will be faster.
- **Not exercised:** two-player scoring, account deletion and "Report a problem".
  The last two are destructive or send data out.
- **verify-email** was opened by deep link only, because reaching it normally
  creates a Clerk user.
- **Dev-build artefact (not a product bug).** The Expo dev-menu "Tools" button
  sits over the right header button (Share, Scorecard) until it is turned off
  in the dev menu.

## Coverage

Every screen route in `apps/mobile/app` was opened on the simulator. Layout
files are not routes.

| Route | Opened | Screenshot |
| --- | --- | --- |
| `(auth)/sign-in` | yes (nl light, en dark) | `01-sign-in-nl.png`, `03-sign-in-en-dark.png` |
| `(auth)/sign-in-code` | yes | `04-sign-in-code-en-dark.png` |
| `(auth)/sign-up` | yes | `05-sign-up-en-dark.png` |
| `(auth)/verify-email` | yes (deep link) | `06-verify-email-en-dark.png` |
| `(home)/index` | yes | `02-home-nl.png`, `81-Home-en-dark.png` |
| `(home)/courses` | yes (deep link, with location) | `14-courses-en-dark.png` |
| `(home)/setup/[courseId]` | yes (simulated + real) | `12-setup-nl.png`, `13-setup-format-nl.png`, `15-setup-real-en-dark.png` |
| `profile/index` | yes | `10-profile-nl.png`, `80-profile-en-dark.png`, `82-profile-account-en-dark.png` |
| `profile/handicap` | yes | `70-handicap-nl.png` |
| `profile/home-course` | yes | `71-home-course-nl.png` |
| `profile/clubs` | yes | `72-clubs-nl.png` |
| `profile/club` | yes | `73-club-editor-nl.png` |
| `profile/simulator` | yes | `11-simulator-nl.png` |
| `rounds/index` | yes | `50-rounds-nl.png` |
| `rounds/[roundId]` | yes, + share sheet | `51-round-detail-nl.png`, `52-share-sheet-nl.png` |
| `stats/index` | yes | `60-stats-nl.png`, `61-stats-bottom-nl.png`, `81-Stats-en-dark.png` |
| `play` | yes (simulated + real off-course) | `20`–`23`, `26`–`28` |
| `score` | yes | `30-score-sheet-nl.jpg` |
| `scorecard` | yes (simulated + real) | `40-scorecard-nl.png`, `41-finish-confirm-nl.png`, `43-scorecard-real-en-dark.png` |
| `suggest/[courseId]` | yes | `16-suggest-en-dark.png` |

**Round flow, simulation mode.** Each step is listed with what it showed:

1. Profile → Course simulator → De Oosterhoutse → setup (18 holes, yellow
   tee, Stableford) → Start simulation.
2. Play hole 1: F/C/B 348/359/371 m, five hazards with reach/carry, default
   target "145 · 7 iron".
3. Hit → club tray → 7 iron → the shot is drawn and the numbers update to
   203/214/226.
4. Green view, then stand on the green.
5. Score sheet: putts, GIR, then save. It auto-advanced to hole 2.
6. Next tee → offer "Op de tee van hole 3" → Naar hole 3. Hole 2 was left
   unscored.
7. Holes 3–18 scored at par.
8. The scorecard opened after hole 18. Finish round → confirm → Home. The
   simulated round was deleted, as designed.
9. Round detail and share card used the account's real finished round, because
   a finished simulated round is not kept. Then Stats.

**Profile.** Clubs, club editor, handicap, home course, units, light/dark/Auto,
English/Dutch. All work. Dark mode and both languages render with no
untranslated strings (see I-15 for the Apple button).

## Speed

Timings come from polling the accessibility tree with `agent-device` until the
target element appeared. Each probe costs about 0.3 s, so the real figures are
about 0.3 s lower. Debug build on Metro.

| Measure | Result |
| --- | --- |
| Cold start → Home ready (signed in; relaunch until "Recent rounds" shows) | 7.4 s, 9.7 s, 10.1 s (includes the tool's relaunch overhead and Debug JS; release not measured) |
| Course row → setup screen | 0.9 s |
| Start simulation → play screen with numbers | 1.3 s |
| Home "Resume" → play screen | 1.0 s |
| "Score hole N" → score sheet | 0.8 s |
| **Save score → next hole shown** (n = 16 saves across holes 1–17) | 0.84–1.12 s, median ≈ 1.08 s, about 0.6–0.8 s without probe overhead |
| Scorecard open | 0.8 s |
| Round detail open | 1.3 s |

**Jank.** Screenshots showed no visible stutter, and map pans, sheet
presentation and tab switches looked smooth. FPS was not measured, because the
perf monitor was not used in this run.

**The main speed issue is score save (S-1).** It is the action golfers repeat 18
times a round, and on a course with one bar of signal it is the slowest step.
Competitors save locally and feel instant.

## Findings

Severity: blocker, major, minor. Category: bug, UX, speed, gap, a11y.
Screenshots live in `docs/reviews/2026-11-ios-competitive-review/`. "Source-only"
means the defect was confirmed in code, not reproduced on the simulator.

No blockers were found.

### Major

**M-1 · UX · The next-tee offer skips an unscored hole**
- Route/file: `play` · `src/features/play/round/play-screen.tsx` (PlayNextTeeOffer `onGo={() => goTo(holeIndex + 1)}`), `use-next-tee-offer.ts`.
- Repro: start a simulated round and play hole 1. On hole 2, do not score, tap
  "Volgende tee", then "Naar hole 3".
- Observed: hole 3 opens. Hole 2 stays blank on the scorecard. In simulation the
  finish dialog does not mention it (real rounds do warn, see I-12).
- Expected: when the current hole has no score, the offer asks you to score it
  ("Score hole 2", which opens the score sheet and advances on save). Competitors
  prompt for the score at the end of each hole.
- Screens: `26-play-next-tee-offer-nl.jpg`, `27-play-hole3-after-offer-nl.jpg`, `40-scorecard-nl.png`.
- Confidence: high (reproduced). Fix: small (`play-screen`, offer copy, i18n).

**M-2 · UX · A sparse bag drives the default target and club advice**
- Route/file: `play` · `play-screen.tsx` (`clubs && clubs.length > 0 ? clubs : DEFAULT_BAG`), `packages/core/src/club-suggest.ts`, `profile/clubs`.
- Repro: have one club (7 iron, 145 m) in "Mijn tas", then start any round.
- Observed: the tee target on a 361 m par 4 is "145 · Ijzer 7", and so is every
  following target. One club entered means the default bag is dropped entirely.
- Expected: distances outside the user's clubs fall back to the starter bag,
  so a par 4 tee shot suggests a driver. Alternatively, the bag screen offers
  "Start with a standard bag".
- Screens: `20-play-tee-nl.jpg`, `72-clubs-nl.png`.
- Confidence: high.

**M-3 · UX · The course picker ranks the home course above the course you are standing on**
- Route/file: `(home)/courses` · `src/features/courses/picker/course-picker-model.ts` L28–30 (the home course is always moved to index 0).
- Repro: set home course = Welderen, stand at De Oosterhoutse (location
  granted), open Choose course.
- Observed: "Nearby" lists Welderen at 75 km first, then De Oosterhoutse at 180 m.
- Expected: a course within about 2 km comes first. Pin the home course only when
  nothing is that close. Competitors auto-detect the course you are on.
- Screen: `14-courses-en-dark.png`.
- Confidence: high (behaviour is by design in the model; the test file expects it).

**S-1 · Speed · Score save waits for two sequential server round trips before the sheet closes**
- Route/file: `score` · `src/features/rounds/scoring/score-sheet-screen.tsx` L77–106 (`Promise.all(setScore…)` then `await setCurrentHole`).
- Observed: about 0.6–0.8 s on the simulator's fast connection, measured above.
  The cost grows with latency, and with no socket the sheet stays on "Saving…"
  until reconnect.
- Expected: one round trip. A single `saveHole` mutation writes all players'
  scores and advances in one transaction. Optionally use a Convex optimistic
  update for the HUD and scorecard.
- Note: the online-first decision (server authoritative, honest pending state)
  still holds. A single mutation halves the wait without changing that.
- Confidence: high (code), measured.

**G-1 · Gap · No offline reads: cold start without signal shows "Loading…"**
- Route/file: `src/convex/query-cache.tsx` (in-memory `convex-helpers` cache), `play-screen.tsx` loading branch.
- Observed (source-only): queries are cached in memory only. A cold start with
  no connection never resolves `api.rounds.active` or `api.courses.get`, so play
  shows "Loading…". Writes made while disconnected wait for the reconnect, and
  `OfflineBanner` says so.
- Expected: all five competitors play offline from downloaded course data. The
  project's offline decision allows a disposable cache of last-known reads,
  such as the active round and course geometry (`expo-sqlite/kv-store` is
  already linked).
- Blast radius: medium. It is a next PR, not in the scope below. See
  [After this PR](#after-this-pr).

### Minor

**I-1 · UX · The simulation hole view hides the green under the top HUD.**
`play` · `hole-camera.ts` / `play-hole-view.tsx`. On hole 1 in simulation, the
green, the target-to-green label and the top hazard label sit under the top bar
and the simulation banner. The bottom inset adds the simulation panel height,
but the top inset does not add the banner. The real round frames correctly
(`28-play-real-far-en.jpg`). Screens: `20-play-tee-nl.jpg`,
`22-play-after-shot-nl.jpg`.

**I-2 · Bug · "Totaal" wraps mid-word in the Dutch scorecard grid.**
`rounds/[roundId]` · `src/features/rounds/components/scorecard-grid.tsx` L198
(`sumCell: { width: CELL + 10 }`). The header shows "Totaa / l". Screen:
`51-round-detail-nl.png`.

**I-3 · UX · Stats are silently limited to the last 20 rounds.**
`stats/index` · `convex/rounds.ts` `finishedRounds(limit = WHS_WINDOW)`. The
stats screen calls `history({})` and `holeResults({})`, but the section header
only says "Averages". The Rounds list also stops at 200 without saying so. Fix:
label the window ("Last 20 rounds") or add a selector.

**I-4 · a11y · Round detail stat tiles are not grouped.** `rounds/[roundId]` ·
`round-detail-screen.tsx`. VoiceOver reads "Score, To par, Net, 39, +4, 28 −7",
labels first and values after. Finished-round scorecard cells announce "Edit
hole 10" while disabled.

**I-5 · a11y · The play screen is noisy for VoiceOver.** About 35 "Map pin"
nodes are exposed (`hole-satellite-overlays.tsx` markers are not hidden from
accessibility). Hazard rows end in a stray ", m": `hazardRow` puts `{units}` in
its own clause (`i18n/messages/play.ts` L23/L77).

**I-6 · Bug · verify-email without a pending sign-up shows "We sent a 6-digit
code to ."** (the email is empty) instead of returning to sign-up. Deep-link
only. Screen: `06-verify-email-en-dark.png`.

**I-7 · UX · The setup tee list pushes format and players below the fold.**
`setup/[courseId]`. Seven or more tees fill the screen. The default tee is the
first in the data, not the last one used. The white tee's dot is invisible on
the light card. Tees show CR and slope but no length. Screens:
`12-setup-nl.png`, `13-setup-format-nl.png`.

**I-8 · UX · A stale active round hides "Start round" on Home.** The only way
out is Resume → Scorecard → Stop round. Home could offer "Start a new round"
that asks to resume or stop the old one. Screen: `02-home-nl.png` ("0 of 18
played").

**I-9 · UX · The shared image is named by UUID** (`F1FC72B8-….png`).
`round-share.ts`. Screen: `52-share-sheet-nl.png`.

**I-10 · UX · The score sheet ignores data it already has.** Strokes default to
par even after marked shots. GIR is never inferred from strokes and putts
(GIR ⇔ strokes − putts ≤ par − 2). There is no sand-save or bunker field.
`score-model.ts` `initialDrafts`, `player-score-form.tsx`.

**I-11 · UX · Tee distances ignore the dog-leg.** From the tee of a 457 m par 5
the centre reads 413 m (straight line), with no "along the hole" figure.
Source/observation: `28-play-real-far-en.jpg`. Low priority. Confirm on course
before changing.

**I-12 · UX · The simulation finish dialog does not warn about missing holes.**
Real rounds do. `scorecard-screen.tsx` L72–77 checks simulation before
`missing`. Screen: `41-finish-confirm-nl.png`.

**I-13 · Bug (deep link only) · The course picker can be opened during an active
round.** "Tee off" is then rejected by the server ("An active round already
exists"). Source-only, low priority.

**I-14 · UX · Ending a simulation gives no summary.** It drops you on Home. A
one-line toast ("Simulation ended, nothing saved") would confirm it.

**I-15 · i18n · The Apple button follows the system language** ("Ga door met
Apple" in an English UI). It is the system `AppleAuthenticationButton`.
Likely won't fix.

### Feature gaps (beyond one PR)

**G-2 · Plays-like (elevation/wind) is missing.** It needs an elevation source
(DEM) and a weather API: a new external dependency and a server key.

**G-3 · Formats are stroke and Stableford only.** Match play, skins and Nassau
are missing. `RoundFormat` in `packages/core/src/round.ts` and `roundFormat` in
`convex/validators.ts` need a new literal, which is an additive validator change
(medium), plus scoring and UI.

**G-4 · No strokes gained, no stats filters (course, period), no scrambling or
sand saves.** Strokes gained needs per-shot lies, which come from shot marking
plus green/fairway polygons, and a baseline table.

**G-5 · No Apple Watch app.** It needs a new native target and a dev-client
rebuild. The Live Activity covers the lock screen today.

**G-6 · No lay-up targets** ("lay up to 100 m") and no pin placement on the green.

### What is already strong

- On-course HUD: F/C/B numbers, hazards with reach/carry that update from your
  position, drag-to-measure with a loupe, and green view with bunkers and water.
- Shot marking with a club tray. The learned bag uses real distances after 3
  marked shots (`LEARNED_MIN_SHOTS`).
- A next-tee offer that never advances by itself, score auto-advance, and a
  scorecard with Stableford points and net.
- Round recap ("Zo ging het": distribution, best and worst hole), WHS
  differential, would-be index with trend, playing handicap per tee.
- Complete Dutch and English, a good dark mode, and fast navigation (under 1.3 s
  everywhere with probe overhead).

## Feature matrix

Legend: ✅ have · ◐ partial · ✗ missing · P = paid tier · ? = not confirmed
in public sources.

Competitor cells come from public listings and reviews as of November 2026, not
hands-on testing. Treat ◐ and ? cells as provisional. Fairway cells are from
this review.

| Capability | Fairway | 18Birdies | Golfshot | Hole19 | Arccos | GolfLogix |
| --- | --- | --- | --- | --- | --- | --- |
| Front/centre/back GPS | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hazard carry & lay-up numbers | ◐ reach/carry per hazard, no lay-up targets | ✅ | ✅ | ✅ (P?) | ✅ | ✅ |
| Tap-to-measure on hole map | ✅ drag target + loupe | ✅ | ✅ | ✅ | ✅ | ✅ |
| Plays like (elevation/wind) | ✗ | ✅ P | ✅ P | ◐ P? | ✅ (wind, temperature, altitude) | ✅ P |
| Fast scoring (putts/FIR/GIR/penalties/sand) | ◐ no sand, no auto-GIR | ✅ | ✅ | ✅ | ✅ (automatic with sensors) | ✅ (incl. Watch) |
| Formats: stroke, Stableford, match, skins | ◐ stroke + Stableford | ✅ (skins, Nassau, match, bets) | ◐? | ◐? | ◐ | ◐? |
| Stats depth (by par, distribution, strokes gained) | ◐ by par + distribution + FIR/GIR/putts; no SG | ✅ (SG P) | ✅ (SG P) | ◐ | ✅ (SG core) | ◐ |
| Club distances from shots | ✅ learned after 3 shots | ✅ | ✅ | ◐ P | ✅ (sensors) | ◐? |
| Live Activity / Watch | ◐ Live Activity, no Watch | ✅ Watch | ✅ Watch | ✅ Watch | ✅ Watch | ✅ Watch |
| Offline play | ✗ (writes wait for reconnect; no cached reads) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Share card | ✅ image + text | ✅ | ✅ | ✅ | ◐? | ◐? |
| Handicap | ✅ WHS differential, would-be index, playing HCP | ✅ | ✅ | ✅ | ✅ | ◐? |

Sources:
- 18Birdies vs Golfshot and pricing: [birvix comparison](https://birvix.pages.dev/compare/versus/18birdies-vs-golfshot) (vendor-written)
- [2026 GPS apps ranked (Unstar)](https://unstar.app/blog/golfshot-18birdies-arccos-swingu-thegrint-hole19-golf-gps-apps-ranked-2026)
- [Golf Pad vs 18Birdies vs TheGrint vs Hole19 shot tracking](https://golfpadgps.com/news/golf-pad-vs-18birdies-vs-the-grint-vs-hole19-shot-tracking)
- Arccos: [Smart Club Distances](https://golfmonthly.com/gear/gear-news/arccos-golf-releases-smart-club-distances-putt-data-tracking-247579), [Apple Watch upgrades](https://mygolfspy.com/news-opinion/arccos-announces-major-upgrades-to-apple-watch-app/)
- GolfLogix: [App Store listing](https://apps.apple.com/app/id322399059), [Apple Watch features (2024)](https://www.firstcallgolf.com/industry-news/release/2024-04-09/new-golflogix-apple-watch-features-make-it-the-most-advanced-golf-gps-watch-on-the-market)
- [Best golf apps 2026 (Golf Magic)](https://www.golfmagic.com/equipment/golf-tech/best-golf-apps)

**How Fairway compares.** It matches the field on GPS, measuring, share card,
handicap and learned club distances. It is behind on offline, plays-like,
formats and stats depth. Its lock-screen Live Activity is something most
competitors do not advertise.

## Recommended build scope (one PR)

These six items fix the defects a golfer meets every round, plus quick
competitive wins. None needs a schema migration, auth change or new native
module. Items 1–3, 5 and 6 are low blast radius. Item 4 changes a Convex
mutation and is medium. Together the PR is **blast radius: med**. Drop item 4
to make it low.

### 1. Finish the hole before moving on (M-1, I-12)

Files: `play-screen.tsx`, `play-next-tee-offer.tsx`, `i18n/messages/play.ts`, `scorecard-screen.tsx`.

- [ ] When the player reaches the next tee and the current hole has no score
  for the owner, the offer reads "Score hole N" (nl: "Score hole N invoeren").
  Tapping it opens the score sheet for hole N, and saving advances to N+1 (the
  existing `advances` path).
- [ ] When the hole is already scored, the offer behaves as today ("Go to hole
  N+1").
- [ ] "Not now" still dismisses the offer for that hole.
- [ ] The simulation finish dialog says how many holes have no score, as real
  rounds do.
- [ ] Unit test in `play-model` (or a new `next-tee-offer` model) for the
  scored/unscored decision. Drive it on the simulator: hole 2 unscored → offer
  → sheet → save → hole 3.

### 2. Sensible club advice with a sparse bag (M-2)

Files: `packages/core/src/club-suggest.ts` (+ test), `play-screen.tsx`, `profile/clubs` screen, i18n.

- [ ] Add a pure `effectiveBag(userClubs, DEFAULT_BAG)` that keeps every user
  club. It adds a default club only for a distance band (±10 m) no user club
  covers, and adds none once the user has 8 or more clubs. Unit-tested.
- [ ] With only "7 iron 145 m" in the bag, the default tee target on a par 4
  of 361 m is "230 · Driver" and the club tray lists the user's 7 iron plus
  the fill-ins.
- [ ] The clubs screen with fewer than 3 clubs shows "Start with a standard
  bag", which adds the DEFAULT_BAG clubs the user lacks. The user can then edit
  or delete them.
- [ ] The learned bag (`learnedBag`) still overrides carries after 3 shots.

### 3. The course you're at comes first (M-3)

Files: `course-picker-model.ts` (+ test), `course-picker-screen.tsx`.

- [ ] With a position fix and a course within 2 km, the nearest course is first
  in "Nearby". The home course keeps its home icon but is not pinned above it.
- [ ] With no course within 2 km, or no fix, the home course is pinned first
  (today's behaviour).
- [ ] Model tests cover both cases. On the simulator at 51.6168, 4.8700, De
  Oosterhoutse (180 m) is listed above Welderen (75 km).

### 4. One round trip per score save (S-1)

Files: `convex/rounds.ts` (new `saveHole` mutation reusing `setScore` and
`setCurrentHole` logic, + `convex/functions.test.ts`), `score-sheet-screen.tsx`.

- [ ] `saveHole({ roundId, holeIndex, scores: [{ playerIndex, …fields }], advanceTo? })`
  writes every player's score and, when `advanceTo` is set, the current hole,
  in one transaction. It uses the same ownership checks and validators as
  `setScore`.
- [ ] The score sheet sends one `saveHole` call. Behaviour stays the same:
  advances on first entry, corrections stay put, the last hole opens the
  scorecard, errors show `saveError`.
- [ ] Measured on the simulator, save → next hole is at least 30 % faster than
  the ~1.08 s median here, with the same probe method.
- [ ] `setScore` and `setCurrentHole` stay for other callers. Convex tests cover
  the multi-player write, advance, and rejecting another user's round.
- [ ] Before any OTA, production Convex must have the new function (runbook
  note in `docs/runbooks/mobile.md`).

### 5. Score sheet smart defaults (I-10, part)

Files: `score-model.ts` (+ test), `player-score-form.tsx`.

- [ ] GIR fills in automatically when strokes and putts are set and the user
  has not touched GIR: hit if strokes − putts ≤ par − 2, else missed. Any
  manual change to GIR sticks.
- [ ] Unit tests for par 3/4/5, an untouched vs edited GIR, and picked-up (NR)
  holes, where GIR stays unset.
- [ ] Sand saves and prefilling strokes from shots are out of scope. Sand needs
  a new score field.

### 6. Polish bundle (I-1, I-2, I-3, I-4, I-5, I-9)

- [ ] `scorecard-grid.tsx`: the sum column fits "Totaal" on one line, checked in
  nl at default text size.
- [ ] Stats "Averages" header shows the window: "Last 20 rounds" / "Laatste 20
  rondes" (from `WHS_WINDOW`).
- [ ] Round detail stat tiles are each one accessible element ("Score, 39").
  Read-only scorecard cells do not announce "Edit".
- [ ] Hazard row labels drop the stray units clause ("Bunker right: 161 m to
  reach, 180 m to carry"). Satellite overlay markers are hidden from
  accessibility.
- [ ] In simulation the hole camera's top inset includes the simulation banner,
  so the green on hole 1 at De Oosterhoutse is visible below the HUD.
- [ ] The shared image is named `Fairway-<course>-<yyyy-mm-dd>.png`.

**Verify the PR** with `pnpm check`, `pnpm typecheck`, `pnpm test`,
`pnpm test:mobile`, then drive one simulated 18-hole round on the iOS simulator
covering items 1–6.

### After this PR

- **Offline reads (G-1), medium, its own PR.** Persist last-known
  `rounds.active` and `courses.get` for the active round in
  `expo-sqlite/kv-store`. Render from it while the socket connects, show the
  existing offline banner, and keep writes server-acknowledged. This is the
  biggest competitive gap after the PR above.
- **Match play and skins (G-3)**, medium (validator literal, scoring, UI).
- **Plays-like (G-2)** and **strokes gained (G-4)**: product decisions first
  (data source, cost).
- **Apple Watch (G-5)** needs a dev-client rebuild and a new target.
