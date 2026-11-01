---
type: runbook
description: Read when adding a course, correcting course data, or handling a user's course suggestion.
version: 1.0.0
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
point at survive. The catalog always wins over database edits. A tee the
catalog drops is deleted, or retired (hidden from new rounds) while a round
still uses it.

It runs from `seedPreview` on every PR preview, from `pnpm deploy:dev` and
`pnpm deploy:prod`, and by hand with `pnpm courses:sync` (add `-- --prod` for
production). Nothing calls Overpass at deploy time.

## Users

- Catalog courses are read-only and visible to everyone.
- **Make my copy** (`courses.fork`) creates a private, editable copy, owned by
  one user and listed only for them.
- **Suggest a correction** (`courses.suggest`) stores a free-text note, with
  the user's copy attached when sent from one, in `courseSuggestions` with
  status `open`.

## Handle a suggestion

1. In the Convex dashboard, open `courseSuggestions` with status `open`. For an
   attached copy, compare its `holes`/`tees` with the catalog course.
2. Check the claim against the club's current scorecard or the NGF rating
   table. Never apply a value you can't source.
3. Edit `convex/catalog/courses/<key>.json`, add the source to `sources`, open
   a PR. The preview syncs it; merging and deploying syncs dev and production.
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
