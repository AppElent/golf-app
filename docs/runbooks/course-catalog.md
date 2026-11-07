---
type: runbook
description: Read when adding a course, correcting course data, or handling a user's course suggestion.
version: 1.1.0
---

# Course catalog

Courses are a fixed, reviewed dataset in the repo, not user-editable rows.

| What | Where | Edited by |
| --- | --- | --- |
| Par, stroke index, hole lengths, tees and ratings, sources | `convex/catalog/courses/<key>.json` | Hand, from the club's scorecard and NGF rating table |
| Hole geometry (greens, fairways, bunkers, water, tees, hole lines) | `convex/catalog/geometry/<osmRelationId>.json` | `pnpm courses:geometry` (OpenStreetMap via Overpass) |
| Course list and order | `convex/catalog/index.ts` | Hand |

`courseCatalog:sync` writes the catalog into a deployment. It matches rows by
stable keys (course `catalogKey`, tee name, hole ref), so the ids that rounds
point at survive. The catalog always wins over database edits. A tee or hole
the catalog drops is deleted, or retired (hidden from the course and new
rounds) while a round still uses it, so that round keeps its par and stroke
index. This covers pre-catalog Welderen and Oosterhoutse rows, whose par-3
loop holes `(1)`–`(9)` moved to their own catalog courses.

It runs from `seedPreview` on every PR preview, from `deploy-web.yml` on staging
and production, and by hand with `pnpm courses:sync` (add `--prod` for production). Nothing calls Overpass at deploy time.

## Users

- Catalog courses are read-only and visible to everyone.
- **Make my copy** (`courses.fork`) creates a private, editable copy, owned by
  one user and listed only for them. Deleting it is refused during an active
  round on it; with finished rounds on it, it is retired (hidden) instead.
- **Suggest a correction** (`courses.suggest`) stores a free-text note, with
  the user's copy attached when sent from one, in `courseSuggestions` with
  status `open`.

## Handle a suggestion

1. In the Convex dashboard, open `courseSuggestions` with status `open`. For an
   attached copy, compare its `holes`/`tees` with the catalog course.
2. Check the claim against the club's current scorecard or the NGF rating
   table. Never apply a value you can't source.
3. Edit `convex/catalog/courses/<key>.json`, add the source to `sources`, open
   a PR. The preview syncs it; merging syncs staging, then production.
4. Set the suggestion's status to `applied` or `dismissed`.

## Add a course

1. Find the course's OSM relation id (the `leisure=golf_course` relation).
2. Write `convex/catalog/courses/<key>.json` from the scorecard: a stable
   `key` (never rename it later), every hole with `ref` matching the OSM
   `golf=hole` ref, and every tee with course and slope rating. A separately
   rated layout (a par-3 course) is its own catalog course on the same
   relation.
3. Add the relation to `GEOMETRY` and the course to `CATALOG` in
   `convex/catalog/index.ts`, run `pnpm courses:geometry`, commit both files.

Overpass sheds load with 429/502/504; the script retries with backoff. If it
keeps failing, try again later; the committed geometry keeps working.

## Geometry from OpenStreetMap

`normalizeCourse` (`packages/core/src/osm.ts`) gives each hole the green its
line ends on: either end, within 60 m, one green per hole, closest pairs
first. A line drawn green-to-tee is flipped. A hole whose green polygon was
never mapped but whose line ends on a `golf=pin` node gets a 12 m circle
around the pin. A hole with neither uses its line's end as the green.

Tees, water and bunkers are assigned by where the feature lies along the hole, not by which vertex happens to be closest. Each tee box carries its colours (from `tee=` tags or overrides), and a round starts from the box of its tee's `marker` colour, falling back to the farthest known tee, then to the line's start. The card's length per colour lives on each hole as `lengths`.

## Corrections on top of OpenStreetMap

`scripts/course-data/overrides/<osmRelationId>.json` holds per-hole corrections
that `pnpm courses:geometry` applies after OSM: `holeLine`, `teeBoxes`, `green`,
`water` and `bunkers`. Trace them from PDOK aerial imagery (CC BY 4.0), and state
what you saw and what you inferred in the file. Prefer fixing OSM itself when the
error is OSM's and you intend to contribute there.

```sh
# Draw a hole over the aerial; rings mark where each tee should be per the card.
node scripts/course-data/inspect-hole.mjs <osmRelationId> <ref> out.png [--tees]
# Compare each tee's route to the green with the card, per colour.
node scripts/course-data/check-lengths.mjs
```

`--raw <dir>` on `refresh-geometry.mjs` caches the Overpass answer while iterating.

`convex/catalog/catalog.test.ts` fails when a tee colour's route is further from
the card than max(12 m, 5%), so a wrong tee cannot be merged by accident.

## Try a course without playing it

Profile → Course simulator starts a simulated round: you set where you stand and
play the holes. It is one server row per user, kept out of history, statistics and
handicap, and deleted when finished.
