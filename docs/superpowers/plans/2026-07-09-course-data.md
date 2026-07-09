# Course Data Implementation Plan (Plan 2 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app real course data — a full Convex schema, an OSM (Overpass) import pipeline, a manual course editor, and seeded geometry for Welderen and De Oosterhoutse — so later plans can build round setup, the Play map, and stats on top of it.

**Architecture:** The whole data model (spec §7) is defined up front in one Convex schema file. A **pure, framework-free normalizer** (`src/domain/osm.ts`) turns raw Overpass JSON into normalized holes + per-hole geometry; it is unit-tested against committed real-course fixtures so tests stay offline and deterministic. Convex functions stay thin: queries/mutations for course CRUD, plus an `importFromOsm` action that fetches Overpass, runs the normalizer, and stores the result via an internal mutation. A `seed` action drives that same import path for both home courses. A Fairway-styled editor route lets missing data (par / stroke index / tee ratings) be filled by hand — the spec's first-class fallback.

**Tech Stack:** Convex (schema + queries/mutations/actions, `convex/`), TanStack Start routes (`src/routes/`), Convex React hooks (`convex/react`), Vitest, Tailwind v4 Fairway tokens, Biome (tabs + double quotes), pnpm.

---

## Scope & deviations (read before starting)

- **Geometry is stored as WGS84 `{lat, lng}`, NOT pre-projected.** Spec §6 projects to a local meter grid *in the render phase* (Plan 5) and the map decision requires a layer-agnostic overlay (v2 satellite needs lat/lng). We read §7's word "projected" as render-time. Storage is raw lat/lng arrays.
- **OSM is the only importer in this plan. GolfCourseAPI is deferred.** It needs a keyed endpoint we can't test or hardcode (security rule). OSM supplies geometry plus par/stroke-index where tagged (Oosterhoutse yes, Welderen no). The `externalRef` schema slot stays for a later plan; the manual editor covers the gap now (spec §4 round-setup + §8 "Course missing from free API: manual entry is a first-class path").
- **The full schema (all 8 tables) is defined now** even though rounds/scores/settings/clubs aren't written until Plans 4–6. The schema is one declarative artifact; defining it once avoids churny migrations. Empty tables are free.
- **`rough`, `path`/`cartpath`, `driving_range` OSM features are dropped** during normalization (base-layer/procedural in the render). Stored geometry per hole: `holeLine`, `fairways`, `greens`, `bunkers`, `tees`, `water`. `trees` (from `natural=wood`) is a Plan 5 render nicety, not imported here.
- **Overpass requires a `User-Agent` header** (returns `406 Not Acceptable` without one — verified). Every Overpass request in this plan sends `User-Agent: golf-app/0.1`.

## Verification reality

- **Fully verifiable offline:** schema typecheck, the normalizer + its tests, `pnpm check`, `pnpm typecheck`, `pnpm build`.
- **Convex codegen:** `pnpm exec convex codegen` regenerates `convex/_generated/*` from the local schema + function files (no deployment needed). Run it after adding functions so `internal.*`/`api.*` typecheck.
- **Live import/seed + editor UI are NOT verifiable in this environment.** The import/seed actions need a running Convex deployment (`VITE_CONVEX_URL`/`CONVEX_DEPLOYMENT`); the editor route needs a Clerk publishable key in `.env.local` (absent — same blocker as Plan 1's shell). Code for these is verified by typecheck + the normalizer's real-data tests + review. Running them live is a follow-up for when a Convex dev deployment + Clerk dev key are available. **Do not fabricate keys.** If `convex codegen` itself requires auth in this environment, note it and fall back to committing hand-written `_generated` deltas is NOT allowed — instead report the blocker.

## File structure

| File | Responsibility |
|---|---|
| `convex/schema.ts` | All 8 tables (§7) with indexes. Rewritten from empty. |
| `src/domain/osm.ts` | **Pure** Overpass-JSON → normalized course. Ref/par/SI parsing, feature→hole assignment. No framework imports. |
| `src/domain/osm.test.ts` | Vitest tests: parsing units + full `normalizeCourse` against real fixtures. |
| `src/domain/__fixtures__/welderen.overpass.json` | Real Overpass response, relation 901850 (~160 KB). |
| `src/domain/__fixtures__/oosterhoutse.overpass.json` | Real Overpass response, relation 4458605 (~407 KB). |
| `convex/courses.ts` | Course queries (`list`, `get`), mutations (`create`, `updateMeta`, `upsertTee`, `upsertHole`), import action (`importFromOsm`), internal storage mutation (`storeImport`). |
| `convex/seed.ts` | `seed` action: import both home courses + a default editable tee each. |
| `src/routes/courses.index.tsx` | Fairway list of courses with links to their editors. |
| `src/routes/courses.$courseId.edit.tsx` | Fairway editor: course meta, tee CR/slope, per-hole par + stroke index. |

Types shared across tasks (defined in Task 3, used by 4/7/8):

```ts
// src/domain/osm.ts — the normalizer's public shapes
export interface LatLng { lat: number; lng: number }
export interface NormalizedHole {
	number: number;        // parsed integer from ref; 0 if unparseable
	ref: string;           // raw OSM ref, e.g. "10" or "(3)"
	par: number | null;    // from OSM par tag, else null (fill in editor)
	strokeIndex: number | null; // from golf:stroke_index / handicap, first int
	line: LatLng[];        // the golf=hole way, tee→green
	lengthMeters: number;  // summed haversine along the line
}
export interface HoleGeometry {
	holeNumber: number;
	holeLine: LatLng[];
	fairways: LatLng[][];
	greens: LatLng[][];
	bunkers: LatLng[][];
	tees: LatLng[][];
	water: LatLng[][];
}
export interface NormalizedCourse {
	holes: NormalizedHole[];
	geometry: HoleGeometry[]; // one entry per hole number present in holes
}
```

---

## Task 1: Full Convex schema

**Files:**
- Modify: `convex/schema.ts` (currently `export default defineSchema({})`)

- [ ] **Step 1: Write the schema**

Replace the entire contents of `convex/schema.ts`:

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const latLng = v.object({ lat: v.number(), lng: v.number() });
const polygon = v.array(latLng);

export default defineSchema({
	courses: defineTable({
		name: v.string(),
		city: v.optional(v.string()),
		location: v.optional(latLng),
		osmRelationId: v.optional(v.number()),
		externalRef: v.optional(
			v.object({ source: v.string(), id: v.string() }),
		),
		// "manual" = hand-entered, "imported" = OSM import complete,
		// "partial" = imported but some holes lack par/SI/geometry.
		importStatus: v.union(
			v.literal("manual"),
			v.literal("imported"),
			v.literal("partial"),
		),
	}),

	tees: defineTable({
		courseId: v.id("courses"),
		name: v.string(),
		color: v.optional(v.string()),
		courseRating: v.number(),
		slopeRating: v.number(),
	}).index("by_course", ["courseId"]),

	holes: defineTable({
		courseId: v.id("courses"),
		number: v.number(),
		ref: v.optional(v.string()),
		par: v.optional(v.number()),
		strokeIndex: v.optional(v.number()),
		lengthMeters: v.optional(v.number()),
	}).index("by_course", ["courseId"]),

	holeGeometry: defineTable({
		courseId: v.id("courses"),
		holeNumber: v.number(),
		holeLine: v.optional(polygon),
		fairways: v.array(polygon),
		greens: v.array(polygon),
		bunkers: v.array(polygon),
		tees: v.array(polygon),
		water: v.array(polygon),
	})
		.index("by_course", ["courseId"])
		.index("by_course_hole", ["courseId", "holeNumber"]),

	userSettings: defineTable({
		userId: v.string(),
		units: v.union(v.literal("m"), v.literal("yd")),
		homeCourseId: v.optional(v.id("courses")),
		handicapIndex: v.optional(v.number()),
	}).index("by_user", ["userId"]),

	clubs: defineTable({
		userId: v.string(),
		name: v.string(),
		carryMeters: v.number(),
		sortOrder: v.number(),
	}).index("by_user", ["userId"]),

	rounds: defineTable({
		userId: v.string(),
		courseId: v.id("courses"),
		teeId: v.id("tees"),
		loop: v.optional(v.string()),
		holeNumbers: v.array(v.number()),
		startedAt: v.number(),
		format: v.union(v.literal("stroke"), v.literal("stableford")),
		status: v.union(v.literal("active"), v.literal("finished")),
		players: v.array(
			v.object({
				name: v.string(),
				handicapIndex: v.optional(v.number()),
				playingHandicap: v.optional(v.number()),
			}),
		),
		currentHole: v.optional(v.number()),
		totals: v.optional(
			v.array(
				v.object({
					strokes: v.number(),
					points: v.optional(v.number()),
				}),
			),
		),
		scoreDifferential: v.optional(v.union(v.number(), v.null())),
	}).index("by_user", ["userId"]),

	holeScores: defineTable({
		roundId: v.id("rounds"),
		holeNumber: v.number(),
		playerIndex: v.number(),
		strokes: v.optional(v.number()),
		putts: v.optional(v.number()),
		fir: v.optional(v.boolean()),
		gir: v.optional(v.boolean()),
		penalties: v.optional(v.number()),
		nr: v.optional(v.boolean()),
	})
		.index("by_round", ["roundId"])
		.index("by_round_hole_player", ["roundId", "holeNumber", "playerIndex"]),
});
```

- [ ] **Step 2: Regenerate Convex types**

Run: `pnpm exec convex codegen`
Expected: regenerates `convex/_generated/*` with the new tables; exits 0. (If it requires auth/login in this environment, stop and report BLOCKED — do not hand-edit `_generated`.)

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0 (schema is valid; no functions reference it yet).

- [ ] **Step 4: Format + lint the schema**

Run: `pnpm lint:fix` then `pnpm check`
Expected: `pnpm check` exits 0.

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts convex/_generated
git commit -m "feat(convex): full v1 schema (courses, tees, holes, geometry, rounds, scores, settings, clubs)"
```

---

## Task 2: Real-course Overpass fixtures

**Files:**
- Create: `src/domain/__fixtures__/welderen.overpass.json`
- Create: `src/domain/__fixtures__/oosterhoutse.overpass.json`

- [ ] **Step 1: Fetch both fixtures**

Run this Node script (network + the `User-Agent` header are both required; verified working):

```bash
node -e '
const fs = require("fs");
const dir = "src/domain/__fixtures__";
fs.mkdirSync(dir, { recursive: true });
const courses = [
	{ rel: 901850, file: "welderen.overpass.json" },
	{ rel: 4458605, file: "oosterhoutse.overpass.json" },
];
(async () => {
	for (const c of courses) {
		const q = `[out:json][timeout:90];rel(${c.rel});map_to_area->.a;(way(area.a)[golf];);out geom tags;`;
		const res = await fetch("https://overpass-api.de/api/interpreter", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"User-Agent": "golf-app/0.1",
			},
			body: "data=" + encodeURIComponent(q),
		});
		if (!res.ok) throw new Error(`${c.rel}: HTTP ${res.status}`);
		const json = await res.json();
		if (!Array.isArray(json.elements) || json.elements.length < 50) {
			throw new Error(`${c.rel}: too few elements (${json.elements?.length})`);
		}
		fs.writeFileSync(`${dir}/${c.file}`, JSON.stringify(json));
		console.log(c.file, json.elements.length, "elements");
	}
})().catch((e) => { console.error(e); process.exit(1); });
'
```

Expected output (counts may drift slightly as OSM is edited, that's fine):
```
welderen.overpass.json 168 elements
oosterhoutse.overpass.json 275 elements
```

If Overpass is rate-limited/unreachable at execution time: this is the one task that needs network. Retry once after ~30s; if still failing, report BLOCKED (the rest of the plan can't proceed without fixtures).

- [ ] **Step 2: Sanity-check the fixtures exist and parse**

Run: `node -e 'const w=require("./src/domain/__fixtures__/welderen.overpass.json"); const o=require("./src/domain/__fixtures__/oosterhoutse.overpass.json"); console.log("welderen holes", w.elements.filter(e=>e.tags&&e.tags.golf==="hole").length, "| oosterhoutse holes", o.elements.filter(e=>e.tags&&e.tags.golf==="hole").length)'`
Expected: something like `welderen holes 32 | oosterhoutse holes 27` (both ≥ 27).

- [ ] **Step 3: Enable JSON imports for typecheck**

The normalizer test imports fixture `.json`. `tsc` needs `resolveJsonModule`. Edit `tsconfig.json` `compilerOptions`, adding after `"noEmit": true,`:

```json
    "resolveJsonModule": true,
```

- [ ] **Step 4: Commit**

```bash
git add src/domain/__fixtures__ tsconfig.json
git commit -m "test(osm): commit real Overpass fixtures for Welderen + De Oosterhoutse"
```

---

## Task 3: Normalizer — types + tag parsing (TDD)

**Files:**
- Create: `src/domain/osm.ts`
- Test: `src/domain/osm.test.ts`

- [ ] **Step 1: Write failing tests for the parsing helpers**

Create `src/domain/osm.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseHoleRef, parsePar, parseStrokeIndex } from "./osm";

describe("parseHoleRef", () => {
	it("reads a plain number", () => {
		expect(parseHoleRef("10")).toEqual({ number: 10, ref: "10" });
	});
	it("reads a parenthesized loop ref", () => {
		expect(parseHoleRef("(3)")).toEqual({ number: 3, ref: "(3)" });
	});
	it("takes the first integer of a shared ref", () => {
		expect(parseHoleRef("1;10")).toEqual({ number: 1, ref: "1;10" });
	});
	it("returns number 0 when no integer is present", () => {
		expect(parseHoleRef("clubhouse")).toEqual({ number: 0, ref: "clubhouse" });
	});
	it("handles undefined", () => {
		expect(parseHoleRef(undefined)).toEqual({ number: 0, ref: "" });
	});
});

describe("parsePar", () => {
	it("parses a par tag", () => {
		expect(parsePar({ golf: "hole", par: "4" })).toBe(4);
	});
	it("returns null when absent", () => {
		expect(parsePar({ golf: "hole" })).toBeNull();
	});
});

describe("parseStrokeIndex", () => {
	it("reads golf:stroke_index", () => {
		expect(parseStrokeIndex({ "golf:stroke_index": "7" })).toBe(7);
	});
	it("reads handicap and takes the first of a dual value", () => {
		expect(parseStrokeIndex({ handicap: "11;12" })).toBe(11);
	});
	it("prefers golf:stroke_index over handicap", () => {
		expect(parseStrokeIndex({ "golf:stroke_index": "5", handicap: "9" })).toBe(5);
	});
	it("returns null when absent", () => {
		expect(parseStrokeIndex({ golf: "hole" })).toBeNull();
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run src/domain/osm.test.ts`
Expected: FAIL — `parseHoleRef`/`parsePar`/`parseStrokeIndex` are not exported.

- [ ] **Step 3: Implement the helpers**

Create `src/domain/osm.ts`:

```ts
export interface LatLng {
	lat: number;
	lng: number;
}

export interface NormalizedHole {
	number: number;
	ref: string;
	par: number | null;
	strokeIndex: number | null;
	line: LatLng[];
	lengthMeters: number;
}

export interface HoleGeometry {
	holeNumber: number;
	holeLine: LatLng[];
	fairways: LatLng[][];
	greens: LatLng[][];
	bunkers: LatLng[][];
	tees: LatLng[][];
	water: LatLng[][];
}

export interface NormalizedCourse {
	holes: NormalizedHole[];
	geometry: HoleGeometry[];
}

type Tags = Record<string, string>;

const firstInt = (value: string | undefined): number | null => {
	if (!value) return null;
	const match = value.match(/-?\d+/);
	return match ? Number.parseInt(match[0], 10) : null;
};

/** Parse an OSM hole `ref` ("10", "(3)", "1;10") into a number + raw ref. */
export function parseHoleRef(ref: string | undefined): {
	number: number;
	ref: string;
} {
	return { number: firstInt(ref) ?? 0, ref: ref ?? "" };
}

/** OSM `par` tag → integer, or null when the course isn't par-tagged. */
export function parsePar(tags: Tags): number | null {
	return firstInt(tags.par);
}

/** Stroke index from `golf:stroke_index` (preferred) or `handicap`. */
export function parseStrokeIndex(tags: Tags): number | null {
	const si = firstInt(tags["golf:stroke_index"]);
	if (si !== null) return si;
	return firstInt(tags.handicap);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm exec vitest run src/domain/osm.test.ts`
Expected: PASS (all parsing tests green).

- [ ] **Step 5: Commit**

```bash
git add src/domain/osm.ts src/domain/osm.test.ts
git commit -m "feat(osm): tag parsing helpers (hole ref, par, stroke index)"
```

---

## Task 4: Normalizer — feature→hole assignment + `normalizeCourse` (TDD)

**Files:**
- Modify: `src/domain/osm.ts`
- Modify: `src/domain/osm.test.ts`

- [ ] **Step 1: Add failing tests (geometry math + full normalize against fixtures)**

Append to `src/domain/osm.test.ts` (add the new imports to the existing top import line):

```ts
// extend the existing import to:
// import { centroid, lineLengthMeters, normalizeCourse, parseHoleRef, parsePar, parseStrokeIndex } from "./osm";
import welderen from "./__fixtures__/welderen.overpass.json";
import oosterhoutse from "./__fixtures__/oosterhoutse.overpass.json";

describe("lineLengthMeters", () => {
	it("sums haversine over a polyline (~0.001° lat ≈ 111 m per step)", () => {
		const len = lineLengthMeters([
			{ lat: 0, lng: 0 },
			{ lat: 0.001, lng: 0 },
			{ lat: 0.002, lng: 0 },
		]);
		expect(len).toBeCloseTo(222.4, 0);
	});
	it("is 0 for a single point", () => {
		expect(lineLengthMeters([{ lat: 5, lng: 5 }])).toBe(0);
	});
});

describe("centroid", () => {
	it("averages vertices", () => {
		const c = centroid([
			{ lat: 0, lng: 0 },
			{ lat: 2, lng: 0 },
			{ lat: 1, lng: 3 },
		]);
		expect(c.lat).toBeCloseTo(1, 6);
		expect(c.lng).toBeCloseTo(1, 6);
	});
});

describe("normalizeCourse — Welderen (relation 901850)", () => {
	const course = normalizeCourse(welderen.elements);

	it("extracts at least 27 holes", () => {
		expect(course.holes.length).toBeGreaterThanOrEqual(27);
	});
	it("parses hole numbers from refs", () => {
		expect(course.holes.every((h) => h.number >= 1)).toBe(true);
	});
	it("has null par (Welderen is not par-tagged in OSM)", () => {
		expect(course.holes.every((h) => h.par === null)).toBe(true);
	});
	it("produces one geometry entry per hole and assigns greens", () => {
		expect(course.geometry.length).toBe(course.holes.length);
		const totalGreens = course.geometry.reduce(
			(n, g) => n + g.greens.length,
			0,
		);
		expect(totalGreens).toBeGreaterThanOrEqual(18);
	});
});

describe("normalizeCourse — De Oosterhoutse (relation 4458605)", () => {
	const course = normalizeCourse(oosterhoutse.elements);

	it("extracts at least 27 holes", () => {
		expect(course.holes.length).toBeGreaterThanOrEqual(27);
	});
	it("reads par from OSM tags", () => {
		expect(course.holes.some((h) => h.par !== null)).toBe(true);
	});
	it("reads stroke index (first value of dual '11;12')", () => {
		expect(course.holes.some((h) => h.strokeIndex !== null)).toBe(true);
	});
	it("assigns bunkers and fairways to holes", () => {
		const bunkers = course.geometry.reduce((n, g) => n + g.bunkers.length, 0);
		expect(bunkers).toBeGreaterThanOrEqual(20);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run src/domain/osm.test.ts`
Expected: FAIL — `centroid`, `lineLengthMeters`, `normalizeCourse` not exported.

- [ ] **Step 3: Implement geometry helpers + `normalizeCourse`**

Append to `src/domain/osm.ts`:

```ts
interface OverpassGeom {
	lat: number;
	lon: number;
}
interface OverpassElement {
	type: string;
	id: number;
	tags?: Tags;
	geometry?: OverpassGeom[];
}

const EARTH_RADIUS_M = 6371000;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

function haversine(a: LatLng, b: LatLng): number {
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const s =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

export function lineLengthMeters(points: ReadonlyArray<LatLng>): number {
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		total += haversine(points[i - 1], points[i]);
	}
	return total;
}

export function centroid(points: ReadonlyArray<LatLng>): LatLng {
	const n = points.length || 1;
	return {
		lat: points.reduce((t, p) => t + p.lat, 0) / n,
		lng: points.reduce((t, p) => t + p.lng, 0) / n,
	};
}

const toLatLng = (g: OverpassGeom): LatLng => ({ lat: g.lat, lng: g.lon });
const geomOf = (el: OverpassElement): LatLng[] =>
	(el.geometry ?? []).map(toLatLng);

/** Nearest hole number to a feature centroid, by distance to hole-line vertices. */
function nearestHoleNumber(
	point: LatLng,
	holeLines: ReadonlyArray<{ number: number; line: LatLng[] }>,
): number {
	let bestNumber = holeLines[0]?.number ?? 0;
	let bestDist = Number.POSITIVE_INFINITY;
	for (const hole of holeLines) {
		for (const vertex of hole.line) {
			const d = haversine(point, vertex);
			if (d < bestDist) {
				bestDist = d;
				bestNumber = hole.number;
			}
		}
	}
	return bestNumber;
}

const isWater = (tags: Tags): boolean =>
	tags.golf === "water_hazard" ||
	tags.golf === "lateral_water_hazard" ||
	tags.natural === "water";

/**
 * Turn raw Overpass elements (from `out geom tags` over a course area) into
 * normalized holes + per-hole geometry. Area features (green/fairway/bunker/
 * tee/water) are bucketed onto the nearest `golf=hole` line. `rough`, paths,
 * and driving ranges are intentionally dropped.
 */
export function normalizeCourse(
	elements: ReadonlyArray<OverpassElement>,
): NormalizedCourse {
	const holeElements = elements.filter((e) => e.tags?.golf === "hole");

	const holes: NormalizedHole[] = holeElements.map((el) => {
		const tags = el.tags ?? {};
		const { number, ref } = parseHoleRef(tags.ref);
		const line = geomOf(el);
		return {
			number,
			ref,
			par: parsePar(tags),
			strokeIndex: parseStrokeIndex(tags),
			line,
			lengthMeters: lineLengthMeters(line),
		};
	});

	const geometry = new Map<number, HoleGeometry>();
	for (const hole of holes) {
		if (!geometry.has(hole.number)) {
			geometry.set(hole.number, {
				holeNumber: hole.number,
				holeLine: hole.line,
				fairways: [],
				greens: [],
				bunkers: [],
				tees: [],
				water: [],
			});
		}
	}

	const holeLines = holes.map((h) => ({ number: h.number, line: h.line }));

	for (const el of elements) {
		const golf = el.tags?.golf;
		if (!golf || golf === "hole") continue;
		const poly = geomOf(el);
		if (poly.length < 2) continue;
		const target = geometry.get(
			nearestHoleNumber(centroid(poly), holeLines),
		);
		if (!target) continue;
		if (isWater(el.tags ?? {})) target.water.push(poly);
		else if (golf === "green") target.greens.push(poly);
		else if (golf === "fairway") target.fairways.push(poly);
		else if (golf === "bunker") target.bunkers.push(poly);
		else if (golf === "tee") target.tees.push(poly);
		// rough / path / cartpath / driving_range: dropped by design.
	}

	return { holes, geometry: [...geometry.values()] };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm exec vitest run src/domain/osm.test.ts`
Expected: PASS (parsing + geometry + both fixture suites green).

- [ ] **Step 5: Run the full test suite (no regressions)**

Run: `pnpm test`
Expected: all Plan 1 + Plan 2 tests pass.

- [ ] **Step 6: Format, lint, typecheck**

Run: `pnpm lint:fix && pnpm check && pnpm typecheck`
Expected: all exit 0. (JSON fixture imports typecheck under `resolveJsonModule`, which `moduleResolution: bundler` enables.)

- [ ] **Step 7: Commit**

```bash
git add src/domain/osm.ts src/domain/osm.test.ts
git commit -m "feat(osm): normalizeCourse — feature-to-hole assignment against real fixtures"
```

---

## Task 5: Course queries

**Files:**
- Create: `convex/courses.ts`

- [ ] **Step 1: Write the queries**

Create `convex/courses.ts`:

```ts
import { v } from "convex/values";
import { query } from "./_generated/server";

/** All courses, name-sorted, for the picker/list. */
export const list = query({
	args: {},
	handler: async (ctx) => {
		const courses = await ctx.db.query("courses").collect();
		return courses.sort((a, b) => a.name.localeCompare(b.name));
	},
});

/** One course with its tees, holes (number-sorted), and geometry. */
export const get = query({
	args: { courseId: v.id("courses") },
	handler: async (ctx, { courseId }) => {
		const course = await ctx.db.get(courseId);
		if (!course) return null;
		const [tees, holes, geometry] = await Promise.all([
			ctx.db
				.query("tees")
				.withIndex("by_course", (q) => q.eq("courseId", courseId))
				.collect(),
			ctx.db
				.query("holes")
				.withIndex("by_course", (q) => q.eq("courseId", courseId))
				.collect(),
			ctx.db
				.query("holeGeometry")
				.withIndex("by_course", (q) => q.eq("courseId", courseId))
				.collect(),
		]);
		return {
			course,
			tees,
			holes: holes.sort((a, b) => a.number - b.number),
			geometry,
		};
	},
});
```

- [ ] **Step 2: Regenerate types + typecheck**

Run: `pnpm exec convex codegen && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Lint + commit**

```bash
pnpm lint:fix && pnpm check
git add convex/courses.ts convex/_generated
git commit -m "feat(convex): course list + get queries"
```

---

## Task 6: Course mutations (editor writes)

**Files:**
- Modify: `convex/courses.ts`

- [ ] **Step 1: Add the mutations**

Add to the top import of `convex/courses.ts`: change `import { query } from "./_generated/server";` to `import { mutation, query } from "./_generated/server";`. Then append:

```ts
export const create = mutation({
	args: {
		name: v.string(),
		city: v.optional(v.string()),
		osmRelationId: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert("courses", {
			name: args.name,
			city: args.city,
			osmRelationId: args.osmRelationId,
			importStatus: "manual",
		});
	},
});

export const updateMeta = mutation({
	args: {
		courseId: v.id("courses"),
		name: v.optional(v.string()),
		city: v.optional(v.string()),
	},
	handler: async (ctx, { courseId, name, city }) => {
		const patch: Record<string, unknown> = {};
		if (name !== undefined) patch.name = name;
		if (city !== undefined) patch.city = city;
		await ctx.db.patch(courseId, patch);
	},
});

export const upsertTee = mutation({
	args: {
		teeId: v.optional(v.id("tees")),
		courseId: v.id("courses"),
		name: v.string(),
		color: v.optional(v.string()),
		courseRating: v.number(),
		slopeRating: v.number(),
	},
	handler: async (ctx, { teeId, ...fields }) => {
		if (teeId) {
			await ctx.db.patch(teeId, fields);
			return teeId;
		}
		return await ctx.db.insert("tees", fields);
	},
});

/** Set par + stroke index for a hole (editor's main job for OSM gaps). */
export const upsertHole = mutation({
	args: {
		holeId: v.id("holes"),
		par: v.optional(v.number()),
		strokeIndex: v.optional(v.number()),
	},
	handler: async (ctx, { holeId, par, strokeIndex }) => {
		await ctx.db.patch(holeId, { par, strokeIndex });
	},
});
```

- [ ] **Step 2: Regenerate types + typecheck**

Run: `pnpm exec convex codegen && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Lint + commit**

```bash
pnpm lint:fix && pnpm check
git add convex/courses.ts convex/_generated
git commit -m "feat(convex): course create/updateMeta/upsertTee/upsertHole mutations"
```

---

## Task 7: OSM import action + internal storage mutation

**Files:**
- Modify: `convex/courses.ts`

- [ ] **Step 1: Add the import action + internal storage mutation**

Update the imports at the top of `convex/courses.ts` to:

```ts
import { v } from "convex/values";
import { normalizeCourse } from "../src/domain/osm";
import { internal } from "./_generated/api";
import {
	action,
	internalMutation,
	mutation,
	query,
} from "./_generated/server";
```

Append:

```ts
const latLng = v.object({ lat: v.number(), lng: v.number() });
const polygon = v.array(latLng);

/**
 * Replace a course's holes + geometry from a normalized import. Wipes existing
 * holes/geometry first so re-imports are idempotent. Internal — only the import
 * action calls it.
 */
export const storeImport = internalMutation({
	args: {
		courseId: v.id("courses"),
		holes: v.array(
			v.object({
				number: v.number(),
				ref: v.string(),
				par: v.union(v.number(), v.null()),
				strokeIndex: v.union(v.number(), v.null()),
				lengthMeters: v.number(),
			}),
		),
		geometry: v.array(
			v.object({
				holeNumber: v.number(),
				holeLine: polygon,
				fairways: v.array(polygon),
				greens: v.array(polygon),
				bunkers: v.array(polygon),
				tees: v.array(polygon),
				water: v.array(polygon),
			}),
		),
	},
	handler: async (ctx, { courseId, holes, geometry }) => {
		for (const table of ["holes", "holeGeometry"] as const) {
			const existing = await ctx.db
				.query(table)
				.withIndex("by_course", (q) => q.eq("courseId", courseId))
				.collect();
			await Promise.all(existing.map((doc) => ctx.db.delete(doc._id)));
		}
		await Promise.all(
			holes.map((h) =>
				ctx.db.insert("holes", {
					courseId,
					number: h.number,
					ref: h.ref,
					par: h.par ?? undefined,
					strokeIndex: h.strokeIndex ?? undefined,
					lengthMeters: h.lengthMeters,
				}),
			),
		);
		await Promise.all(
			geometry.map((g) => ctx.db.insert("holeGeometry", { courseId, ...g })),
		);
		const complete = holes.every((h) => h.par !== null && h.strokeIndex !== null);
		await ctx.db.patch(courseId, {
			importStatus: complete ? "imported" : "partial",
		});
	},
});

/** Fetch a course's geometry from Overpass and store it. Re-runnable. */
export const importFromOsm = action({
	args: { courseId: v.id("courses"), osmRelationId: v.number() },
	handler: async (ctx, { courseId, osmRelationId }) => {
		const q = `[out:json][timeout:90];rel(${osmRelationId});map_to_area->.a;(way(area.a)[golf];);out geom tags;`;
		const res = await fetch("https://overpass-api.de/api/interpreter", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"User-Agent": "golf-app/0.1",
			},
			body: `data=${encodeURIComponent(q)}`,
		});
		if (!res.ok) {
			throw new Error(`Overpass request failed: HTTP ${res.status}`);
		}
		const data = (await res.json()) as { elements: unknown[] };
		const normalized = normalizeCourse(
			data.elements as Parameters<typeof normalizeCourse>[0],
		);
		await ctx.runMutation(internal.courses.storeImport, {
			courseId,
			holes: normalized.holes.map((h) => ({
				number: h.number,
				ref: h.ref,
				par: h.par,
				strokeIndex: h.strokeIndex,
				lengthMeters: h.lengthMeters,
			})),
			geometry: normalized.geometry,
		});
		return { holes: normalized.holes.length };
	},
});
```

- [ ] **Step 2: Regenerate types + typecheck**

Run: `pnpm exec convex codegen && pnpm typecheck`
Expected: exit 0. (Confirms Convex can bundle the `../src/domain/osm` import — the normalizer is pure and runtime-safe.)

- [ ] **Step 3: Lint + build (bundle check)**

Run: `pnpm lint:fix && pnpm check && pnpm build`
Expected: all exit 0.

- [ ] **Step 4: Commit**

```bash
git add convex/courses.ts convex/_generated
git commit -m "feat(convex): importFromOsm action + idempotent storeImport"
```

---

## Task 8: Seed action

**Files:**
- Create: `convex/seed.ts`

- [ ] **Step 1: Write the seed action**

Create `convex/seed.ts`:

```ts
import { api } from "./_generated/api";
import { action } from "./_generated/server";

const HOME_COURSES = [
	{ name: "Golfbaan Landgoed Welderen", city: "Elst", osmRelationId: 901850 },
	{ name: "De Oosterhoutse Golf Club", city: "Oosterhout", osmRelationId: 4458605 },
];

/**
 * Seed both home courses: create the course row, import geometry from OSM, and
 * add one editable default tee (neutral slope 113 so course handicap == index
 * until real ratings are entered in the editor). Idempotent-ish: creates a new
 * course each run, so run once on a fresh deployment.
 *
 * Run with: pnpm exec convex run seed:seed
 */
export const seed = action({
	args: {},
	handler: async (ctx): Promise<{ course: string; holes: number }[]> => {
		const results: { course: string; holes: number }[] = [];
		for (const c of HOME_COURSES) {
			const courseId = await ctx.runMutation(api.courses.create, {
				name: c.name,
				city: c.city,
				osmRelationId: c.osmRelationId,
			});
			const { holes } = await ctx.runAction(api.courses.importFromOsm, {
				courseId,
				osmRelationId: c.osmRelationId,
			});
			await ctx.runMutation(api.courses.upsertTee, {
				courseId,
				name: "Default (edit me)",
				courseRating: 72,
				slopeRating: 113,
			});
			results.push({ course: c.name, holes });
		}
		return results;
	},
});
```

- [ ] **Step 2: Regenerate types + typecheck**

Run: `pnpm exec convex codegen && pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Lint + commit**

```bash
pnpm lint:fix && pnpm check
git add convex/seed.ts convex/_generated
git commit -m "feat(convex): seed action for Welderen + De Oosterhoutse"
```

> **Live-run note (not a commit gate):** once a Convex dev deployment is configured, seeding is `pnpm exec convex run seed:seed`. It cannot run in this environment without a deployment; that's expected and deferred.

---

## Task 9: Courses list route

**Files:**
- Create: `src/routes/courses.index.tsx`

- [ ] **Step 1: Write the route**

Create `src/routes/courses.index.tsx`:

```tsx
import { useQuery } from "convex/react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { MapPin, Pencil } from "lucide-react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/courses/")({ component: CoursesScreen });

function CoursesScreen() {
	const courses = useQuery(api.courses.list);

	return (
		<main className="px-5 pt-16 pb-[110px]">
			<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
				Courses
			</h1>
			<p className="mt-1 text-[13px] text-moss">
				Seeded from OpenStreetMap. Tap a course to fill in par, stroke index,
				and tee ratings.
			</p>

			{courses === undefined ? (
				<p className="mt-8 text-[13px] text-stone">Loading…</p>
			) : courses.length === 0 ? (
				<p className="mt-8 text-[13px] text-stone">
					No courses yet — run the seed action to import your home courses.
				</p>
			) : (
				<ul className="mt-6 flex flex-col gap-3">
					{courses.map((course) => (
						<li key={course._id}>
							<Link
								to="/courses/$courseId/edit"
								params={{ courseId: course._id }}
								className="flex items-center justify-between rounded-2xl border border-card-line bg-white/60 px-4 py-4 shadow-sm"
							>
								<span>
									<span className="block font-display text-[17px] font-semibold text-ink">
										{course.name}
									</span>
									{course.city ? (
										<span className="mt-0.5 flex items-center gap-1 text-[12px] text-moss">
											<MapPin className="size-3.5" />
											{course.city}
										</span>
									) : null}
								</span>
								<Pencil className="size-4 text-live" />
							</Link>
						</li>
					))}
				</ul>
			)}
		</main>
	);
}
```

- [ ] **Step 2: Regenerate the route tree + typecheck**

Run: `pnpm generate-routes && pnpm typecheck`
Expected: exit 0; `courses/` route registered in the generated route tree.

- [ ] **Step 3: Lint + commit**

```bash
pnpm lint:fix && pnpm check
git add src/routes/courses.index.tsx src/routeTree.gen.ts
git commit -m "feat(ui): courses list route"
```

---

## Task 10: Course editor route

**Files:**
- Create: `src/routes/courses.$courseId.edit.tsx`

- [ ] **Step 1: Write the editor route**

Create `src/routes/courses.$courseId.edit.tsx`. It loads the course via `api.courses.get`, and lets you edit course name/city, one tee's course/slope rating, and each hole's par + stroke index (the OSM gaps). Geometry-less holes show an "incomplete" badge.

```tsx
import { useMutation, useQuery } from "convex/react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const Route = createFileRoute("/courses/$courseId/edit")({
	component: CourseEditor,
});

function CourseEditor() {
	const { courseId } = Route.useParams();
	const data = useQuery(api.courses.get, {
		courseId: courseId as Id<"courses">,
	});
	const updateMeta = useMutation(api.courses.updateMeta);
	const upsertTee = useMutation(api.courses.upsertTee);
	const upsertHole = useMutation(api.courses.upsertHole);

	if (data === undefined) {
		return (
			<main className="px-5 pt-16 pb-[110px]">
				<p className="text-[13px] text-stone">Loading…</p>
			</main>
		);
	}
	if (data === null) {
		return (
			<main className="px-5 pt-16 pb-[110px]">
				<p className="text-[13px] text-stone">Course not found.</p>
			</main>
		);
	}

	const { course, tees, holes, geometry } = data;
	const holesWithGeometry = new Set(geometry.map((g) => g.holeNumber));
	const tee = tees[0];

	return (
		<main className="px-5 pt-16 pb-[110px]">
			<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
				Edit course
			</h1>
			<p className="mt-1 text-[13px] text-moss">
				{course.importStatus === "partial"
					? "Imported from OSM — fill in the missing par and stroke index below."
					: "Course details."}
			</p>

			<MetaSection
				name={course.name}
				city={course.city ?? ""}
				onSave={(name, city) =>
					updateMeta({ courseId: course._id, name, city })
				}
			/>

			<TeeSection
				tee={tee}
				onSave={(name, courseRating, slopeRating) =>
					upsertTee({
						teeId: tee?._id,
						courseId: course._id,
						name,
						courseRating,
						slopeRating,
					})
				}
			/>

			<section className="mt-8">
				<h2 className="font-display text-sm font-semibold uppercase tracking-wide text-moss">
					Holes
				</h2>
				<ul className="mt-3 flex flex-col gap-2">
					{holes.map((hole) => (
						<HoleRow
							key={hole._id}
							number={hole.number}
							refLabel={hole.ref}
							par={hole.par}
							strokeIndex={hole.strokeIndex}
							hasGeometry={holesWithGeometry.has(hole.number)}
							onSave={(par, strokeIndex) =>
								upsertHole({ holeId: hole._id, par, strokeIndex })
							}
						/>
					))}
				</ul>
			</section>
		</main>
	);
}

function MetaSection({
	name,
	city,
	onSave,
}: {
	name: string;
	city: string;
	onSave: (name: string, city: string) => void;
}) {
	const [n, setN] = useState(name);
	const [c, setC] = useState(city);
	return (
		<section className="mt-6 rounded-2xl border border-card-line bg-white/60 p-4">
			<label className="block text-[11px] font-semibold uppercase tracking-wide text-moss">
				Name
				<input
					value={n}
					onChange={(e) => setN(e.target.value)}
					className="mt-1 w-full rounded-lg border border-card-line bg-cream px-3 py-2 font-sans text-[15px] text-ink"
				/>
			</label>
			<label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-moss">
				City
				<input
					value={c}
					onChange={(e) => setC(e.target.value)}
					className="mt-1 w-full rounded-lg border border-card-line bg-cream px-3 py-2 font-sans text-[15px] text-ink"
				/>
			</label>
			<button
				type="button"
				onClick={() => onSave(n, c)}
				className="mt-4 rounded-full bg-pine px-5 py-2 font-display text-[13px] font-semibold text-cream"
			>
				Save details
			</button>
		</section>
	);
}

function TeeSection({
	tee,
	onSave,
}: {
	tee: { name: string; courseRating: number; slopeRating: number } | undefined;
	onSave: (name: string, courseRating: number, slopeRating: number) => void;
}) {
	const [name, setName] = useState(tee?.name ?? "White");
	const [cr, setCr] = useState(String(tee?.courseRating ?? 72));
	const [slope, setSlope] = useState(String(tee?.slopeRating ?? 113));
	return (
		<section className="mt-4 rounded-2xl border border-card-line bg-white/60 p-4">
			<h2 className="font-display text-sm font-semibold uppercase tracking-wide text-moss">
				Tee
			</h2>
			<div className="mt-3 grid grid-cols-3 gap-3">
				<Field label="Name" value={name} onChange={setName} />
				<Field label="CR" value={cr} onChange={setCr} inputMode="decimal" />
				<Field
					label="Slope"
					value={slope}
					onChange={setSlope}
					inputMode="numeric"
				/>
			</div>
			<button
				type="button"
				onClick={() => onSave(name, Number(cr), Number(slope))}
				className="mt-4 rounded-full bg-pine px-5 py-2 font-display text-[13px] font-semibold text-cream"
			>
				Save tee
			</button>
		</section>
	);
}

function Field({
	label,
	value,
	onChange,
	inputMode,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	inputMode?: "numeric" | "decimal";
}) {
	return (
		<label className="block text-[11px] font-semibold uppercase tracking-wide text-moss">
			{label}
			<input
				value={value}
				inputMode={inputMode}
				onChange={(e) => onChange(e.target.value)}
				className="mt-1 w-full rounded-lg border border-card-line bg-cream px-3 py-2 font-sans text-[15px] text-ink"
			/>
		</label>
	);
}

function HoleRow({
	number,
	refLabel,
	par,
	strokeIndex,
	hasGeometry,
	onSave,
}: {
	number: number;
	refLabel?: string;
	par?: number;
	strokeIndex?: number;
	hasGeometry: boolean;
	onSave: (par: number | undefined, strokeIndex: number | undefined) => void;
}) {
	const [p, setP] = useState(par?.toString() ?? "");
	const [si, setSi] = useState(strokeIndex?.toString() ?? "");
	// Keep local inputs in sync if the server value changes under us.
	useEffect(() => setP(par?.toString() ?? ""), [par]);
	useEffect(() => setSi(strokeIndex?.toString() ?? ""), [strokeIndex]);

	const dirty = p !== (par?.toString() ?? "") || si !== (strokeIndex?.toString() ?? "");

	return (
		<li className="flex items-center gap-3 rounded-xl border border-card-line bg-white/60 px-3 py-2">
			<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pine font-display text-[13px] font-semibold text-cream">
				{refLabel || number}
			</span>
			<label className="text-[11px] font-semibold uppercase tracking-wide text-moss">
				Par
				<input
					value={p}
					inputMode="numeric"
					onChange={(e) => setP(e.target.value)}
					className="mt-0.5 w-14 rounded-lg border border-card-line bg-cream px-2 py-1.5 font-sans text-[15px] text-ink"
				/>
			</label>
			<label className="text-[11px] font-semibold uppercase tracking-wide text-moss">
				SI
				<input
					value={si}
					inputMode="numeric"
					onChange={(e) => setSi(e.target.value)}
					className="mt-0.5 w-14 rounded-lg border border-card-line bg-cream px-2 py-1.5 font-sans text-[15px] text-ink"
				/>
			</label>
			{!hasGeometry ? (
				<span className="ml-auto rounded-full bg-flag/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-flag">
					No map
				</span>
			) : null}
			<button
				type="button"
				disabled={!dirty}
				onClick={() =>
					onSave(
						p === "" ? undefined : Number(p),
						si === "" ? undefined : Number(si),
					)
				}
				className="ml-auto rounded-full bg-live px-3 py-1.5 font-display text-[12px] font-semibold text-white disabled:opacity-40"
			>
				Save
			</button>
		</li>
	);
}
```

> Note: the `ml-auto` on both the "No map" badge and Save button is intentional — the badge pushes to the right when present, and the button's own `ml-auto` keeps it right-aligned when the badge is absent.

- [ ] **Step 2: Regenerate route tree + typecheck**

Run: `pnpm generate-routes && pnpm typecheck`
Expected: exit 0; `courses/$courseId/edit` registered.

- [ ] **Step 3: Lint + build**

Run: `pnpm lint:fix && pnpm check && pnpm build`
Expected: all exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/routes/courses.$courseId.edit.tsx src/routeTree.gen.ts
git commit -m "feat(ui): course editor (meta, tee ratings, per-hole par + stroke index)"
```

---

## Task 11: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Regenerate everything**

Run: `pnpm exec convex codegen && pnpm generate-routes`
Expected: both exit 0, no uncommitted generated drift (if there is drift, commit it).

- [ ] **Step 2: The four gates**

Run each; all must pass:
- `pnpm check` → 0
- `pnpm typecheck` → 0
- `pnpm test` → all suites pass (Plan 1's 4 files + `osm.test.ts`)
- `pnpm build` → 0

- [ ] **Step 3: Confirm no secrets / no committed env**

Run: `git log --oneline -12 && git status`
Confirm: no `.env*` staged, no API keys or tokens in any diff. Overpass needs no key.

- [ ] **Step 4: Final commit if any generated drift remains**

```bash
git add -A
git commit -m "chore: regenerate Convex + route types for course-data plan" || echo "nothing to commit"
```

---

## Self-review checklist (run after execution, before finishing)

1. **Spec §7 coverage:** every table present? (courses, tees, holes, holeGeometry, userSettings, clubs, rounds, holeScores) ✓ Task 1.
2. **Spec §6 import phase:** Overpass query on relation → collect golf ways → assign to holes → store per-hole geometry ✓ Tasks 4/7. (Polygon simplification deferred to render-time decimation in Plan 5 — noted.)
3. **Spec §8 "course missing from free API":** manual editor is first-class ✓ Task 10.
4. **Loops:** hole `ref` preserved raw + parsed number, dual SI handled ✓ Tasks 3/4. (Loop *composition* into rounds is Plan 4.)
5. **Type consistency:** `NormalizedHole`/`HoleGeometry`/`NormalizedCourse` identical across osm.ts (Tasks 3/4), storeImport validators (Task 7), and seed return (Task 8) ✓.
6. **No placeholders / no secrets** ✓.

## Known deferrals (carried forward, not bugs)

- **GolfCourseAPI import** — par/SI/CR/slope autofill; deferred (keyed API). `externalRef` slot ready.
- **`trees`, `rough`, `water` from `natural=*`** — trees/rough dropped; water only from `golf=water_hazard` (both home courses have none tagged that way). Add a `natural=water`/`natural=wood` Overpass pass in Plan 5 when the render needs them.
- **Polygon simplification** — done at render time (viewport decimation) in Plan 5, not at import.
- **`distanceByTee`** — holes store a single `lengthMeters` (hole-line length) for now; per-tee distances need scorecard data (GolfCourseAPI or manual), added when round setup needs them (Plan 4).
- **Live seed + editor browser QA** — blocked on a Convex dev deployment + Clerk dev key; verified statically here.
```
