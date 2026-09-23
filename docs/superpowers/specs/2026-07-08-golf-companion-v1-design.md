# Golf Companion v1 ("Fairway") — Design Spec

**Date:** 2026-07-08
**Status:** Approved via brainstorming session
**Inputs:** `docs/plans/golf-companion-app-overview.md` (feature/data research), `design/Golf progress and guide app.zip` (Fairway design comp — the binding visual reference)

## 1. Product summary

A personal golf companion: track rounds and stats, and act as a beautiful GPS caddie on the course. Mobile-first web app (installable PWA) on the existing stack: TanStack Start (React 19) + Convex + Clerk + Cloudflare Workers + Tailwind v4.

**Primary user:** Eric — plays in NL under NGF/WHS. Home courses: Golfbaan Landgoed Welderen (Elst, OSM relation `901850`) and De Oosterhoutse Golf Club (Oosterhout NB, OSM relation `4458605`). Both verified richly mapped in OSM (fairways, greens, bunkers, hole lines; Oosterhoutse includes par + stroke-index tags).

## 2. Locked decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Visual direction | **Fairway comp locked as north star** — chosen over dark "Night Caddie", "Clubhouse Editorial" and "Rangefinder Utility" alternatives |
| Scope | **Full Tier-1 including GPS map** (the Play screen is the app's identity) |
| Offline | **Online-first + safety net**: active-round scores buffer locally and flush to Convex; no full offline-first sync engine in v1 |
| Players | **Me + guest partners**: one account; guests are names + handicaps on my scorecard (marker model) |
| Course data | **OSM geometry + free GolfCourseAPI import + in-app manual editor** as fallback; schema keeps `externalRef` for a paid API later |
| Map rendering | **Illustrated vector (procedural SVG) now, satellite-underlay slot for v2** — projection/overlay layer must be layer-agnostic |
| Map polish bar | **"Polished + Golfshot info design"**: mow stripes, tree corridor, shadows, fringe, water ripples, distance arcs, distance ladder, draggable aim point with split distances, club suggestion chip |
| Units / language | **Meters**, English UI (i18n structure-friendly, Dutch later); m/yd toggle in Profile |

## 3. Design system (from the Fairway comp)

- **Canvas cream** `#F3EFE4` (light screens) · **Deep green** `#0F3D2A` (Play screen bg, primary surfaces) · **Live green** `#2E9E63` (active/GPS/positive) · **Mint** `#7FE0A6` (positive accents on dark) · **Action orange** `#E0532F` (CTAs, flags, birdies) · **Ink** `#16241C` · muted `#5E6E64` · card border `#E9E2D2` · sand `#EADFB8` · water `#8FBFD0`
- **Type:** Space Grotesk (numerals, headings, stat values) + Hanken Grotesk (body). Big numbers are the voice of the app (56px handicap hero, 112px big-numbers mode).
- **Shape:** generous radii (16–26px cards), soft colored shadows, pill chips, uppercase letterspaced micro-labels.
- **Scorecard notation:** classic golf marks — filled orange circle = eagle+, orange ring = birdie, plain = par, gray square ring = bogey, filled gray square = double+.
- Dark-on-course (Play) vs light-at-home (everything else) split is intentional; keep it.
- The comp's screens (Home, Play, Scorecard, Progress, Profile) are the layout reference; build them as shown unless a decision above overrides (e.g. meters, ladder/aim-point additions to Play).

## 4. Surfaces (v1)

1. **Home** — greeting, handicap hero (index + trend sparkline + delta), "Start a round" CTA (defaults to most-played course), last-round card (score, vs par, FIR/GIR/putts), club yardages strip.
2. **Round setup** (flow not in comp; design in Fairway language) — course picker (seeded: Welderen, De Oosterhoutse; search/import via GolfCourseAPI; "add manually" path) → **loop selection** (front 9 / back 9 / combinations — both home courses have multiple 9-hole loops) → tee → guest partners (name + handicap index, optional) → format (stroke play / Stableford). Playing handicap per player computed and shown.
3. **Play** (hero) — see §6. Header: hole n° / par / distance, prev/next. Variants: Map / Rings / Big numbers. Distance chips F/C/B. Hazards list with carries. "Enter score for hole N" CTA.
4. **Scorecard** — 9×2 grid, golf-notation marks, tap-to-select hole editor: strokes (all players), putts + FIR/GIR toggles (me only; FIR hidden on par 3), running total, vs par, Stableford points, Out/In split.
5. **Progress** — handicap trend ("would-be" index from score differentials), avg score, putts/round, FIR%, GIR%, club distance list. Time-window: last 20 rounds default.
6. **Profile** — handicap (manual entry, editable), rounds count, best score; settings: units, home course, GPS accuracy display; **club bag management** (add/edit/reorder clubs + carry distances).

**Out of v1** (parked): satellite layer, shot tracking/dispersion learning, multi-account social & live flight leaderboards, side-bet games, weather/wind, watch app, NGF handicap sync (partnership-gated), tee-time booking, Dutch i18n, 3D flyovers.

## 5. Architecture

- **Routes** (TanStack Start file-based): `/` home, `/rounds/new` setup, `/play` (active round), `/card`, `/progress`, `/profile`, `/courses/:id/edit`. Bottom nav = Home / Play / Card / Progress / Profile. Delete scaffold demo routes. PWA manifest + minimal service worker (installability; offline logic lives in the mutation buffer, not SW).
- **Pure domain modules** (`src/domain/`, zero framework imports, dense unit tests):
  - `scoring` — per-hole diff, totals, Stableford points (playing handicap + stroke index), Out/In, NR handling
  - `handicap` — WHS course handicap `HI × slope/113 + (CR − par)`, playing handicap, score differentials, would-be index (best 8 of 20)
  - `geo` — haversine, equirectangular lat/lon→local-meter projection per hole (tee→green axis vertical), green front/center/back from polygon extremes along axis, carry distance to hazard polygon near-edge/far-edge
  - `club-suggest` — nearest club by carry distance from bag
- **Convex functions** — queries/mutations per table group (courses, rounds, scores, settings, clubs) + course import action (Overpass + GolfCourseAPI fetch, normalize, store). Auth via existing Clerk bridge (`ctx.auth.getUserIdentity()`).
- **Mutation buffer** — thin client layer: score writes apply optimistically to UI + localStorage queue, flush to Convex with backoff when online; "syncing" pill when queue non-empty. Active round's course data + geometry loaded at round start and kept locally.
- **GPS** — Geolocation `watchPosition` during active round; recompute distances per fix; auto-advance suggests next hole when position enters its corridor (dismissible).

## 6. Play screen / map pipeline (the hero)

**Import phase** (Convex action, once per course, re-runnable):
Overpass query on the course's OSM relation → collect `golf=*` ways (fairway, green, tee, bunker, water_hazard, rough, hole) + nearby `natural=wood`/`tree` → assign features to holes via hole-line proximity → simplify polygons → store per-hole GeoJSON-ish docs (`holeGeometry`). Loops detected from hole `ref` patterns (e.g. `1–18`, `(1)–(9)`).

**Render phase** (`HoleMap` React component, procedural SVG — no per-hole artwork):
- Project geometry to local meter grid, hole axis vertical, fit-to-viewport.
- Style layer (all from Fairway tokens): rough gradient base → semi-rough band → fairway filled with **mow-stripe pattern** (~10° rotation) + light edge stroke → **tree canopies** (clustered circles, 3 green tones, soft shadows) → water (gradient + edge stroke + ripple arcs) → bunkers (sand fill + darker stroke) → **green with fringe ring** (thick soft outer stroke) + subtle radial gradient → flag with shadow ellipse.
- Info layer: **distance arcs** every 50m from current position (dashed, badge labels) · **distance ladder** overlay top-left (BACK/CENTER/FRONT + carry chips for each hazard; center highlighted `#2E9E63`) · **shot line** you → **aim point** (draggable, orange, halo ring) → green center, with split-distance badges (dark badge below aim, white badge above) · **club chip** (orange pill: suggested club + "Nm to aim") · **tap-to-measure** marker with distance badge · **you-are-here** dot with GPS pulse + accuracy halo when >15m.
- Variants: Rings (100/150/200m circles) and Big numbers (full-bleed overlay, 112px center distance) as in comp.
- The projection + overlay layer takes an abstract "ground layer" — v2 can slide satellite tiles under the same overlays without rework.

## 7. Data model (Convex)

- `courses` — name, city, location {lat,lng}, externalRef {source, id}?, osmRelationId?, importStatus
- `tees` — courseId, name, color?, courseRating, slopeRating (per loop-combination where applicable)
- `holes` — courseId, number, par, strokeIndex, distanceByTee (teeId → meters)
- `holeGeometry` — courseId, holeNumber, projected polygons: fairway[], green, bunkers[], water[], teeBox?, holeLine, trees[]
- `userSettings` — userId, units (m default), homeCourseId?, handicapIndex (manual)
- `clubs` — userId, name, carryMeters, sortOrder
- `rounds` — userId, courseId, teeId, loop config, startedAt, format, status (active/finished), players [{name, handicapIndex?, playingHandicap?}] (index 0 = owner), currentHole; stamped on finish: totals per player, owner's WHS score differential (null if round had NR holes)
- `holeScores` — roundId, holeNumber, playerIndex, strokes?, putts? (owner), fir?/gir? (owner), penalties?, nr?

Aligned with WHS interoperability model (differentials per round). Guests embedded in round (Tier-2 social adds optional `userId` per player, no migration). Drop scaffold `todos`/`products` tables and demo code.

## 8. Error handling & edge cases

- **GPS denied/unavailable:** map fully functional from tee position; tap-to-measure works; quiet re-enable banner. Poor accuracy → halo, never hide the number.
- **Dead zone:** buffered writes + syncing pill; course data already local; GPS distances need no network.
- **OSM gaps:** missing features just don't render; hole with no geometry → clean schematic fallback card (tee-data distances); editor flags "geometry incomplete".
- **Course missing from free API:** manual scorecard entry in editor is a first-class path.
- **Loops:** round setup composes 9-hole loops; scorecard adapts (9 or 18).
- **NR/picked-up hole:** max-strokes for Stableford display, voids the round's differential (WHS).
- **Par-3:** no FIR. **Guest without handicap:** plays off scratch, shown as "—".
- **Conflict policy:** single scorer per round → last-write-wins per (hole, player) is safe.

## 9. Testing & verification

- **Vitest unit tests (dense):** `scoring` (Stableford tables incl. stroke allocation), `handicap` (WHS math vs published examples), `geo` (fixed coordinates on Welderen hole 1, hand-verified), `club-suggest`.
- **Component tests:** `HoleMap` from fixture geometry — assert SVG layer structure and info elements.
- **Flow verification:** exercise round-setup → play → score → finish → stats in the browser preview (project `verify` skill) before completion claims.
- **CI:** existing check/typecheck/test/build workflow; pre-existing scaffold Biome/tsc issues get fixed as part of deleting demo code.

## 10. Build order (implementation plan input)

1. Design system foundation (tokens, fonts, shell, bottom nav) + delete scaffold demos
2. Domain modules with tests (scoring, handicap, geo, club-suggest)
3. Schema + course import (OSM + free API) + course editor; seed Welderen & De Oosterhoutse
4. Round setup flow + scorecard (playable rounds end-to-end, no GPS yet)
5. Play screen: map pipeline + polished rendering + distances/ladder/aim point/club chip + GPS
6. Home + Progress + Profile (stats over stored rounds)
7. Offline safety net (mutation buffer) + PWA install polish
8. On-course field test at Welderen; fix list

Each step ships something visible; visual fidelity to the comp is a review criterion at every step, not a final pass.
