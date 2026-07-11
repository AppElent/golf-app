# Play Screen — Map Pipeline + GPS Implementation Plan (Plan 4 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Play screen — the app's identity — an illustrated procedural-SVG hole map (Fairway look, Golfshot info density) with per-hole distances, a distance ladder, a draggable aim point with split distances, a suggested-club chip, tap-to-measure, and live GPS, plus Rings and Big-numbers variants. Rendered from the geometry seeded in Plan 2.

**Architecture:** A **layer-agnostic projection** turns a hole's stored WGS84 geometry into a local-meter grid with the tee→green axis vertical, fit to the SVG viewport (the same overlay layer a v2 satellite tile would slide under). A pure `hole-map/projection` module owns projection + inverse-projection and is unit-tested. A `HoleMap` component composes two children: `GroundLayer` (procedural SVG — rough/fairway/mow-stripes/trees/water/bunkers/green/flag) and `InfoOverlay` (distance arcs, ladder, shot line, draggable aim, club chip, you-are-here, tap-to-measure). Distances come from the existing `geo` domain module (extended here to axis-projected green front/center/back). A `useGeolocation` hook feeds `watchPosition`; when GPS is denied/unavailable the map works fully from the tee position (spec §8). The Play route wires round state (`rounds.active` + `courses.get` geometry), current-hole navigation (`rounds.setCurrentHole`), aim state, and the variant toggle.

**Tech Stack:** React 19 SVG, TanStack Start route, Convex React hooks (existing `rounds.active`/`courses.get`/`rounds.setCurrentHole`), `src/domain/{geo,club-suggest}`, Geolocation API, Tailwind v4 Fairway tokens (incl. `--color-map-*`), Vitest, Biome, pnpm.

---

## Scope & decisions (read before starting)

- **Geometry source:** the Play screen reads the active round's geometry from the existing `courses.get` query (returns `geometry[]` keyed by `ref`, WGS84 lat/lng). No new heavy query. `rounds.active` supplies round state + current hole. Both already exist and are live-verified.
- **Projection is layer-agnostic** (spec §6): `GroundLayer` and `InfoOverlay` both consume a `Projector` (project + unproject). A satellite underlay in v2 slots in behind `GroundLayer` using the same `Projector` — no overlay rework. Do not bake projection into the style code.
- **Position fallback = tee** (spec §8): the "player position" defaults to the hole's tee (tee-box centroid, else the first vertex of the hole line). GPS overrides it when a fix arrives. The map, ladder, aim, and tap-to-measure are all fully functional with no GPS. Poor accuracy (>15 m) shows a halo but never hides the number.
- **Club bag:** Profile's bag management is Plan 6. Plan 4 adds a read-only `clubs.list` query and a `DEFAULT_BAG` (meters) fallback so the club chip is meaningful now; Plan 6's bag overrides it.
- **Aim point** starts at green center, is draggable within the SVG, and drives two split distances (you→aim, aim→green-center) + the club chip (nearest club to you→aim). Stored as a `LatLng` via `Projector.unproject` so distances are true meters.
- **Green front/center/back** become **axis-projected** (spec §6 "polygon extremes along axis"), fixing the Plan 1 review deferral in `geo.distancesToGreen`. Hazard carries stay near-edge/far-edge (`geo.carryDistances`).
- **Trees:** Plan 2 did not import tree points (deferred). `GroundLayer` renders tree canopies **only if** `geometry.trees` is present; absent → no trees (no crash). A `natural=wood` import pass is still a Plan 5/later follow-up. Keep the optional `trees` prop wired so it lights up for free when the data lands.
- **Variants:** `map` (default), `rings` (100/150/200 m circles from position), `bignumbers` (full-bleed, 112 px center distance). One `variant` state on the route.
- **Meters throughout** (Profile m/yd toggle is Plan 6; hardcode meters, keep a single `formatDistance` seam).

## Verification reality

- **Live-verifiable in browser** (env now has Clerk + cloud dev deployment; see [[golf-app-verification-infra]]): launch `preview_start({name:"All (dev:watch)"})`, seed both courses if empty, start a round, open `/play`. **GPS can't be real on a dev box** — mock it with `javascript_tool` by overriding `navigator.geolocation.watchPosition` to emit a coordinate on a known Welderen/Oosterhoutse hole, then assert the ladder/chips/map update. Drive the UI with `javascript_tool` (this pane's `computer` ref-clicks/screenshots are unreliable — [[golf-app-verification-infra]]).
- **Unit-verifiable:** projection (project/unproject round-trip, axis vertical, fit-in-viewport), geo green front/center/back, club suggestion. Dense tests.
- **Not fully verifiable here:** true on-course GPS accuracy/auto-advance behaviour — that's the Plan 4→8 field test at Welderen. Auto-advance is built but only smoke-tested with mocked positions.

## File structure

| File | Responsibility |
|---|---|
| `src/domain/geo.ts` | Extend: axis-projected `distancesToGreen`; add `bearing`/`destinationPoint` helpers if needed for tests. |
| `src/domain/club-suggest.ts` | Add `DEFAULT_BAG` (meters). |
| `src/components/hole-map/projection.ts` + `.test.ts` | Pure `buildProjector({tee,green,features,width,height,padding})` → `{ project, unproject, scale }`. Axis vertical, green up, fit-to-viewport. |
| `src/hooks/useGeolocation.ts` | `watchPosition` hook → `{ position: LatLng | null, accuracyM, error }`. |
| `src/components/hole-map/defs.tsx` | SVG `<defs>`: gradients (rough/green/water), patterns (mow stripes, ripples), soft-shadow filter. |
| `src/components/hole-map/GroundLayer.tsx` | Procedural style layers: rough base → fairway (mow stripes) → trees? → water → bunkers → green (fringe) → flag. |
| `src/components/hole-map/InfoOverlay.tsx` | Distance arcs, ladder, shot line + aim point, club chip, you-are-here, tap-to-measure marker. |
| `src/components/hole-map/HoleMap.tsx` | Composes defs+ground+info; owns aim-drag + tap-to-measure pointer handling; renders `map`/`rings`/`bignumbers`. |
| `convex/clubs.ts` | `list` query (user's clubs, sort order). |
| `src/routes/play.tsx` | Rewrite placeholder → Play screen: header, prev/next, variant toggle, HoleMap, F/C/B chips, hazard carries, "Enter score" CTA. Wires GPS + round + aim. |

Shared types (defined in Task 2, used across map components):

```ts
// src/components/hole-map/projection.ts
export interface Point { x: number; y: number }
export interface Projector {
	project(p: LatLng): Point;
	unproject(pt: Point): LatLng;
	scale: number; // pixels per meter
}
// A hole's renderable geometry (projected consumers accept raw LatLng + a Projector)
export interface HoleShapes {
	holeLine: LatLng[];
	fairways: LatLng[][];
	greens: LatLng[][];
	bunkers: LatLng[][];
	water: LatLng[][];
	tees: LatLng[][];
	trees?: LatLng[]; // optional points (not imported yet)
}
```

---

## Task 1: geo — axis-projected green front/center/back (TDD)

**Files:**
- Modify: `src/domain/geo.ts`
- Modify: `src/domain/geo.test.ts`

- [ ] **Step 1: Add a discriminating failing test**

The Plan 1 test uses a green colinear with the axis (so vertex-min and axis-min coincide). Add a test where the nearest *vertex* is NOT the nearest point *along the player→green axis*, proving axis projection. Append to the `distancesToGreen` describe block in `src/domain/geo.test.ts`:

```ts
	it("projects onto the player→center axis (a wide side vertex is not 'front')", () => {
		// Player south of a green centered ~111 m north; green is wide east–west.
		// A side vertex is closer as a raw vertex, but front/back are along the axis.
		const player = { lat: 0, lng: 0 };
		const green = [
			{ lat: 0.00095, lng: -0.0003 }, // near-left
			{ lat: 0.00105, lng: 0.0003 }, // far-right
			{ lat: 0.001, lng: 0 }, // center-ish
		];
		const d = distancesToGreen(player, green);
		// center ≈ 111 m; front (near edge along axis) < center < back (far edge)
		expect(d.center).toBeCloseTo(111.2, 0);
		expect(d.front).toBeLessThan(d.center);
		expect(d.back).toBeGreaterThan(d.center);
		// axis-projected extremes are ~ ±11 m of center, not the raw diagonal vertex distance
		expect(d.back - d.front).toBeLessThan(30);
	});
```

- [ ] **Step 2: Run — the new test fails, the old colinear one still passes**

Run: `pnpm exec vitest run src/domain/geo.test.ts`
Expected: the new axis test FAILS with vertex-based math (front/back come out as diagonal vertex distances).

- [ ] **Step 3: Replace `distancesToGreen` with axis projection**

In `src/domain/geo.ts`, replace the `distancesToGreen` function with:

```ts
/**
 * Green front / center / back as distances from `position`, measured along the
 * player→green-center axis (spec §6: polygon extremes along the axis). Front is
 * the nearest edge along that line, back the farthest; center is the centroid.
 */
export function distancesToGreen(
	position: LatLng,
	green: ReadonlyArray<LatLng>,
): { front: number; center: number; back: number } {
	const center = polygonCentroid(green);
	const centerLocal = projectToLocal(position, center);
	const axisLen = Math.hypot(centerLocal.x, centerLocal.y) || 1;
	// Unit vector position→center in local meters.
	const ux = centerLocal.x / axisLen;
	const uy = centerLocal.y / axisLen;
	// Signed distance of each vertex along the axis from `position`.
	const along = green.map((p) => {
		const l = projectToLocal(position, p);
		return l.x * ux + l.y * uy;
	});
	return {
		front: Math.min(...along),
		center: haversineMeters(position, center),
		back: Math.max(...along),
	};
}
```

- [ ] **Step 4: Run — all geo tests green**

Run: `pnpm exec vitest run src/domain/geo.test.ts`
Expected: PASS (the colinear Plan 1 test still passes; the new axis test passes).

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix && pnpm check && pnpm typecheck
git add src/domain/geo.ts src/domain/geo.test.ts
git commit -m "feat(geo): axis-projected green front/center/back (spec §6)"
```

---

## Task 2: hole-map projection module (TDD)

**Files:**
- Create: `src/components/hole-map/projection.ts`
- Test: `src/components/hole-map/projection.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/components/hole-map/projection.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { LatLng } from "../../domain/geo";
import { buildProjector } from "./projection";

const tee: LatLng = { lat: 52.0, lng: 5.8 };
// ~300 m roughly north-east of the tee
const green: LatLng = { lat: 52.0023, lng: 5.8015 };
const opts = {
	tee,
	green,
	features: [[tee, green]],
	width: 300,
	height: 500,
	padding: 24,
};

describe("buildProjector", () => {
	it("places the green above the tee (axis vertical, green up)", () => {
		const proj = buildProjector(opts);
		const t = proj.project(tee);
		const g = proj.project(green);
		expect(g.y).toBeLessThan(t.y); // smaller screen-y = higher up
		expect(Math.abs(g.x - t.x)).toBeLessThan(1); // axis vertical → same x
	});

	it("fits all points inside the padded viewport", () => {
		const proj = buildProjector(opts);
		for (const p of [tee, green]) {
			const s = proj.project(p);
			expect(s.x).toBeGreaterThanOrEqual(opts.padding - 0.5);
			expect(s.x).toBeLessThanOrEqual(opts.width - opts.padding + 0.5);
			expect(s.y).toBeGreaterThanOrEqual(opts.padding - 0.5);
			expect(s.y).toBeLessThanOrEqual(opts.height - opts.padding + 0.5);
		}
	});

	it("project ∘ unproject is ~identity", () => {
		const proj = buildProjector(opts);
		const round = proj.unproject(proj.project(green));
		expect(round.lat).toBeCloseTo(green.lat, 5);
		expect(round.lng).toBeCloseTo(green.lng, 5);
	});

	it("scale is positive pixels-per-meter", () => {
		expect(buildProjector(opts).scale).toBeGreaterThan(0);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run src/components/hole-map/projection.test.ts`
Expected: FAIL — `./projection` not found.

- [ ] **Step 3: Implement**

Create `src/components/hole-map/projection.ts`:

```ts
import { type LatLng, projectToLocal } from "../../domain/geo";

export interface Point {
	x: number;
	y: number;
}

export interface Projector {
	project(p: LatLng): Point;
	unproject(pt: Point): LatLng;
	scale: number;
}

/** A hole's renderable geometry in WGS84 (consumers project via a Projector). */
export interface HoleShapes {
	holeLine: LatLng[];
	fairways: LatLng[][];
	greens: LatLng[][];
	bunkers: LatLng[][];
	water: LatLng[][];
	tees: LatLng[][];
	trees?: LatLng[]; // optional points (not imported yet)
}

const EARTH_RADIUS_M = 6371000;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/**
 * Build a projector that maps a hole's WGS84 geometry to SVG pixels with the
 * tee→green axis vertical (green up), fit to a padded viewport. Layer-agnostic:
 * any ground layer (procedural now, satellite later) shares this transform.
 */
export function buildProjector(opts: {
	tee: LatLng;
	green: LatLng;
	features: ReadonlyArray<ReadonlyArray<LatLng>>;
	width: number;
	height: number;
	padding: number;
}): Projector {
	const { tee, green, features, width, height, padding } = opts;

	// 1) Local meters around the tee (x east, y north).
	const teeLocal = projectToLocal(tee, tee); // {0,0}
	const greenLocal = projectToLocal(tee, green);

	// 2) Rotation φ that turns the tee→green vector to point "north" (+y).
	const axisAngle = Math.atan2(greenLocal.y - teeLocal.y, greenLocal.x - teeLocal.x);
	const phi = Math.PI / 2 - axisAngle;
	const cos = Math.cos(phi);
	const sin = Math.sin(phi);
	const rotate = (m: Point): Point => ({
		x: m.x * cos - m.y * sin,
		y: m.x * sin + m.y * cos,
	});

	// 3) Bounding box of every feature point in rotated meter space.
	const rotatedPoints = features
		.flat()
		.map((p) => rotate(projectToLocal(tee, p)));
	const xs = rotatedPoints.map((p) => p.x);
	const ys = rotatedPoints.map((p) => p.y);
	const minX = Math.min(...xs, 0);
	const maxX = Math.max(...xs, 0);
	const minY = Math.min(...ys, 0);
	const maxY = Math.max(...ys, 0);

	const availW = width - 2 * padding;
	const availH = height - 2 * padding;
	const spanX = maxX - minX || 1;
	const spanY = maxY - minY || 1;
	const scale = Math.min(availW / spanX, availH / spanY);

	// Center the scaled bbox in the viewport; flip y so north is up.
	const offsetX = padding + (availW - spanX * scale) / 2;
	const offsetY = padding + (availH - spanY * scale) / 2;

	const project = (p: LatLng): Point => {
		const r = rotate(projectToLocal(tee, p));
		return {
			x: offsetX + (r.x - minX) * scale,
			y: offsetY + (maxY - r.y) * scale, // flip
		};
	};

	const unproject = (pt: Point): LatLng => {
		// Invert: screen → rotated meters → local meters → lat/lng.
		const rx = (pt.x - offsetX) / scale + minX;
		const ry = maxY - (pt.y - offsetY) / scale;
		// Un-rotate by −φ.
		const mx = rx * cos + ry * sin;
		const my = -rx * sin + ry * cos;
		// Inverse equirectangular around the tee.
		const lat = tee.lat + toDeg(my / EARTH_RADIUS_M);
		const lng =
			tee.lng +
			toDeg(mx / (EARTH_RADIUS_M * Math.cos((tee.lat * Math.PI) / 180)));
		return { lat, lng };
	};

	return { project, unproject, scale };
}
```

- [ ] **Step 4: Run to verify pass + full suite**

Run: `pnpm exec vitest run src/components/hole-map/projection.test.ts && pnpm test`
Expected: PASS, no regressions.

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix && pnpm check && pnpm typecheck
git add src/components/hole-map/projection.ts src/components/hole-map/projection.test.ts
git commit -m "feat(hole-map): layer-agnostic axis-vertical projector with unproject"
```

---

## Task 3: useGeolocation hook

**Files:**
- Create: `src/hooks/useGeolocation.ts`

- [ ] **Step 1: Implement the hook**

Create `src/hooks/useGeolocation.ts`:

```ts
import { useEffect, useState } from "react";
import type { LatLng } from "../domain/geo";

export interface GeoState {
	position: LatLng | null;
	accuracyM: number | null;
	error: string | null;
	supported: boolean;
}

/**
 * Live position via watchPosition. Null position until the first fix; the Play
 * screen falls back to the tee (spec §8). `enabled` lets the caller stop the
 * watch (e.g. round finished).
 */
export function useGeolocation(enabled = true): GeoState {
	const [state, setState] = useState<GeoState>({
		position: null,
		accuracyM: null,
		error: null,
		supported:
			typeof navigator !== "undefined" && "geolocation" in navigator,
	});

	useEffect(() => {
		if (!enabled || typeof navigator === "undefined" || !navigator.geolocation) {
			return;
		}
		const id = navigator.geolocation.watchPosition(
			(pos) =>
				setState((s) => ({
					...s,
					position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
					accuracyM: pos.coords.accuracy,
					error: null,
				})),
			(err) => setState((s) => ({ ...s, error: err.message })),
			{ enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
		);
		return () => navigator.geolocation.clearWatch(id);
	}, [enabled]);

	return state;
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck && pnpm lint:fix && pnpm check
git add src/hooks/useGeolocation.ts
git commit -m "feat(hooks): useGeolocation watchPosition hook (tee-fallback friendly)"
```

---

## Task 4: SVG defs + GroundLayer (procedural style)

**Files:**
- Create: `src/components/hole-map/defs.tsx`
- Create: `src/components/hole-map/GroundLayer.tsx`

> The Fairway map tokens already exist in `src/styles.css` (`--color-map-rough #8fa86b`, `--color-map-semi #a9c07e`, `--color-map-fairway #c6da9c`, `--color-map-green #6fc188`, `--color-map-green-edge #4fa76c`, plus `--color-water #8fbfd0`, `--color-sand #eadfb8`). Use them via `var(--color-map-*)`. This is the first pass of the illustrated look — the subagent-driven **code-quality review must judge it against the Fairway comp** (spec §3/§6) and refine mow-stripe angle, fringe softness, tree clustering, and shadows.

- [ ] **Step 1: SVG defs**

Create `src/components/hole-map/defs.tsx`:

```tsx
/** Shared gradients, patterns, and filters for the hole map. IDs are global. */
export function HoleMapDefs() {
	return (
		<defs>
			<radialGradient id="hm-rough" cx="50%" cy="40%" r="75%">
				<stop offset="0%" stopColor="var(--color-map-semi)" />
				<stop offset="100%" stopColor="var(--color-map-rough)" />
			</radialGradient>
			<radialGradient id="hm-green" cx="50%" cy="45%" r="65%">
				<stop offset="0%" stopColor="#8fd6a2" />
				<stop offset="100%" stopColor="var(--color-map-green)" />
			</radialGradient>
			<linearGradient id="hm-water" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stopColor="#a9d3e0" />
				<stop offset="100%" stopColor="var(--color-water)" />
			</linearGradient>
			{/* Mow stripes: alternating fairway shades rotated ~10°. */}
			<pattern
				id="hm-mow"
				width="18"
				height="18"
				patternUnits="userSpaceOnUse"
				patternTransform="rotate(10)"
			>
				<rect width="18" height="18" fill="var(--color-map-fairway)" />
				<rect width="9" height="18" fill="#cee0a6" />
			</pattern>
			<filter id="hm-soft" x="-20%" y="-20%" width="140%" height="140%">
				<feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.18" />
			</filter>
		</defs>
	);
}
```

- [ ] **Step 2: GroundLayer**

Create `src/components/hole-map/GroundLayer.tsx`:

```tsx
import type { LatLng } from "../../domain/geo";
import type { HoleShapes } from "./projection";
import type { Projector } from "./projection";

const TREE_TONES = ["#3f7a4e", "#4f9160", "#68a878"];

function toPath(ring: ReadonlyArray<LatLng>, proj: Projector): string {
	if (ring.length === 0) return "";
	return `${ring
		.map((p, i) => {
			const s = proj.project(p);
			return `${i === 0 ? "M" : "L"}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
		})
		.join(" ")} Z`;
}

/** Procedural illustrated ground: rough → fairway (mow stripes) → trees →
 *  water → bunkers → green (fringe) → flag. All from Fairway map tokens. */
export function GroundLayer({
	shapes,
	green,
	proj,
	width,
	height,
}: {
	shapes: HoleShapes;
	green: LatLng; // green center for the flag
	proj: Projector;
	width: number;
	height: number;
}) {
	const flag = proj.project(green);
	return (
		<g>
			{/* Rough base fills the whole viewport */}
			<rect x={0} y={0} width={width} height={height} fill="url(#hm-rough)" />

			{/* Fairways: mow-stripe fill + soft light edge */}
			{shapes.fairways.map((ring, i) => (
				<path
					key={`fw-${i}`}
					d={toPath(ring, proj)}
					fill="url(#hm-mow)"
					stroke="#d8e7b4"
					strokeWidth={2}
					strokeLinejoin="round"
				/>
			))}

			{/* Trees (optional; clustered canopies with shadows) */}
			{(shapes.trees ?? []).map((t, i) => {
				const c = proj.project(t);
				return (
					<g key={`tree-${i}`} filter="url(#hm-soft)">
						<circle
							cx={c.x}
							cy={c.y}
							r={7}
							fill={TREE_TONES[i % TREE_TONES.length]}
						/>
					</g>
				);
			})}

			{/* Water: gradient + edge + ripple arcs */}
			{shapes.water.map((ring, i) => {
				const d = toPath(ring, proj);
				return (
					<g key={`wa-${i}`}>
						<path
							d={d}
							fill="url(#hm-water)"
							stroke="#6fa9bd"
							strokeWidth={1.5}
						/>
					</g>
				);
			})}

			{/* Bunkers: sand fill + darker edge */}
			{shapes.bunkers.map((ring, i) => (
				<path
					key={`bk-${i}`}
					d={toPath(ring, proj)}
					fill="var(--color-sand)"
					stroke="#cdbd84"
					strokeWidth={1.5}
					strokeLinejoin="round"
				/>
			))}

			{/* Green: thick soft fringe ring under a radial-gradient putting surface */}
			{shapes.greens.map((ring, i) => {
				const d = toPath(ring, proj);
				return (
					<g key={`gr-${i}`}>
						<path
							d={d}
							fill="none"
							stroke="var(--color-map-green-edge)"
							strokeWidth={9}
							strokeLinejoin="round"
							opacity={0.5}
						/>
						<path d={d} fill="url(#hm-green)" />
					</g>
				);
			})}

			{/* Flag at green center with a shadow ellipse */}
			<ellipse cx={flag.x} cy={flag.y + 3} rx={5} ry={2} fill="#0f3d2a" opacity={0.25} />
			<line
				x1={flag.x}
				y1={flag.y}
				x2={flag.x}
				y2={flag.y - 22}
				stroke="#16241c"
				strokeWidth={1.5}
			/>
			<path
				d={`M${flag.x} ${flag.y - 22} L${flag.x + 12} ${flag.y - 18} L${flag.x} ${flag.y - 14} Z`}
				fill="var(--color-flag)"
			/>
			<circle cx={flag.x} cy={flag.y} r={2.5} fill="#16241c" />
		</g>
	);
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm typecheck && pnpm lint:fix && pnpm check
git add src/components/hole-map/defs.tsx src/components/hole-map/GroundLayer.tsx
git commit -m "feat(hole-map): procedural GroundLayer (rough/fairway/water/bunkers/green/flag)"
```

---

## Task 5: InfoOverlay (distances, ladder, aim, club chip, GPS dot)

**Files:**
- Create: `src/components/hole-map/InfoOverlay.tsx`

- [ ] **Step 1: Implement**

Create `src/components/hole-map/InfoOverlay.tsx`. It renders on top of `GroundLayer`, driven by already-computed distances (the route computes them from `geo`). Aim drag + tap-to-measure pointer handling live in `HoleMap` (Task 6); this component is presentational given `position`/`aim`/`measure` points and distances.

```tsx
import type { Point, Projector } from "./projection";

export interface HazardChip {
	label: string; // e.g. "Water"
	reach: number;
	carry: number;
	point: Point; // screen point to anchor the chip near
}

export function InfoOverlay({
	proj,
	width,
	height,
	position,
	aim,
	greenCenter,
	front,
	center,
	back,
	youToAim,
	aimToGreen,
	clubLabel,
	hazards,
	accuracyM,
	measure,
	measureDist,
}: {
	proj: Projector;
	width: number;
	height: number;
	position: Point;
	aim: Point;
	greenCenter: Point;
	front: number;
	center: number;
	back: number;
	youToAim: number;
	aimToGreen: number;
	clubLabel: string | null;
	hazards: HazardChip[];
	accuracyM: number | null;
	measure: Point | null;
	measureDist: number | null;
}) {
	const arcs = [50, 100, 150, 200, 250].filter(
		(m) => m * proj.scale < Math.hypot(width, height),
	);
	return (
		<g>
			{/* Distance arcs every 50 m from the player */}
			{arcs.map((m) => (
				<g key={`arc-${m}`}>
					<circle
						cx={position.x}
						cy={position.y}
						r={m * proj.scale}
						fill="none"
						stroke="#ffffff"
						strokeOpacity={0.35}
						strokeDasharray="3 6"
					/>
					<text
						x={position.x}
						y={position.y - m * proj.scale}
						dy={-3}
						textAnchor="middle"
						fontSize={9}
						fill="#ffffff"
						opacity={0.7}
					>
						{m}
					</text>
				</g>
			))}

			{/* Shot line: you → aim → green center */}
			<line
				x1={position.x}
				y1={position.y}
				x2={aim.x}
				y2={aim.y}
				stroke="var(--color-flag)"
				strokeWidth={2}
			/>
			<line
				x1={aim.x}
				y1={aim.y}
				x2={greenCenter.x}
				y2={greenCenter.y}
				stroke="#ffffff"
				strokeOpacity={0.5}
				strokeWidth={1.5}
				strokeDasharray="4 4"
			/>

			{/* Aim point: draggable orange dot with halo (drag handled by HoleMap) */}
			<circle cx={aim.x} cy={aim.y} r={13} fill="var(--color-flag)" opacity={0.2} />
			<circle
				cx={aim.x}
				cy={aim.y}
				r={6}
				fill="var(--color-flag)"
				stroke="#fff"
				strokeWidth={2}
			/>
			{/* Split-distance badges: dark below aim (you→aim), white above (aim→green) */}
			<DistanceBadge x={aim.x} y={aim.y + 22} text={`${Math.round(youToAim)} m`} dark />
			<DistanceBadge x={aim.x} y={aim.y - 22} text={`${Math.round(aimToGreen)} m`} />

			{/* Club chip near the aim point */}
			{clubLabel ? (
				<g transform={`translate(${aim.x + 16}, ${aim.y})`}>
					<rect x={0} y={-11} rx={11} width={92} height={22} fill="var(--color-flag)" />
					<text x={46} y={4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
						{clubLabel}
					</text>
				</g>
			) : null}

			{/* Distance ladder overlay top-left: BACK / CENTER / FRONT + hazard carries */}
			<g transform="translate(12, 14)">
				<LadderRow y={0} label="BACK" value={Math.round(back)} />
				<LadderRow y={26} label="CENTER" value={Math.round(center)} highlight />
				<LadderRow y={52} label="FRONT" value={Math.round(front)} />
				{hazards.map((h, i) => (
					<g key={`hz-${i}`} transform={`translate(0, ${84 + i * 20})`}>
						<text fontSize={9} fill="#fff" opacity={0.8}>
							{h.label} {Math.round(h.reach)}–{Math.round(h.carry)} m
						</text>
					</g>
				))}
			</g>

			{/* Tap-to-measure marker */}
			{measure && measureDist !== null ? (
				<g>
					<line
						x1={position.x}
						y1={position.y}
						x2={measure.x}
						y2={measure.y}
						stroke="#16241c"
						strokeOpacity={0.6}
						strokeDasharray="2 4"
					/>
					<circle cx={measure.x} cy={measure.y} r={4} fill="#16241c" />
					<DistanceBadge x={measure.x} y={measure.y - 14} text={`${Math.round(measureDist)} m`} dark />
				</g>
			) : null}

			{/* You-are-here dot with GPS pulse + accuracy halo when >15 m */}
			{accuracyM !== null && accuracyM > 15 ? (
				<circle
					cx={position.x}
					cy={position.y}
					r={accuracyM * proj.scale}
					fill="var(--color-live)"
					opacity={0.12}
				/>
			) : null}
			<circle cx={position.x} cy={position.y} r={7} fill="var(--color-live)" opacity={0.25} />
			<circle cx={position.x} cy={position.y} r={4} fill="var(--color-live)" stroke="#fff" strokeWidth={2} />
		</g>
	);
}

function DistanceBadge({
	x,
	y,
	text,
	dark,
}: {
	x: number;
	y: number;
	text: string;
	dark?: boolean;
}) {
	const w = 8 + text.length * 6.5;
	return (
		<g transform={`translate(${x - w / 2}, ${y - 9})`}>
			<rect rx={9} width={w} height={18} fill={dark ? "#16241c" : "#ffffff"} />
			<text
				x={w / 2}
				y={13}
				textAnchor="middle"
				fontSize={11}
				fontWeight={700}
				fill={dark ? "#ffffff" : "#16241c"}
			>
				{text}
			</text>
		</g>
	);
}

function LadderRow({
	y,
	label,
	value,
	highlight,
}: {
	y: number;
	label: string;
	value: number;
	highlight?: boolean;
}) {
	return (
		<g transform={`translate(0, ${y})`}>
			<text fontSize={9} fill="#ffffff" opacity={0.7} letterSpacing={0.5}>
				{label}
			</text>
			<text
				y={15}
				fontSize={20}
				fontWeight={800}
				fill={highlight ? "var(--color-live)" : "#ffffff"}
			>
				{value}
				<tspan fontSize={10} opacity={0.7}>
					{" "}
					m
				</tspan>
			</text>
		</g>
	);
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck && pnpm lint:fix && pnpm check
git add src/components/hole-map/InfoOverlay.tsx
git commit -m "feat(hole-map): InfoOverlay — arcs, ladder, shot line, aim, club chip, GPS dot"
```

---

## Task 6: HoleMap composition + interaction + variants

**Files:**
- Create: `src/components/hole-map/HoleMap.tsx`

- [ ] **Step 1: Implement**

Create `src/components/hole-map/HoleMap.tsx`. Owns the SVG, builds the `Projector`, wires aim-drag and tap-to-measure via pointer events (converting screen↔LatLng with `unproject`), and switches `map`/`rings`/`bignumbers`.

```tsx
import { useRef, useState } from "react";
import { distancesToGreen, haversineMeters, type LatLng } from "../../domain/geo";
import { HoleMapDefs } from "./defs";
import { GroundLayer } from "./GroundLayer";
import { InfoOverlay, type HazardChip } from "./InfoOverlay";
import { buildProjector, type HoleShapes, type Point } from "./projection";

export type MapVariant = "map" | "rings" | "bignumbers";

const WIDTH = 360;
const HEIGHT = 560;
const PADDING = 28;

function centroid(ring: ReadonlyArray<LatLng>): LatLng {
	const n = ring.length || 1;
	return {
		lat: ring.reduce((t, p) => t + p.lat, 0) / n,
		lng: ring.reduce((t, p) => t + p.lng, 0) / n,
	};
}

export function HoleMap({
	shapes,
	position,
	aim,
	onAimChange,
	clubFor,
	variant,
	accuracyM = null,
}: {
	shapes: HoleShapes;
	position: LatLng;
	aim: LatLng;
	onAimChange: (p: LatLng) => void;
	clubFor: (distanceM: number) => string | null;
	variant: MapVariant;
	accuracyM?: number | null;
}) {
	const svgRef = useRef<SVGSVGElement>(null);
	const [measure, setMeasure] = useState<LatLng | null>(null);
	const dragging = useRef(false);

	const green = shapes.greens[0] ?? [position];
	const greenCenter = centroid(green);
	const tee =
		shapes.tees[0] !== undefined
			? centroid(shapes.tees[0])
			: (shapes.holeLine[0] ?? position);

	const proj = buildProjector({
		tee,
		green: greenCenter,
		features: [
			shapes.holeLine,
			...shapes.fairways,
			...shapes.greens,
			...shapes.bunkers,
			...shapes.water,
			...shapes.tees,
			[position, aim],
		],
		width: WIDTH,
		height: HEIGHT,
		padding: PADDING,
	});

	const svgPointFromEvent = (e: React.PointerEvent): Point => {
		const rect = svgRef.current?.getBoundingClientRect();
		if (!rect) return { x: 0, y: 0 };
		return {
			x: ((e.clientX - rect.left) / rect.width) * WIDTH,
			y: ((e.clientY - rect.top) / rect.height) * HEIGHT,
		};
	};

	const { front, center, back } = distancesToGreen(position, green);
	const youToAim = haversineMeters(position, aim);
	const aimToGreen = haversineMeters(aim, greenCenter);

	const hazards: HazardChip[] = [
		...shapes.water.map((w) => ({ ring: w, label: "Water" })),
		...shapes.bunkers.map((b) => ({ ring: b, label: "Bunker" })),
	]
		.map(({ ring, label }) => {
			const dists = ring.map((p) => haversineMeters(position, p));
			return {
				label,
				reach: Math.min(...dists),
				carry: Math.max(...dists),
				point: proj.project(centroid(ring)),
			};
		})
		.filter((h) => h.carry > 30 && h.reach < back) // only meaningful, in-play hazards
		.sort((a, b) => a.reach - b.reach)
		.slice(0, 3);

	const posPt = proj.project(position);
	const aimPt = proj.project(aim);
	const greenPt = proj.project(greenCenter);

	function onPointerDown(e: React.PointerEvent) {
		const pt = svgPointFromEvent(e);
		if (Math.hypot(pt.x - aimPt.x, pt.y - aimPt.y) < 22) {
			dragging.current = true;
			(e.target as Element).setPointerCapture?.(e.pointerId);
		} else {
			setMeasure(proj.unproject(pt));
		}
	}
	function onPointerMove(e: React.PointerEvent) {
		if (!dragging.current) return;
		onAimChange(proj.unproject(svgPointFromEvent(e)));
	}
	function onPointerUp() {
		dragging.current = false;
	}

	return (
		<svg
			ref={svgRef}
			viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
			className="w-full touch-none select-none rounded-[22px]"
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			role="img"
			aria-label="Hole map"
		>
			<HoleMapDefs />
			<GroundLayer shapes={shapes} green={greenCenter} proj={proj} width={WIDTH} height={HEIGHT} />

			{variant === "rings" ? (
				<g>
					{[100, 150, 200].map((m) => (
						<g key={m}>
							<circle
								cx={posPt.x}
								cy={posPt.y}
								r={m * proj.scale}
								fill="none"
								stroke="#fff"
								strokeOpacity={0.6}
							/>
							<text x={posPt.x + m * proj.scale} y={posPt.y} fontSize={11} fill="#fff">
								{m}
							</text>
						</g>
					))}
					<circle cx={posPt.x} cy={posPt.y} r={4} fill="var(--color-live)" stroke="#fff" strokeWidth={2} />
				</g>
			) : null}

			{variant === "bignumbers" ? (
				<g>
					<rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="#0f3d2a" opacity={0.72} />
					<text x={WIDTH / 2} y={HEIGHT / 2} textAnchor="middle" fontSize={112} fontWeight={800} fill="#fff">
						{Math.round(center)}
					</text>
					<text x={WIDTH / 2} y={HEIGHT / 2 + 44} textAnchor="middle" fontSize={16} fill="#fff" opacity={0.7}>
						CENTER · {Math.round(front)} F / {Math.round(back)} B
					</text>
				</g>
			) : null}

			{variant === "map" ? (
				<InfoOverlay
					proj={proj}
					width={WIDTH}
					height={HEIGHT}
					position={posPt}
					aim={aimPt}
					greenCenter={greenPt}
					front={front}
					center={center}
					back={back}
					youToAim={youToAim}
					aimToGreen={aimToGreen}
					clubLabel={clubFor(youToAim)}
					hazards={hazards}
					accuracyM={accuracyM}
					measure={measure ? proj.project(measure) : null}
					measureDist={measure ? haversineMeters(position, measure) : null}
				/>
			) : null}
		</svg>
	);
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck && pnpm lint:fix && pnpm check
git add src/components/hole-map/HoleMap.tsx
git commit -m "feat(hole-map): HoleMap composition, aim drag, tap-measure, rings/bignumbers"
```

---

## Task 7: clubs query + DEFAULT_BAG

**Files:**
- Create: `convex/clubs.ts`
- Modify: `src/domain/club-suggest.ts`

- [ ] **Step 1: `clubs.list` query**

Create `convex/clubs.ts`:

```ts
import { query } from "./_generated/server";
import { getUserId } from "./lib";

export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getUserId(ctx);
		const clubs = await ctx.db
			.query("clubs")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		return clubs.sort((a, b) => a.sortOrder - b.sortOrder);
	},
});
```

- [ ] **Step 2: `DEFAULT_BAG`**

Append to `src/domain/club-suggest.ts`:

```ts
/** Sensible starter bag in meters, used until Profile bag management (Plan 6). */
export const DEFAULT_BAG: ReadonlyArray<Club> = [
	{ name: "Driver", carryMeters: 230 },
	{ name: "3w", carryMeters: 210 },
	{ name: "5w", carryMeters: 195 },
	{ name: "4i", carryMeters: 180 },
	{ name: "5i", carryMeters: 170 },
	{ name: "6i", carryMeters: 160 },
	{ name: "7i", carryMeters: 150 },
	{ name: "8i", carryMeters: 140 },
	{ name: "9i", carryMeters: 130 },
	{ name: "PW", carryMeters: 120 },
	{ name: "GW", carryMeters: 105 },
	{ name: "SW", carryMeters: 90 },
];
```

- [ ] **Step 3: Codegen, typecheck, commit**

```bash
pnpm exec convex dev --once && pnpm typecheck && pnpm lint:fix && pnpm check
git add convex/clubs.ts convex/_generated src/domain/club-suggest.ts
git commit -m "feat: clubs.list query + DEFAULT_BAG fallback"
```

---

## Task 8: Play route

**Files:**
- Modify: `src/routes/play.tsx` (replace placeholder)

- [ ] **Step 1: Implement the Play screen**

Replace `src/routes/play.tsx` entirely:

```tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { HoleMap, type MapVariant } from "../components/hole-map/HoleMap";
import type { HoleShapes } from "../components/hole-map/projection";
import { DEFAULT_BAG, suggestClub } from "../domain/club-suggest";
import { distancesToGreen, haversineMeters, type LatLng } from "../domain/geo";
import { useGeolocation } from "../hooks/useGeolocation";

export const Route = createFileRoute("/play")({ component: PlayScreen });

const centroid = (ring: ReadonlyArray<LatLng>): LatLng => {
	const n = ring.length || 1;
	return {
		lat: ring.reduce((t, p) => t + p.lat, 0) / n,
		lng: ring.reduce((t, p) => t + p.lng, 0) / n,
	};
};

function PlayScreen() {
	const active = useQuery(api.rounds.active);
	const geometry = useQuery(
		api.courses.get,
		active ? { courseId: active.round.courseId } : "skip",
	);
	const clubs = useQuery(api.clubs.list);
	const setCurrentHole = useMutation(api.rounds.setCurrentHole);

	if (active === undefined) {
		return <Centered>Loading round…</Centered>;
	}
	if (active === null) {
		return (
			<Centered>
				No active round.{" "}
				<Link to="/rounds/new" className="text-live underline">
					Start one
				</Link>
			</Centered>
		);
	}
	return (
		<PlayInner
			active={active}
			geometry={geometry ?? null}
			bag={clubs && clubs.length > 0 ? clubs : DEFAULT_BAG}
			onSetHole={(holeIndex) =>
				setCurrentHole({ roundId: active.round._id, holeIndex })
			}
		/>
	);
}

function PlayInner({
	active,
	geometry,
	bag,
	onSetHole,
}: {
	active: NonNullable<ReturnType<typeof useQuery<typeof api.rounds.active>>>;
	geometry: ReturnType<typeof useQuery<typeof api.courses.get>> | null;
	bag: ReadonlyArray<{ name: string; carryMeters: number }>;
	onSetHole: (holeIndex: number) => void;
}) {
	const navigate = useNavigate();
	const { position: gps, accuracyM } = useGeolocation(true);
	const [variant, setVariant] = useState<MapVariant>("map");

	const idx = active.round.currentHoleIndex ?? 0;
	const ref = active.round.holeRefs[idx];
	const holeMeta = active.holes[idx];
	const geo = geometry?.geometry.find((g) => g.ref === ref);

	const shapes: HoleShapes | null = geo
		? {
				holeLine: geo.holeLine ?? [],
				fairways: geo.fairways,
				greens: geo.greens,
				bunkers: geo.bunkers,
				water: geo.water,
				tees: geo.tees,
			}
		: null;

	const teePos: LatLng | null = shapes
		? shapes.tees[0]
			? centroid(shapes.tees[0])
			: (shapes.holeLine[0] ?? null)
		: null;
	const position = gps ?? teePos;
	const greenCenter =
		shapes && shapes.greens[0] ? centroid(shapes.greens[0]) : null;

	const [aim, setAim] = useState<LatLng | null>(null);
	// Reset aim to green center when the hole changes.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset aim only on hole change
	useEffect(() => {
		setAim(greenCenter);
	}, [ref]);

	const distances =
		position && shapes && shapes.greens[0]
			? distancesToGreen(position, shapes.greens[0])
			: null;

	return (
		<main className="px-4 pt-14 pb-[110px]">
			{/* Header */}
			<header className="flex items-center justify-between">
				<button
					type="button"
					aria-label="Previous hole"
					disabled={idx === 0}
					onClick={() => onSetHole(idx - 1)}
					className="rounded-full bg-pine-light p-2 text-cream disabled:opacity-30"
				>
					<ChevronLeft className="size-5" />
				</button>
				<div className="text-center text-cream">
					<p className="font-display text-3xl font-bold leading-none">
						Hole {idx + 1}
					</p>
					<p className="text-[12px] text-mint-soft">
						Par {holeMeta?.par ?? "—"} · SI {holeMeta?.strokeIndex ?? "—"}
						{holeMeta?.lengthMeters
							? ` · ${Math.round(holeMeta.lengthMeters)} m`
							: ""}
					</p>
				</div>
				<button
					type="button"
					aria-label="Next hole"
					disabled={idx >= active.round.holeRefs.length - 1}
					onClick={() => onSetHole(idx + 1)}
					className="rounded-full bg-pine-light p-2 text-cream disabled:opacity-30"
				>
					<ChevronRight className="size-5" />
				</button>
			</header>

			{/* Variant toggle */}
			<div className="mt-3 flex justify-center gap-1.5">
				{(["map", "rings", "bignumbers"] as const).map((v) => (
					<button
						type="button"
						key={v}
						onClick={() => setVariant(v)}
						className={`rounded-full px-3 py-1 font-display text-[11px] font-semibold uppercase tracking-wide ${
							variant === v ? "bg-live text-white" : "bg-pine-light text-mint-soft"
						}`}
					>
						{v === "bignumbers" ? "Big" : v}
					</button>
				))}
			</div>

			{/* Map */}
			<div className="mt-3">
				{shapes && position && greenCenter && aim ? (
					<HoleMap
						shapes={shapes}
						position={position}
						aim={aim}
						onAimChange={setAim}
						clubFor={(d) => suggestClub(bag, d)?.name ?? null}
						variant={variant}
						accuracyM={accuracyM}
					/>
				) : (
					<SchematicFallback
						par={holeMeta?.par}
						lengthMeters={holeMeta?.lengthMeters}
					/>
				)}
			</div>

			{/* F/C/B chips */}
			{distances ? (
				<div className="mt-3 grid grid-cols-3 gap-2">
					<Chip label="Front" value={Math.round(distances.front)} />
					<Chip label="Center" value={Math.round(distances.center)} accent />
					<Chip label="Back" value={Math.round(distances.back)} />
				</div>
			) : null}

			{/* GPS status */}
			<p className="mt-2 text-center text-[11px] text-mint-soft">
				{gps
					? accuracyM && accuracyM > 15
						? `GPS ±${Math.round(accuracyM)} m`
						: "GPS locked"
					: "No GPS — distances from the tee"}
			</p>

			{/* Enter score CTA */}
			<button
				type="button"
				onClick={() => navigate({ to: "/card" })}
				className="mt-5 w-full rounded-full bg-flag px-6 py-4 font-display text-[15px] font-bold text-white shadow-lg shadow-flag/25"
			>
				Enter score for hole {idx + 1}
			</button>
		</main>
	);
}

function Centered({ children }: { children: React.ReactNode }) {
	return (
		<main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center text-[14px] text-mint-soft">
			{children}
		</main>
	);
}

function Chip({
	label,
	value,
	accent,
}: {
	label: string;
	value: number;
	accent?: boolean;
}) {
	return (
		<div
			className={`rounded-2xl px-3 py-2 text-center ${accent ? "bg-live text-white" : "bg-pine-light text-cream"}`}
		>
			<p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p>
			<p className="font-display text-2xl font-bold">
				{value}
				<span className="text-[11px] opacity-70"> m</span>
			</p>
		</div>
	);
}

function SchematicFallback({
	par,
	lengthMeters,
}: {
	par?: number;
	lengthMeters?: number;
}) {
	return (
		<div className="flex h-[320px] flex-col items-center justify-center rounded-[22px] bg-pine-light text-center text-mint-soft">
			<p className="font-display text-lg font-bold text-cream">
				No map for this hole
			</p>
			<p className="mt-1 text-[12px]">
				Par {par ?? "—"}
				{lengthMeters ? ` · ${Math.round(lengthMeters)} m` : ""}
			</p>
			<p className="mt-1 text-[11px] opacity-70">Geometry incomplete in OSM.</p>
		</div>
	);
}
```

> The Play screen background: the root shell paints cream. The Play screen is the app's one dark surface (spec §3 "dark-on-course"). Wrap in a dark section — if the current `__root.tsx` frame forces cream, add `bg-pine` to this `main` (e.g. `className="... bg-pine min-h-screen -mt-... "` matched to the shell) during the code-quality review so the Play screen reads dark per the comp. Verify against the comp.

- [ ] **Step 2: Route-gen, typecheck, lint, build**

Run: `pnpm generate-routes && pnpm typecheck && pnpm lint:fix && pnpm check && pnpm build`
Expected: all exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/routes/play.tsx src/routeTree.gen.ts
git commit -m "feat(ui): Play screen — hole map, GPS, F/C/B chips, variants, score CTA"
```

---

## Task 9: Full verification gate + browser QA (mocked GPS)

**Files:** none (verification only)

- [ ] **Step 1: Regenerate + drift**

Run: `pnpm exec convex codegen && pnpm generate-routes && git status --short`
Expected: no drift (commit any that appears).

- [ ] **Step 2: Four gates**

- `pnpm check` → 0
- `pnpm typecheck` → 0
- `pnpm test` → all suites pass (Plans 1–3 + `projection` + geo axis test)
- `pnpm build` → 0

- [ ] **Step 3: Browser QA with mocked geolocation**

Launch `preview_start({name:"All (dev:watch)"})`; ensure both courses are seeded and an 18-hole round is active (start one via `/rounds/new` if needed). Open `/play`. Drive with `javascript_tool` (per [[golf-app-verification-infra]]):

1. **Tee fallback:** with no GPS, assert the map renders and F/C/B chips show numbers, and the status reads "No GPS — distances from the tee".
2. **Mock a GPS fix on the current hole** — override `navigator.geolocation.watchPosition` to invoke its success callback with a coordinate ~150 m short of the green (compute from the hole's green center via the fixture, or nudge the tee toward the green), then assert: the you-are-here dot moves, the ladder/chips update, and status flips to "GPS locked".
3. **Aim drag:** dispatch pointer events on the SVG to drag the aim point; assert the two split-distance badges and the club chip update.
4. **Variants:** click Rings and Big — assert the rings circles / 112 px center number render.
5. **Prev/Next:** advance the hole; assert the header and map change and aim resets to green center.
6. **Schematic fallback:** navigate to a hole whose ref has no geometry (if any) — assert the "No map for this hole" card.

Capture the readable outcomes (innerText of ladder/chips) as proof. Note anything visually off against the Fairway comp for a follow-up polish pass.

- [ ] **Step 4: Secrets scan + wrap**

Run: `git log --oneline` over the plan range + `git status`; confirm no `.env*`, keys, or tokens. (Geolocation + Overpass need no keys; map is client-only.)

---

## Self-review checklist (run after execution)

1. **Spec §6 style layers:** rough gradient · semi-rough (via rough radial) · fairway mow stripes (~10°) + edge · tree canopies (optional, 3 tones, shadow) · water gradient + edge (+ripples: add in polish) · bunkers sand+edge · green fringe ring + radial + flag with shadow — all present in `GroundLayer` ✓ (ripple arcs flagged for the polish pass).
2. **Spec §6 info layer:** distance arcs every 50 m · ladder BACK/CENTER/FRONT (center highlighted) + hazard carries · shot line you→aim→green with split badges (dark below / white above) · club chip · tap-to-measure · you-are-here + accuracy halo — all in `InfoOverlay`/`HoleMap` ✓.
3. **Spec §6 variants:** Rings (100/150/200) + Big numbers (112 px) ✓.
4. **Spec §5/§8 GPS:** watchPosition · tee fallback · poor-accuracy halo never hides the number ✓. **Auto-advance corridor detection is NOT built in this plan** — deferred to the Welderen field-test plan (Plan 6/8): tuning a "you've entered the next hole's corridor" threshold needs real GPS noise to validate against, and this plan's QA only had mocked positions to test with. Building it now risks a wrong threshold that has to be re-tuned anyway once real field data is available.
5. **Layer-agnostic:** `GroundLayer` + `InfoOverlay` both take a `Projector`; a satellite tile can slide under `GroundLayer` in v2 ✓.
6. **Type consistency:** `HoleShapes`/`Projector`/`Point`/`MapVariant` identical across projection, GroundLayer, InfoOverlay, HoleMap, play route ✓.
7. **No placeholders / no secrets** ✓.

## Known deferrals (carried forward)

- **Auto-advance to the next hole** (position-enters-corridor, dismissible) — decided during execution: deferred to the Welderen field-test plan (Plan 6/8), see self-review item 4 above.
- **Water ripple arcs & richer tree clustering** — first-pass GroundLayer is clean but not fully comp-polished; refine in the code-quality review and the field-test polish list.
- **Tree canopies** need a `natural=wood`/`tree` Overpass import pass (Plan 2 deferral); `GroundLayer` renders them for free once `geometry.trees` is populated.
- **m/yd toggle** — meters hardcoded; the `formatDistance` seam + Profile toggle land in Plan 6.
- **Real club bag** — `DEFAULT_BAG` fallback now; Profile bag CRUD in Plan 6.
- **True on-course GPS accuracy + auto-advance behaviour** — validated only with mocked positions here; real validation is the Welderen field test (Plan 8).
```
