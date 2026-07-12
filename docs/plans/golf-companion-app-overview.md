# Golf Companion App — Overview

## 1. Feature List

### Tier 1 — MVP (the core loop: play a round, track it)

**Course & round setup**
- Course search (by name, location, "near me") with course details: holes, par, tee boxes, slope/course rating per tee
- Round setup: pick course → tee → playing partners → game format (stroke play, Stableford, match play)
- Digital scorecard: per-hole score entry, putts, fairways hit, GIR, penalties — optimized for one-thumb entry on the tee box

**GPS / rangefinder**
- Distance to front / center / back of green from your phone's GPS position
- Hole map view (satellite imagery) with distances to hazards, doglegs, layup points
- Auto-advance to next hole based on location

**Scoring & stats**
- Live Stableford points / net score computed from handicap and stroke index
- Round summary: score vs. par, putts per round, FIR/GIR %, scrambling
- Round history with trends over time

**Handicap**
- Manual handicap entry + course handicap calculation (WHS formula: `HI × slope/113 + (CR − par)` — this is public math, no API needed)
- Score differentials per round so users can see their "would-be" handicap trend

### Tier 2 — Differentiators

- **Shot tracking**: tap-to-mark shot positions → club distances ("your average 7-iron is 148m"), strokes-gained-style analysis
- **Club bag management**: user's clubs + learned dispersion/distance per club → smart club suggestions from GPS distance
- **Social**: friends, live leaderboards during a round (one person scores for the flight), sharing round cards
- **Games & side bets**: skins, Nassau, wolf, matchplay presets with automatic settlement
- **Weather integration**: wind speed/direction on the hole map (wind matters more than anything in club selection), rain radar, "playable hours" forecast
- **Milestones/achievements**: first birdie, personal bests, eclectic scorecard per course
- **Official handicap sync** (region-dependent — see data sources below)

### Tier 3 — Advanced / later

- **Watch app** (Apple Watch / Wear OS) — huge for GPS distances without pulling out the phone; arguably Tier 2 if you go native mobile
- Tee-time booking (via marketplace/POS APIs — commercially gated)
- AI caddie: strategy suggestions per hole from your dispersion data ("aim left of the bunker, your miss is right")
- 3D hole flyovers, plays-like distance (elevation + wind + temperature adjusted)
- Practice mode: range sessions, putting drills
- Pro tour data: follow PGA/DPWT leaderboards in-app

## 2. Where to Get the Data

### Course data (scorecards, tees, ratings) — your most important sourcing decision

| Source | Coverage | Cost | Notes |
|---|---|---|---|
| [GolfAPI.io](https://www.golfapi.io/) | 42,000+ courses, 100+ countries | Paid (REST or full CSV export) | Scorecards, pars, stroke indexes, tee distances, slope/course ratings, green coordinates. Best all-in-one commercial option with good EU coverage. |
| [OpenGolfAPI](https://opengolfapi.org/) | 16,800+ US courses, 265k+ holes mapped | Free (REST + MCP) | Open platform: scorecards, tees, weather, game formats, portable golfer ID. US-focused — check NL coverage before relying on it. |
| [GolfCourseAPI](https://golfcourseapi.com/) | ~30,000 courses worldwide | Free | Community-maintained; data quality varies, good for prototyping. |
| [Golf Intelligence](https://golfintelligence.com/golf-course-database/) | Commercial | [Paid tiers](https://golfintelligence.com/api-pricing/) | Full course detail + GPS markers + green slope rendering in a single call — strongest if you want green contours. |

**Advice:** prototype on a free source (GolfCourseAPI / OpenGolfAPI), design your schema so courses are an internal entity with an `externalRef`, and budget for GolfAPI.io or Golf Intelligence once you need reliable Dutch/European scorecard data. Also plan a **user-contributed course editor** as fallback — every serious golf app has one because no database is complete.

### Course geometry / hole maps (polygons for fairways, greens, bunkers)

- **OpenStreetMap** is the best free source of actual course geometry. There's a mature tagging scheme: [`leisure=golf_course`](https://wiki.openstreetmap.org/wiki/Tag:leisure=golf_course) for the facility, plus `golf=fairway` ([wiki](https://wiki.openstreetmap.org/wiki/Tag:golf%3Dfairway)), `golf=green`, `golf=tee`, `golf=bunker`, `golf=water_hazard`, and `golf=hole` (a way from tee to green with `par` and `handicap` tags). Query it with the **Overpass API**, or browse coverage with community tools like [FairwayMapper](https://community.openstreetmap.org/t/fairwaymapper-introducing-golfers-to-mapping/142814). Dutch OSM coverage is generally excellent.
- **Satellite imagery basemap**: Mapbox (satellite tiles + vector overlays, generous free tier), MapTiler, or Esri World Imagery. Google Maps tiles are an option but the licensing is restrictive for overlay-heavy apps.
- Distance-to-green math is then just haversine between the phone GPS fix and the green polygon's front/center/back points — you compute this yourself, no API needed.
- **Elevation** (for "plays-like" distances): Mapbox Terrain-RGB tiles or the free Open-Elevation/OpenTopoData APIs.

### Handicap systems (region matters — you're in NL)

- **Netherlands**: official handicaps live in the **NGF's central database**, surfaced through [caddie.ngf.nl](https://www.ngf.nl/uitleg-caddie) and the [GOLF.NL app](https://www.golf.nl/app). There **is** an API service layer ([built by iO for the NGF](https://www.iodigital.com/en/cases/ngf)) that the NGF's ~15 [certified software suppliers](https://www.ngf.nl/over-de-ngf/nieuws/2020/feb/certificering-softwareleveranciers) integrate with — but it's gated behind NGF certification, not open. Realistic path: manual handicap entry in v1, contact the NGF about supplier certification if the app gets traction.
- **US**: USGA's [Golfer Product Access (GPA) program](https://www.usga.org/content/usga/home-page/handicapping/world-handicap-system/GPA-Program-Overview.html) gives approved vendors GHIN API access (read Handicap Index, post scores). Approval process, not open access.
- **Global**: the [WHS Interoperability Standard](https://www.whs.com/content/dam/whs/documents/World%20Handicap%20System%20Interoperability%20Standard%20v1.0_.pdf) defines the data model — worth reading so your schema matches it (score differentials, ESR, PCC) even before you're certified anywhere.

### Tee times (optional, commercially gated)

- [Lightspeed Golf Partner API](https://partner-api.docs.chronogolf.com/) (formerly Chronogolf — widely used in Europe/NL): approved partners can read tee sheets and book/modify/pay programmatically. Requires a partnership agreement.
- GolfNow/Supreme Golf marketplaces have affiliate/partner programs, US-centric.
- Realistic v1: deep-link to the course's own booking page instead of integrating.

### Weather

- **Open-Meteo** — free, no key, includes wind at multiple heights; ideal for MVP.
- **KNMI open data / Buienradar API** — Dutch rain radar ("kan ik nog 9 holes spelen?") is a genuinely loved feature locally.
- OpenWeatherMap / Tomorrow.io if you want paid global consistency.

### Pro tour data (only if you add a "follow the tour" section)

- [DataGolf API](https://datagolf.com/api-access) — rankings, predictions, live stats (paid scratch-plus tier). Sportradar/SportsDataIO for full live scoring (expensive).

## 3. Architecture sketch

- **The caveat: GPS on the course needs a phone in a pocket, offline-tolerance, and battery-friendly location tracking.** A pure web app works for scoring and stats, but a PWA with the Geolocation API is the minimum for rangefinder features, and native (Expo/React Native, or Capacitor wrapping a web app) is the ceiling — especially for a watch app. Recommendation: start as a PWA, keep scoring/handicap/geo math in framework-free pure-function modules (fully unit-testable), and revisit Capacitor when GPS UX demands it.
- **Data model core**: `courses` → `tees` → `holes` (par, SI, distances, green coords) as a cached/imported layer with an `externalRef` + source field; `rounds` → `holeScores` (+ optional `shots`) as user data; handicap history derived from score differentials.
- **Offline is non-negotiable for scoring**: courses have dead zones. Cache the active round + course data locally (IndexedDB) and sync mutations when back online — design for it from day one.

## 4. Suggested build order

1. Course search + manual course entry, round setup, digital scorecard, Stableford/net scoring (pure logic, fully testable)
2. Stats + round history
3. GPS distances with OSM geometry + Mapbox satellite (the "wow" feature)
4. Weather + wind on the hole map
5. Shot tracking → club distances
6. Social/live flight scoring
7. Handicap sync / tee times (partnership-gated, last)

---

## Sources

- [GolfAPI.io](https://www.golfapi.io/)
- [OpenGolfAPI](https://opengolfapi.org/)
- [GolfCourseAPI](https://golfcourseapi.com/)
- [Golf Intelligence](https://golfintelligence.com/golf-course-database/)
- [OSM golf tagging](https://wiki.openstreetmap.org/wiki/Tag:leisure=golf_course)
- [USGA GPA Program](https://www.usga.org/content/usga/home-page/handicapping/world-handicap-system/GPA-Program-Overview.html)
- [WHS Interoperability Standard](https://www.whs.com/content/dam/whs/documents/World%20Handicap%20System%20Interoperability%20Standard%20v1.0_.pdf)
- [NGF Caddie](https://www.ngf.nl/uitleg-caddie)
- [NGF API platform case study](https://www.iodigital.com/en/cases/ngf)
- [GOLF.NL app](https://www.golf.nl/app)
- [Lightspeed Golf Partner API](https://partner-api.docs.chronogolf.com/)
- [DataGolf API](https://datagolf.com/api-access)
