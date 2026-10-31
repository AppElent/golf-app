# Fairway Mobile — Plan (draft for discussion)

**Date:** 2026-10-31 · **Status:** Approved (decisions in §0)
**Goal:** native iOS (+ Android) app for on-course use, sharing the Convex backend with the
existing web app (which stays the "online / at home" surface). Visual and feature
reference: **Golfshot GPS**. Stack and standards: same as Foundry (`workouts`) and Gather.

## 0. Decisions (2026-10-31)

| Topic | Decision |
|---|---|
| Hole view | Satellite imagery (react-native-maps: Apple Maps iOS, Google Android) rotated tee→green, overlays on top |
| Look | Golfshot look on the course (full-bleed satellite, bold white numbers, yellow target line); controls as iOS 26 Liquid Glass (fallback blur); rest of app native iOS |
| Platforms | iOS + Android, both verified on simulator/emulator |
| Web auth | Migrate web to `@clerk/react` v6 (Core 3), drop `@appelent/auth` |
| Offline | Online-first. Convex is authoritative; a write counts as saved only after server ack. The local store is a disposable convenience cache (last-known active round + course geometry so Play opens instantly); deleting it any time loses nothing. No outbox/sync engine. |
| v1 extras | All: shot marking → club distances, auto hole advance, background location (opt-in), Dutch i18n. Anything blocked on the user becomes a GitHub issue |
| Autonomy | Branch + PRs (no merging), Convex dev pushes, local native builds, `eas init`; no EAS cloud builds / store submissions |
| Identity | Fairway · `com.appelent.fairway` (+ `.dev` / `.preview` variants) |

## 1. Where we start

- Web app is a working Tier‑1 v1: course import (OSM), round setup with loops, scorecard,
  Stableford/stroke, WHS handicap math, procedural SVG hole map with GPS distances,
  aim point + club chip, progress, profile + club bag, localStorage score queue.
- Domain logic is already framework-free in `src/domain/` (scoring, handicap, geo, loops,
  osm, stats, club-suggest, format) with dense Vitest tests — the shared core is mostly
  written, it just needs to move.
- Not yet on the developer-tools toolkit (no `docs/standards/`, no `scripts/`), single
  package, web Clerk is Core 2 (`@clerk/clerk-react` v5) + private `@appelent/auth`.

## 2. Target layout (mirrors Foundry/Gather)

```
/                    TanStack Start web app + convex/ (unchanged location)
apps/mobile/         Expo app (@golf/mobile) — Expo Router, dev client, EAS
packages/core/       @golf/core — zero-dependency TS: domain/ moved from src/domain
docs/standards/      synced from developer-tools (never edited here)
scripts/             sync-devtools, baseline-mobile, check-mobile-structure, env
```

- `pnpm-workspace.yaml`: `packages: [apps/*, packages/*]`, `virtualStoreDirMaxLength: 60`,
  allowBuilds ledger as in Foundry.
- `@golf/core` consumed as `workspace:*` by web, mobile and Convex (Foundry-style export
  conditions + tsup build so Convex's esbuild resolves it).
- Convex API on mobile via `apps/mobile/src/convex/api.ts` relative re-export.
- Root Biome covers mobile (incl. `noReactNativeRawText`, ban direct `convex/react` query
  hooks in screens → `src/convex/query-cache.tsx`, retention flavor).
- Tests: Jest + jest-expo + RNTL in mobile; Vitest stays for web/core.
- CI: root check/typecheck/test + `pnpm --filter @golf/mobile typecheck test`;
  opt-in `mobile-build.yml` (label `build:ios`) with `eas build --local`.

## 3. Mobile stack

Expo SDK (current, selected with `pnpm exec expo install`), Expo Router + NativeTabs,
`@clerk/expo` (Core 3) + `ConvexProviderWithClerk`, `@expo/ui` controls, StyleSheet +
semantic tokens (`src/theme`), Reanimated/Gesture Handler, react-native-svg,
expo-location (+ background/foreground), expo-keep-awake, expo-haptics,
expo-sqlite/kv-store (prefs + score queue), expo-updates (fingerprint runtime),
TanStack Form + Zod, Sentry RN. App variants via `app.config.ts`
(`com.appelent.fairway[.dev|.preview]`).

## 4. Screens (Golfshot-inspired, Fairway-branded)

Tabs (NativeTabs, max 5): **Home · Play · Rounds · Stats · Profile**

1. **Auth** — welcome, email code / password, Sign in with Apple, (Google).
2. **Home** — handicap hero + trend, "Start round" (nearest course by GPS first), last
   round card, resume active round banner.
3. **Course picker** — "Nearby" (GPS-sorted), search, recents; course detail (holes, tees,
   par/SI); request import.
4. **Round setup** — loop → tee → players (guests) → format; playing handicaps shown.
5. **Play (hero, full-screen, dark)** — Golfshot layout:
   - top bar: hole / par / HCP(SI) / length, swipe or chevrons to change hole;
   - hole view filling the screen, oriented tee→green, user dot (GPS);
   - right-side distance stack F / **C** / B (big numbers), hazard carries;
   - drag target/aim point → split distances (you→target, target→green) + club suggestion;
   - tap-to-measure; hole overview vs green view toggle; big-numbers mode;
   - bottom bar: score quick-entry sheet (strokes, putts, FIR/GIR, penalties) for all
     players, running total vs par / Stableford;
   - auto-advance to next hole when GPS enters next tee; screen stays awake;
   - "Mark shot" button (record shot positions → club distances, Tier‑2 lite).
6. **Scorecard** — full card (Out/In), golf notation marks, edit any hole, finish round
   → summary (score, vs par, putts, FIR/GIR, differential).
7. **Rounds** — history list → round detail (card + stats + shot map).
8. **Stats** — would-be handicap trend, scoring averages, putts, FIR/GIR, par-3/4/5
   averages, club distances (from bag + marked shots).
9. **Profile/Settings** — handicap index, units m/yd, home course, club bag editor,
   appearance, "Report a problem", sign out, delete account (App Store requirement).

## 5. Backend changes (Convex, shared with web)

- `shots` table (roundId, holeIndex, position, club?, ts) + club distance aggregation.
- `courses.nearby` query (bounding box on `location`), recents.
- Account deletion mutation/action (store requirement).
- No breaking changes to existing functions; web keeps working throughout.

## 6. Milestones (each ends green: check, typecheck, tests, device verification)

| # | Milestone |
|---|---|
| M0 | Toolkit adoption (sync-devtools → `docs/standards`, CODING_STANDARDS/DESIGN_SYSTEM docs), workspace conversion, `src/domain` → `packages/core`, web + Convex still green |
| M1 | Expo scaffold in `apps/mobile` (baseline-mobile, variants, EAS profiles, dev client), theme tokens, auth flow on simulator, Convex session gate |
| M2 | Home, course picker (nearby/search), round setup → creates a real round |
| M3 | Play screen: hole renderer + GPS distances + aim point + club chip + hole nav |
| M4 | Score entry sheet, scorecard, finish round, offline score queue |
| M5 | Rounds history, round detail, Stats, Profile + club bag, settings |
| M6 | Shot marking → club distances; auto-advance; keep-awake; haptics |
| M7 | Polish: empty/loading/error/offline states, dark/light, Dynamic Type, Sentry, i18n catalog, app icon placeholder, CI mobile jobs, runbooks; v1 tag |

## 7. Out of v1

Apple Watch / Wear OS, automatic shot detection, Live Activities, 3D flyovers, plays-like
(elevation/wind), weather, social/live leaderboards, side games, tee times, NGF sync,
store submission (prepared, not executed).
