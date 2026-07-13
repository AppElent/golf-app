# Home, Progress & Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the three placeholder screens (Home, Progress, Profile) into real stat surfaces over stored rounds, add user settings + club-bag CRUD, and introduce a meters/yards formatting seam.

**Architecture:** Three pure domain additions (`format`, `stats`, a running would-be-index history) feed a small set of Convex read/write functions (`settings` get/update, `clubs` CRUD, `rounds.history`). The three routes compose those with a shared `Sparkline` component. Distances in the new surfaces render through `formatDistance(meters, units)` so the Profile units toggle is functional day one.

**Tech Stack:** TanStack Start (React 19, file routes), Convex (queries/mutations), Tailwind v4 (Fairway tokens), Vitest, Biome (tabs + double quotes). Package manager: **pnpm**.

**Build-order context:** This is step 6 of spec §10 (`docs/superpowers/specs/2026-07-08-golf-companion-v1-design.md`). Plans 1–4 shipped the design system, domain modules, course data, round setup + scorecard, and the Play screen. Finished rounds already stamp `totals` (strokes + Stableford points per player) and `scoreDifferential` (owner, null if the round had NR / wasn't a clean 18) — see `convex/rounds.ts` `finish`. This plan reads that stored data; it does not change scoring or the finish flow.

**Conventions (match existing code):**
- Biome: **tabs** for indent, **double quotes**, semicolons. Run `pnpm lint:fix` before every commit.
- React list keys must be stable and derived from data, never the array index (Biome `noArrayIndexKey` is an error). Existing code uses `crypto.randomUUID()` for drafts and data-derived keys (e.g. `club._id`) for stored rows.
- Domain modules under `src/domain/` have **zero framework imports** and dense Vitest tests.
- `getUserId(ctx)` from `convex/lib.ts` returns `identity?.subject ?? "local-dev"` and works in both queries and mutations (already used that way in `convex/rounds.ts`).
- Convex codegen: after adding/removing a Convex function, run `pnpm exec convex dev --once` (pushes AND registers) — `pnpm exec convex codegen` alone only regenerates types. This targets the cloud dev deployment via `.env.local` (do not read `.env.local`; it is permission-blocked).
- Colors/fonts: use Fairway tokens from `src/styles.css` via Tailwind classes (`text-ink`, `bg-pine`, `text-live`, `font-display`, etc.). Light screens (Home/Progress/Profile) use the cream shell painted by `src/routes/__root.tsx`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/domain/format.ts` | `metersToYards`, `formatDistance(meters, units)` — the units seam. Pure. |
| `src/domain/format.test.ts` | Unit tests for the formatter. |
| `src/domain/stats.ts` | `aggregateStats(rounds)` — avg score / vs par / putts-per-18 / FIR% / GIR% over round summaries. Pure. |
| `src/domain/stats.test.ts` | Unit tests for the aggregator. |
| `src/domain/handicap.ts` | Extend with `wouldBeIndexHistory(differentials)` — running would-be index for the sparkline + delta. |
| `src/domain/handicap.test.ts` | Extend with tests for the new function. |
| `convex/settings.ts` | `get` (with defaults) + `update` (upsert) for `userSettings`. |
| `convex/clubs.ts` | Extend `list` with `create`, `update`, `remove`, `reorder`. |
| `convex/rounds.ts` | Extend with `history` query — finished rounds with a computed owner summary. |
| `src/components/Sparkline.tsx` | Tiny inline-SVG sparkline, shared by Home + Progress. |
| `src/routes/index.tsx` | Home — greeting, handicap hero + sparkline + delta, Start-a-round CTA, last-round card, club strip. |
| `src/routes/progress.tsx` | Progress — would-be trend, avg score, putts, FIR/GIR, club distance list. |
| `src/routes/profile.tsx` | Profile — handicap entry, units toggle, home course, club bag CRUD. |

---

## Task 1: `format` domain module (TDD)

**Files:**
- Create: `src/domain/format.ts`
- Test: `src/domain/format.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/domain/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatDistance, metersToYards } from "./format";

describe("metersToYards", () => {
	it("converts with the standard 1.09361 factor", () => {
		expect(metersToYards(100)).toBeCloseTo(109.361, 2);
	});
});

describe("formatDistance", () => {
	it("rounds meters and appends the unit", () => {
		expect(formatDistance(149.6, "m")).toBe("150 m");
	});

	it("converts to yards when units are yd", () => {
		expect(formatDistance(150, "yd")).toBe("164 yd");
	});

	it("shows an em dash for null", () => {
		expect(formatDistance(null, "m")).toBe("—");
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run src/domain/format.test.ts`
Expected: FAIL — `./format` not found.

- [ ] **Step 3: Implement**

Create `src/domain/format.ts`:

```ts
export type Units = "m" | "yd";

const YARDS_PER_METER = 1.09361;

export function metersToYards(meters: number): number {
	return meters * YARDS_PER_METER;
}

/** Human distance in the chosen units. `null` → em dash. */
export function formatDistance(
	meters: number | null | undefined,
	units: Units,
): string {
	if (meters == null) return "—";
	const value = units === "yd" ? metersToYards(meters) : meters;
	return `${Math.round(value)} ${units}`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm exec vitest run src/domain/format.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix && pnpm check && pnpm typecheck
git add src/domain/format.ts src/domain/format.test.ts
git commit -m "feat(domain): formatDistance meters/yards seam"
```

---

## Task 2: `wouldBeIndexHistory` (TDD)

**Files:**
- Modify: `src/domain/handicap.ts`
- Modify: `src/domain/handicap.test.ts`

The existing `wouldBeIndex(differentials)` returns a single number (best 8 of 20, small-sample table) or `null`. The Home hero and Progress trend need the index *after each round* to draw a sparkline and compute a delta. Add a helper that maps a chronological differential series to the running index after each round.

- [ ] **Step 1: Add a failing test**

Append to `src/domain/handicap.test.ts` (create a new `describe` block; do not modify existing tests):

```ts
import { wouldBeIndexHistory } from "./handicap";

describe("wouldBeIndexHistory", () => {
	it("is empty until three differentials exist", () => {
		expect(wouldBeIndexHistory([])).toEqual([]);
		expect(wouldBeIndexHistory([10, 12])).toEqual([]);
	});

	it("emits the running index from the third round on", () => {
		const history = wouldBeIndexHistory([20, 18, 22, 16]);
		// One point per round once >= 3 differentials are available.
		expect(history).toHaveLength(2);
		// Each entry matches wouldBeIndex over that prefix.
		expect(history[0]).toBe(wouldBeIndex([20, 18, 22]));
		expect(history[1]).toBe(wouldBeIndex([20, 18, 22, 16]));
	});
});
```

Note: `wouldBeIndex` is already imported at the top of `handicap.test.ts`; if not, add it to the existing import from `./handicap`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run src/domain/handicap.test.ts`
Expected: FAIL — `wouldBeIndexHistory` is not exported.

- [ ] **Step 3: Implement**

Append to `src/domain/handicap.ts`:

```ts
/**
 * Running would-be index after each round, oldest first. Emits one entry per
 * round once at least three differentials are available (before that WHS has no
 * index). Nulls are filtered — every entry is a real number for the sparkline.
 */
export function wouldBeIndexHistory(
	differentials: ReadonlyArray<number>,
): number[] {
	const history: number[] = [];
	for (let i = 3; i <= differentials.length; i++) {
		const index = wouldBeIndex(differentials.slice(0, i));
		if (index !== null) history.push(index);
	}
	return history;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm exec vitest run src/domain/handicap.test.ts`
Expected: PASS (existing tests + 2 new).

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix && pnpm check && pnpm typecheck
git add src/domain/handicap.ts src/domain/handicap.test.ts
git commit -m "feat(domain): running would-be index history for the trend sparkline"
```

---

## Task 3: `stats` domain module (TDD)

**Files:**
- Create: `src/domain/stats.ts`
- Test: `src/domain/stats.test.ts`

Aggregates owner stats across finished-round summaries. Rate-based where a 9/18 mix would otherwise distort: FIR% and GIR% are pooled over holes; putts normalise to a per-18 figure; avg score / vs par count only 18-hole rounds (the comparable case), and are `null` when there are none.

- [ ] **Step 1: Write failing tests**

Create `src/domain/stats.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { aggregateStats, type RoundStatInput } from "./stats";

const round = (over: Partial<RoundStatInput> = {}): RoundStatInput => ({
	holeCount: 18,
	strokes: 90,
	vsPar: 18,
	putts: 34,
	holesWithPutts: 18,
	firMade: 8,
	firEligible: 14,
	girMade: 6,
	girHoles: 18,
	...over,
});

describe("aggregateStats", () => {
	it("returns nulls for an empty history", () => {
		expect(aggregateStats([])).toEqual({
			rounds: 0,
			avgScore: null,
			avgVsPar: null,
			puttsPer18: null,
			firPct: null,
			girPct: null,
		});
	});

	it("averages 18-hole scores and pools rate stats", () => {
		const s = aggregateStats([
			round({ strokes: 90, vsPar: 18, firMade: 7, girMade: 6 }),
			round({ strokes: 84, vsPar: 12, firMade: 9, girMade: 8 }),
		]);
		expect(s.rounds).toBe(2);
		expect(s.avgScore).toBe(87);
		expect(s.avgVsPar).toBe(15);
		// FIR pooled: (7 + 9) / (14 + 14) = 0.571..
		expect(s.firPct).toBeCloseTo(0.5714, 3);
		// GIR pooled: (6 + 8) / (18 + 18) = 0.388..
		expect(s.girPct).toBeCloseTo(0.3889, 3);
		// Putts per 18: (34 + 34) / (18 + 18) * 18 = 34
		expect(s.puttsPer18).toBe(34);
	});

	it("excludes 9-hole rounds from avg score but keeps their rate stats", () => {
		const s = aggregateStats([
			round({ holeCount: 18, strokes: 90, vsPar: 18 }),
			round({
				holeCount: 9,
				strokes: 46,
				vsPar: 10,
				putts: 17,
				holesWithPutts: 9,
				firEligible: 7,
				girHoles: 9,
				firMade: 4,
				girMade: 3,
			}),
		]);
		expect(s.avgScore).toBe(90); // only the 18-hole round
		expect(s.firPct).toBeCloseTo((8 + 4) / (14 + 7), 4);
	});

	it("ignores rounds with no putts recorded in the putts figure", () => {
		const s = aggregateStats([
			round({ putts: null, holesWithPutts: 0 }),
		]);
		expect(s.puttsPer18).toBeNull();
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run src/domain/stats.test.ts`
Expected: FAIL — `./stats` not found.

- [ ] **Step 3: Implement**

Create `src/domain/stats.ts`:

```ts
export interface RoundStatInput {
	holeCount: number;
	strokes: number; // owner total strokes (nulls counted 0 upstream)
	vsPar: number; // owner vs par for the round
	putts: number | null; // total putts, null if none recorded
	holesWithPutts: number; // holes that had a putt value
	firMade: number;
	firEligible: number; // non-par-3 holes with a FIR value recorded
	girMade: number;
	girHoles: number; // holes with a GIR value recorded
}

export interface AggregateStats {
	rounds: number;
	avgScore: number | null; // mean strokes over 18-hole rounds
	avgVsPar: number | null; // mean vs par over 18-hole rounds
	puttsPer18: number | null; // pooled putts/hole × 18
	firPct: number | null; // pooled fairways hit
	girPct: number | null; // pooled greens in regulation
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

const ratio = (made: number, total: number): number | null =>
	total > 0 ? made / total : null;

export function aggregateStats(
	rounds: ReadonlyArray<RoundStatInput>,
): AggregateStats {
	const full = rounds.filter((r) => r.holeCount === 18);
	const avgScore =
		full.length > 0
			? round1(full.reduce((t, r) => t + r.strokes, 0) / full.length)
			: null;
	const avgVsPar =
		full.length > 0
			? round1(full.reduce((t, r) => t + r.vsPar, 0) / full.length)
			: null;

	const puttHoles = rounds.reduce((t, r) => t + r.holesWithPutts, 0);
	const puttTotal = rounds.reduce((t, r) => t + (r.putts ?? 0), 0);
	const puttsPer18 = puttHoles > 0 ? round1((puttTotal / puttHoles) * 18) : null;

	return {
		rounds: rounds.length,
		avgScore,
		avgVsPar,
		puttsPer18,
		firPct: ratio(
			rounds.reduce((t, r) => t + r.firMade, 0),
			rounds.reduce((t, r) => t + r.firEligible, 0),
		),
		girPct: ratio(
			rounds.reduce((t, r) => t + r.girMade, 0),
			rounds.reduce((t, r) => t + r.girHoles, 0),
		),
	};
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm exec vitest run src/domain/stats.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix && pnpm check && pnpm typecheck
git add src/domain/stats.ts src/domain/stats.test.ts
git commit -m "feat(domain): round-stats aggregation (avg score, putts/18, FIR%, GIR%)"
```

---

## Task 4: `settings` Convex functions

**Files:**
- Create: `convex/settings.ts`

`userSettings` already exists in `convex/schema.ts` with `userId`, `units` (`"m"`/`"yd"`), `homeCourseId?`, `handicapIndex?` and a `by_user` index. Provide a defaulted read and an upserting write.

- [ ] **Step 1: Implement**

Create `convex/settings.ts`:

```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserId } from "./lib";

/** Current user's settings, with defaults when no row exists yet. */
export const get = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getUserId(ctx);
		const row = await ctx.db
			.query("userSettings")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.first();
		return {
			units: row?.units ?? ("m" as const),
			homeCourseId: row?.homeCourseId ?? null,
			handicapIndex: row?.handicapIndex ?? null,
		};
	},
});

/** Upsert any subset of the user's settings. */
export const update = mutation({
	args: {
		units: v.optional(v.union(v.literal("m"), v.literal("yd"))),
		homeCourseId: v.optional(v.union(v.id("courses"), v.null())),
		handicapIndex: v.optional(v.union(v.number(), v.null())),
	},
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);
		const existing = await ctx.db
			.query("userSettings")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.first();

		// null clears an optional field; undefined leaves it unchanged.
		const patch: {
			units?: "m" | "yd";
			homeCourseId?: import("./_generated/dataModel").Id<"courses"> | undefined;
			handicapIndex?: number | undefined;
		} = {};
		if (args.units !== undefined) patch.units = args.units;
		if (args.homeCourseId !== undefined)
			patch.homeCourseId = args.homeCourseId ?? undefined;
		if (args.handicapIndex !== undefined)
			patch.handicapIndex = args.handicapIndex ?? undefined;

		if (existing) {
			await ctx.db.patch(existing._id, patch);
			return existing._id;
		}
		return await ctx.db.insert("userSettings", {
			userId,
			units: patch.units ?? "m",
			homeCourseId: patch.homeCourseId,
			handicapIndex: patch.handicapIndex,
		});
	},
});
```

- [ ] **Step 2: Register + typecheck**

Run: `pnpm exec convex dev --once` (filter warnings if noisy: append `2>&1 | grep -vi "warn\|minimum"`), then `pnpm typecheck`.
Expected: Convex reports "functions ready"; tsc exits 0.

- [ ] **Step 3: Smoke-test via CLI**

```bash
pnpm exec convex run settings:get '{}'
pnpm exec convex run settings:update '{"handicapIndex": 18, "units": "m"}'
pnpm exec convex run settings:get '{}'
```
Expected: first `get` shows defaults (`handicapIndex: null`); after `update`, `get` shows `handicapIndex: 18`.

- [ ] **Step 4: Commit**

```bash
pnpm lint:fix && pnpm check
git add convex/settings.ts convex/_generated
git commit -m "feat(convex): userSettings get (defaulted) + update (upsert)"
```

---

## Task 5: club-bag CRUD mutations

**Files:**
- Modify: `convex/clubs.ts`

`convex/clubs.ts` currently exports only `list` (sorted by `sortOrder`). Add create/update/remove/reorder. Reorder takes the full ordered id list and rewrites `sortOrder` — atomic and free of index-math bugs.

- [ ] **Step 1: Implement**

Append to `convex/clubs.ts` (keep the existing `list` export and its imports; add `v` and `mutation` to the imports):

```ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";

/** Add a club to the end of the bag. */
export const create = mutation({
	args: { name: v.string(), carryMeters: v.number() },
	handler: async (ctx, { name, carryMeters }) => {
		const userId = await getUserId(ctx);
		const existing = await ctx.db
			.query("clubs")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		const sortOrder =
			existing.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;
		return await ctx.db.insert("clubs", {
			userId,
			name,
			carryMeters,
			sortOrder,
		});
	},
});

/** Edit a club's name and/or carry distance. */
export const update = mutation({
	args: {
		clubId: v.id("clubs"),
		name: v.optional(v.string()),
		carryMeters: v.optional(v.number()),
	},
	handler: async (ctx, { clubId, name, carryMeters }) => {
		const userId = await getUserId(ctx);
		const club = await ctx.db.get(clubId);
		if (!club || club.userId !== userId) throw new Error("Club not found.");
		const patch: { name?: string; carryMeters?: number } = {};
		if (name !== undefined) patch.name = name;
		if (carryMeters !== undefined) patch.carryMeters = carryMeters;
		await ctx.db.patch(clubId, patch);
	},
});

/** Delete a club. */
export const remove = mutation({
	args: { clubId: v.id("clubs") },
	handler: async (ctx, { clubId }) => {
		const userId = await getUserId(ctx);
		const club = await ctx.db.get(clubId);
		if (!club || club.userId !== userId) throw new Error("Club not found.");
		await ctx.db.delete(clubId);
	},
});

/** Rewrite sort order from a full ordered id list (owner's clubs only). */
export const reorder = mutation({
	args: { orderedIds: v.array(v.id("clubs")) },
	handler: async (ctx, { orderedIds }) => {
		const userId = await getUserId(ctx);
		await Promise.all(
			orderedIds.map(async (id, i) => {
				const club = await ctx.db.get(id);
				if (!club || club.userId !== userId) throw new Error("Club not found.");
				await ctx.db.patch(id, { sortOrder: i });
			}),
		);
	},
});
```

- [ ] **Step 2: Register + typecheck**

Run: `pnpm exec convex dev --once` then `pnpm typecheck`.
Expected: functions ready; tsc exits 0.

- [ ] **Step 3: Smoke-test via CLI**

```bash
pnpm exec convex run clubs:create '{"name": "7i", "carryMeters": 150}'
pnpm exec convex run clubs:list '{}'
```
Expected: `list` returns the created club with `sortOrder: 0`.

- [ ] **Step 4: Commit**

```bash
pnpm lint:fix && pnpm check
git add convex/clubs.ts convex/_generated
git commit -m "feat(convex): club-bag create/update/remove/reorder"
```

---

## Task 6: `rounds.history` query

**Files:**
- Modify: `convex/rounds.ts`

A single query that returns finished rounds newest-first, each with a computed owner summary rich enough for Home's last-round card and Progress's aggregation. Reuses the domain scoring helpers already imported in `rounds.ts` (`totalStrokes`, `vsPar`). It recomputes from `holeScores` per round (cheap at personal scale, and correct for rounds finished before this query existed).

- [ ] **Step 1: Confirm existing imports**

`convex/rounds.ts` already imports from `../src/domain/scoring` (used by `finish`). Verify the import line includes `totalStrokes` and `vsPar`; if `vsPar` is missing, add it:

Run: `grep -n "domain/scoring" convex/rounds.ts`
Expected: a line like `import { ... totalStrokes, vsPar ... } from "../src/domain/scoring";`. Add `vsPar` to that import if absent.

- [ ] **Step 2: Implement the query**

Append to `convex/rounds.ts`:

```ts
/**
 * Finished rounds, newest first, with a computed owner (playerIndex 0) summary.
 * `limit` defaults to 20 (spec §5 window). Distances/scoring recomputed from
 * holeScores so rounds finished before this query still get full stats.
 */
export const history = query({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, { limit }) => {
		const userId = await getUserId(ctx);
		const rounds = await ctx.db
			.query("rounds")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.filter((q) => q.eq(q.field("status"), "finished"))
			.collect();
		rounds.sort((a, b) => b.startedAt - a.startedAt);
		const recent = rounds.slice(0, limit ?? 20);

		const courseNames = new Map<string, string>();

		const summaries = await Promise.all(
			recent.map(async (round) => {
				let courseName = courseNames.get(round.courseId);
				if (courseName === undefined) {
					const course = await ctx.db.get(round.courseId);
					courseName = course?.name ?? "Unknown course";
					courseNames.set(round.courseId, courseName);
				}

				const courseHoles = await ctx.db
					.query("holes")
					.withIndex("by_course", (q) => q.eq("courseId", round.courseId))
					.collect();
				const byRef = new Map(courseHoles.map((h) => [h.ref, h]));
				const holes = round.holeRefs.map((ref) => {
					const hole = byRef.get(ref);
					return {
						par: hole?.par ?? 0,
						strokeIndex: hole?.strokeIndex ?? 0,
						isPar3: (hole?.par ?? 0) === 3,
					};
				});

				const scores = await ctx.db
					.query("holeScores")
					.withIndex("by_round", (q) => q.eq("roundId", round._id))
					.collect();
				const ownerScore = (holeIndex: number) =>
					scores.find(
						(s) => s.holeIndex === holeIndex && s.playerIndex === 0,
					);

				const strokes = holes.map((_, i) => {
					const s = ownerScore(i);
					return s?.nr ? null : (s?.strokes ?? null);
				});

				let putts = 0;
				let holesWithPutts = 0;
				let firMade = 0;
				let firEligible = 0;
				let girMade = 0;
				let girHoles = 0;
				holes.forEach((hole, i) => {
					const s = ownerScore(i);
					if (s?.putts !== undefined) {
						putts += s.putts;
						holesWithPutts += 1;
					}
					if (!hole.isPar3 && s?.fir !== undefined) {
						firEligible += 1;
						if (s.fir) firMade += 1;
					}
					if (s?.gir !== undefined) {
						girHoles += 1;
						if (s.gir) girMade += 1;
					}
				});

				return {
					_id: round._id,
					startedAt: round.startedAt,
					courseName,
					loopLabel: round.loopLabel ?? null,
					format: round.format,
					holeCount: round.holeRefs.length,
					differential: round.scoreDifferential ?? null,
					owner: {
						strokes: totalStrokes(strokes),
						vsPar: vsPar(holes, strokes),
						putts: holesWithPutts > 0 ? putts : null,
						holesWithPutts,
						firMade,
						firEligible,
						girMade,
						girHoles,
					},
				};
			}),
		);

		return summaries;
	},
});
```

- [ ] **Step 3: Register + typecheck**

Run: `pnpm exec convex dev --once` then `pnpm typecheck`.
Expected: functions ready; tsc exits 0.

- [ ] **Step 4: Smoke-test via CLI**

```bash
pnpm exec convex run rounds:history '{}'
```
Expected: a JSON array (possibly empty if no finished rounds yet). If the current active round is later finished via the scorecard, it will appear here.

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix && pnpm check
git add convex/rounds.ts convex/_generated
git commit -m "feat(convex): rounds.history — finished rounds with owner stat summary"
```

---

## Task 7: `Sparkline` component

**Files:**
- Create: `src/components/Sparkline.tsx`

A minimal inline-SVG line, shared by Home (would-be trend) and Progress. No axes — just a smooth polyline fit to a small box, with a dot on the last point. Renders nothing for fewer than two points.

- [ ] **Step 1: Implement**

Create `src/components/Sparkline.tsx`:

```tsx
export function Sparkline({
	values,
	width = 120,
	height = 36,
	stroke = "var(--color-mint)",
}: {
	values: ReadonlyArray<number>;
	width?: number;
	height?: number;
	stroke?: string;
}) {
	if (values.length < 2) return null;
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min || 1;
	const pad = 3;
	const stepX = (width - pad * 2) / (values.length - 1);
	const points = values.map((v, i) => {
		const x = pad + i * stepX;
		// Lower index = better handicap → draw it higher on screen (invert y).
		const y = pad + (height - pad * 2) * ((v - min) / span);
		return { x, y };
	});
	const d = points
		.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
		.join(" ");
	const last = points[points.length - 1];
	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			fill="none"
			role="img"
			aria-label="Trend"
		>
			<path
				d={d}
				stroke={stroke}
				strokeWidth={2}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<circle cx={last.x} cy={last.y} r={2.5} fill={stroke} />
		</svg>
	);
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck && pnpm lint:fix && pnpm check
git add src/components/Sparkline.tsx
git commit -m "feat(ui): Sparkline component for handicap trend"
```

---

## Task 8: Home screen

**Files:**
- Modify: `src/routes/index.tsx` (replace the placeholder body)

Compose: greeting, handicap hero (manual index big number + would-be sparkline + delta), Start-a-round CTA (subtitle = most-played course when known), last-round card, club yardages strip. Distances render through `formatDistance(_, units)`.

- [ ] **Step 1: Replace the route**

Replace the entire contents of `src/routes/index.tsx`:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Sparkline } from "../components/Sparkline";
import { formatDistance } from "../domain/format";
import { wouldBeIndexHistory } from "../domain/handicap";
import { formatVsPar } from "../domain/scoring";

export const Route = createFileRoute("/")({ component: HomeScreen });

function HomeScreen() {
	const settings = useQuery(api.settings.get);
	const history = useQuery(api.rounds.history, { limit: 20 });
	const clubs = useQuery(api.clubs.list);

	const units = settings?.units ?? "m";
	const rounds = history ?? [];
	const last = rounds[0] ?? null;

	// Would-be trend from differentials, chronological (oldest first).
	const differentials = [...rounds]
		.reverse()
		.map((r) => r.differential)
		.filter((d): d is number => d !== null);
	const trend = wouldBeIndexHistory(differentials);
	const delta =
		trend.length >= 2 ? trend[trend.length - 1] - trend[trend.length - 2] : null;

	// Most-played course for the CTA subtitle.
	const counts = new Map<string, number>();
	for (const r of rounds) counts.set(r.courseName, (counts.get(r.courseName) ?? 0) + 1);
	const mostPlayed =
		[...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

	const heroIndex =
		settings?.handicapIndex ??
		(trend.length > 0 ? trend[trend.length - 1] : null);

	return (
		<main className="px-5 pt-16 pb-[110px]">
			<div className="mb-6 flex items-center justify-between">
				<div>
					<p className="text-[13px] font-medium text-moss">Welcome back</p>
					<h1 className="font-display text-[22px] font-bold tracking-tight text-ink">
						Fairway
					</h1>
				</div>
				<Link
					to="/profile"
					className="flex h-11 w-11 items-center justify-center rounded-full bg-pine font-display text-base font-bold text-cream"
				>
					EJ
				</Link>
			</div>

			{/* Handicap hero */}
			<section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-pine-light to-pine p-6 text-[#eaf2e9] shadow-[0_18px_40px_-22px_rgba(15,61,42,0.9)]">
				<div className="pointer-events-none absolute -top-8 -right-8 h-36 w-36 rounded-full bg-live/15" />
				<div className="flex items-start justify-between">
					<div>
						<p className="text-[12.5px] font-semibold tracking-[0.14em] uppercase opacity-70">
							Handicap Index
						</p>
						<p className="mt-1 font-display text-[56px] leading-none font-bold tracking-tight">
							{heroIndex !== null ? heroIndex.toFixed(1) : "—"}
						</p>
						<p className="mt-2 text-[12.5px] opacity-65">
							{delta !== null
								? `${delta <= 0 ? "▾" : "▴"} ${Math.abs(delta).toFixed(1)} vs last round`
								: "Play three rounds to see your trend"}
						</p>
					</div>
					<div className="pt-2">
						<Sparkline values={trend} />
					</div>
				</div>
			</section>

			{/* Start a round */}
			<Link
				to="/rounds/new"
				className="mt-4 flex items-center justify-between rounded-[22px] bg-flag px-6 py-4 shadow-[0_14px_30px_-16px_rgba(224,83,47,0.9)]"
			>
				<span>
					<span className="block font-display text-lg font-bold text-white">
						Start a round
					</span>
					<span className="block text-[13px] text-white/80">
						{mostPlayed ? `Back to ${mostPlayed}?` : "Pick a course and tee off"}
					</span>
				</span>
				<span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/18 text-white">
					→
				</span>
			</Link>

			{/* Last round */}
			{last ? (
				<section className="mt-6">
					<h2 className="font-display text-sm font-semibold uppercase tracking-wide text-moss">
						Last round
					</h2>
					<div className="mt-3 rounded-2xl border border-card-line bg-white/60 p-4">
						<div className="flex items-baseline justify-between">
							<p className="font-display text-[15px] font-semibold text-ink">
								{last.courseName}
							</p>
							<p className="font-display text-2xl font-bold text-ink">
								{last.owner.strokes || "—"}
								<span className="ml-2 text-[13px] font-semibold text-live">
									{last.owner.strokes ? formatVsPar(last.owner.vsPar) : ""}
								</span>
							</p>
						</div>
						<div className="mt-3 flex gap-4 text-[12px] text-moss">
							<Stat
								label="Putts"
								value={last.owner.putts !== null ? String(last.owner.putts) : "—"}
							/>
							<Stat
								label="FIR"
								value={
									last.owner.firEligible > 0
										? `${last.owner.firMade}/${last.owner.firEligible}`
										: "—"
								}
							/>
							<Stat
								label="GIR"
								value={
									last.owner.girHoles > 0
										? `${last.owner.girMade}/${last.owner.girHoles}`
										: "—"
								}
							/>
						</div>
					</div>
				</section>
			) : null}

			{/* Club yardages */}
			{clubs && clubs.length > 0 ? (
				<section className="mt-6">
					<h2 className="font-display text-sm font-semibold uppercase tracking-wide text-moss">
						Your clubs
					</h2>
					<div className="mt-3 flex gap-2 overflow-x-auto pb-1">
						{clubs.map((club) => (
							<div
								key={club._id}
								className="flex shrink-0 flex-col items-center rounded-xl border border-card-line bg-white/60 px-3 py-2"
							>
								<span className="font-display text-[13px] font-bold text-ink">
									{club.name}
								</span>
								<span className="text-[11px] text-moss">
									{formatDistance(club.carryMeters, units)}
								</span>
							</div>
						))}
					</div>
				</section>
			) : null}
		</main>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<span>
			<span className="mr-1 uppercase tracking-wide text-stone">{label}</span>
			<span className="font-semibold text-ink">{value}</span>
		</span>
	);
}
```

- [ ] **Step 2: Route-gen, typecheck, lint**

Run: `pnpm generate-routes && pnpm typecheck && pnpm lint:fix && pnpm check`
Expected: all exit 0. (`generate-routes` should produce no change since the route path is unchanged, but run it to be safe.)

- [ ] **Step 3: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat(ui): Home — handicap hero, trend, last round, club strip"
```

---

## Task 9: Progress screen

**Files:**
- Modify: `src/routes/progress.tsx` (replace the placeholder body)

Would-be index headline + sparkline, a stats grid (avg score, vs par, putts/18, FIR%, GIR%), and a club distance list. Empty state until three rounds exist.

- [ ] **Step 1: Replace the route**

Replace the entire contents of `src/routes/progress.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Sparkline } from "../components/Sparkline";
import { formatDistance } from "../domain/format";
import { wouldBeIndex, wouldBeIndexHistory } from "../domain/handicap";
import { aggregateStats, type RoundStatInput } from "../domain/stats";

export const Route = createFileRoute("/progress")({ component: ProgressScreen });

function ProgressScreen() {
	const settings = useQuery(api.settings.get);
	const history = useQuery(api.rounds.history, { limit: 20 });
	const clubs = useQuery(api.clubs.list);

	const units = settings?.units ?? "m";
	const rounds = history ?? [];

	const differentials = [...rounds]
		.reverse()
		.map((r) => r.differential)
		.filter((d): d is number => d !== null);
	const trend = wouldBeIndexHistory(differentials);
	const index = wouldBeIndex(differentials);

	const statInputs: RoundStatInput[] = rounds.map((r) => ({
		holeCount: r.holeCount,
		strokes: r.owner.strokes,
		vsPar: r.owner.vsPar,
		putts: r.owner.putts,
		holesWithPutts: r.owner.holesWithPutts,
		firMade: r.owner.firMade,
		firEligible: r.owner.firEligible,
		girMade: r.owner.girMade,
		girHoles: r.owner.girHoles,
	}));
	const stats = aggregateStats(statInputs);

	const pct = (v: number | null) => (v !== null ? `${Math.round(v * 100)}%` : "—");
	const num = (v: number | null) => (v !== null ? String(v) : "—");

	return (
		<main className="px-5 pt-16 pb-[110px]">
			<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
				Progress
			</h1>
			<p className="mt-1 text-[13px] text-moss">
				Would-be index from your last {Math.min(rounds.length, 20)} rounds.
			</p>

			{/* Would-be index headline */}
			<section className="mt-5 rounded-[22px] border border-card-line bg-white/60 p-5">
				<div className="flex items-end justify-between">
					<div>
						<p className="text-[11px] font-semibold uppercase tracking-wide text-stone">
							Would-be index
						</p>
						<p className="mt-1 font-display text-[44px] leading-none font-bold text-ink">
							{index !== null ? index.toFixed(1) : "—"}
						</p>
					</div>
					<Sparkline values={trend} stroke="var(--color-live)" />
				</div>
				{index === null ? (
					<p className="mt-2 text-[12px] text-stone">
						Finish three counting rounds to compute a would-be index.
					</p>
				) : null}
			</section>

			{/* Stats grid */}
			<section className="mt-4 grid grid-cols-2 gap-3">
				<StatCard label="Avg score" value={num(stats.avgScore)} />
				<StatCard
					label="Avg vs par"
					value={
						stats.avgVsPar !== null
							? stats.avgVsPar > 0
								? `+${stats.avgVsPar}`
								: String(stats.avgVsPar)
							: "—"
					}
				/>
				<StatCard label="Putts / 18" value={num(stats.puttsPer18)} />
				<StatCard label="Rounds" value={String(stats.rounds)} />
				<StatCard label="Fairways" value={pct(stats.firPct)} />
				<StatCard label="Greens" value={pct(stats.girPct)} />
			</section>

			{/* Club distances */}
			{clubs && clubs.length > 0 ? (
				<section className="mt-6">
					<h2 className="font-display text-sm font-semibold uppercase tracking-wide text-moss">
						Club distances
					</h2>
					<div className="mt-3 divide-y divide-card-line rounded-2xl border border-card-line bg-white/60">
						{clubs.map((club) => (
							<div
								key={club._id}
								className="flex items-center justify-between px-4 py-2.5"
							>
								<span className="font-display text-[14px] font-semibold text-ink">
									{club.name}
								</span>
								<span className="text-[13px] font-semibold text-moss">
									{formatDistance(club.carryMeters, units)}
								</span>
							</div>
						))}
					</div>
				</section>
			) : null}
		</main>
	);
}

function StatCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-card-line bg-white/60 px-4 py-3">
			<p className="text-[11px] font-semibold uppercase tracking-wide text-stone">
				{label}
			</p>
			<p className="mt-1 font-display text-2xl font-bold text-ink">{value}</p>
		</div>
	);
}
```

- [ ] **Step 2: Route-gen, typecheck, lint**

Run: `pnpm generate-routes && pnpm typecheck && pnpm lint:fix && pnpm check`
Expected: all exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/routes/progress.tsx
git commit -m "feat(ui): Progress — would-be trend, stat grid, club distances"
```

---

## Task 10: Profile screen

**Files:**
- Modify: `src/routes/profile.tsx` (replace the placeholder body)

Editable manual handicap index, units toggle (m/yd), home-course picker, an informational GPS-accuracy row (spec §8 behaviour, not a dead toggle), rounds count + best score, and full club-bag CRUD (add / edit / reorder / delete). All settings writes go through `settings.update`; club writes through the Task 5 mutations.

- [ ] **Step 1: Replace the route**

Replace the entire contents of `src/routes/profile.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { formatDistance, type Units } from "../domain/format";

export const Route = createFileRoute("/profile")({ component: ProfileScreen });

function ProfileScreen() {
	const settings = useQuery(api.settings.get);
	const courses = useQuery(api.courses.list);
	const history = useQuery(api.rounds.history, { limit: 20 });
	const clubs = useQuery(api.clubs.list);
	const updateSettings = useMutation(api.settings.update);

	if (settings === undefined) {
		return (
			<main className="px-5 pt-16 pb-[110px]">
				<p className="text-[13px] text-stone">Loading…</p>
			</main>
		);
	}

	const units = settings.units;
	const rounds = history ?? [];
	const roundsCount = rounds.length;
	const bestScore = rounds
		.filter((r) => r.holeCount === 18 && r.owner.strokes > 0)
		.reduce<number | null>(
			(best, r) => (best === null ? r.owner.strokes : Math.min(best, r.owner.strokes)),
			null,
		);

	return (
		<main className="px-5 pt-16 pb-[110px]">
			<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
				Profile
			</h1>

			{/* Summary */}
			<section className="mt-4 grid grid-cols-3 gap-3">
				<StatCard
					label="Handicap"
					value={settings.handicapIndex !== null ? settings.handicapIndex.toFixed(1) : "—"}
				/>
				<StatCard label="Rounds" value={String(roundsCount)} />
				<StatCard label="Best" value={bestScore !== null ? String(bestScore) : "—"} />
			</section>

			{/* Handicap index entry */}
			<Section title="Handicap index">
				<HandicapEditor
					value={settings.handicapIndex}
					onSave={(handicapIndex) => updateSettings({ handicapIndex })}
				/>
			</Section>

			{/* Units */}
			<Section title="Units">
				<div className="flex gap-2">
					{(["m", "yd"] as const).map((u) => (
						<button
							type="button"
							key={u}
							onClick={() => updateSettings({ units: u })}
							className={`rounded-full border px-4 py-2 font-display text-[13px] font-semibold ${
								units === u
									? "border-pine bg-pine text-cream"
									: "border-card-line bg-white/60 text-ink"
							}`}
						>
							{u === "m" ? "Meters" : "Yards"}
						</button>
					))}
				</div>
			</Section>

			{/* Home course */}
			<Section title="Home course">
				<div className="flex flex-col gap-2">
					{(courses ?? []).map((c) => (
						<button
							type="button"
							key={c._id}
							onClick={() =>
								updateSettings({
									homeCourseId:
										settings.homeCourseId === c._id ? null : c._id,
								})
							}
							className={`rounded-xl border px-4 py-2.5 text-left font-display text-[14px] font-semibold ${
								settings.homeCourseId === c._id
									? "border-live bg-live/10 text-ink"
									: "border-card-line bg-white/60 text-ink"
							}`}
						>
							{c.name}
						</button>
					))}
				</div>
			</Section>

			{/* GPS accuracy (informational — spec §8) */}
			<Section title="GPS accuracy">
				<p className="rounded-xl border border-card-line bg-white/60 px-4 py-3 text-[12.5px] text-moss">
					On the Play screen your position shows a live dot. When accuracy is
					worse than 15 m a soft halo appears around it — the distance number is
					always shown.
				</p>
			</Section>

			{/* Club bag */}
			<Section title="Club bag">
				<ClubBag clubs={clubs ?? []} units={units} />
			</Section>
		</main>
	);
}

function HandicapEditor({
	value,
	onSave,
}: {
	value: number | null;
	onSave: (v: number | null) => void;
}) {
	const [draft, setDraft] = useState(value !== null ? String(value) : "");
	return (
		<div className="flex items-center gap-2">
			<input
				value={draft}
				placeholder="e.g. 18.4"
				inputMode="decimal"
				onChange={(e) => setDraft(e.target.value)}
				className="w-28 rounded-lg border border-card-line bg-cream px-3 py-2 text-center text-[15px] text-ink"
			/>
			<button
				type="button"
				onClick={() => {
					const n = Number.parseFloat(draft);
					onSave(draft.trim() === "" || Number.isNaN(n) ? null : n);
				}}
				className="rounded-full bg-pine px-5 py-2 font-display text-[13px] font-semibold text-cream"
			>
				Save
			</button>
		</div>
	);
}

function ClubBag({
	clubs,
	units,
}: {
	clubs: ReadonlyArray<{ _id: Id<"clubs">; name: string; carryMeters: number }>;
	units: Units;
}) {
	const create = useMutation(api.clubs.create);
	const update = useMutation(api.clubs.update);
	const remove = useMutation(api.clubs.remove);
	const reorder = useMutation(api.clubs.reorder);

	const [name, setName] = useState("");
	const [carry, setCarry] = useState("");

	const move = (index: number, dir: -1 | 1) => {
		const next = [...clubs];
		const target = index + dir;
		if (target < 0 || target >= next.length) return;
		[next[index], next[target]] = [next[target], next[index]];
		reorder({ orderedIds: next.map((c) => c._id) });
	};

	return (
		<div>
			<div className="divide-y divide-card-line rounded-2xl border border-card-line bg-white/60">
				{clubs.map((club, i) => (
					<div key={club._id} className="flex items-center gap-2 px-3 py-2">
						<div className="flex flex-col">
							<button
								type="button"
								aria-label="Move up"
								disabled={i === 0}
								onClick={() => move(i, -1)}
								className="text-moss disabled:opacity-25"
							>
								<ChevronUp className="size-4" />
							</button>
							<button
								type="button"
								aria-label="Move down"
								disabled={i === clubs.length - 1}
								onClick={() => move(i, 1)}
								className="text-moss disabled:opacity-25"
							>
								<ChevronDown className="size-4" />
							</button>
						</div>
						<input
							defaultValue={club.name}
							onBlur={(e) => {
								const v = e.target.value.trim();
								if (v && v !== club.name) update({ clubId: club._id, name: v });
							}}
							className="w-16 rounded-lg border border-card-line bg-cream px-2 py-1.5 font-display text-[14px] font-semibold text-ink"
						/>
						<input
							defaultValue={String(club.carryMeters)}
							inputMode="numeric"
							onBlur={(e) => {
								const n = Number.parseInt(e.target.value, 10);
								if (!Number.isNaN(n) && n !== club.carryMeters)
									update({ clubId: club._id, carryMeters: n });
							}}
							className="w-16 rounded-lg border border-card-line bg-cream px-2 py-1.5 text-center text-[14px] text-ink"
						/>
						<span className="min-w-[52px] text-[12px] text-moss">
							{formatDistance(club.carryMeters, units)}
						</span>
						<button
							type="button"
							aria-label={`Delete ${club.name}`}
							onClick={() => remove({ clubId: club._id })}
							className="ml-auto text-flag"
						>
							<Trash2 className="size-4" />
						</button>
					</div>
				))}
				{clubs.length === 0 ? (
					<p className="px-4 py-3 text-[12.5px] text-stone">
						No clubs yet — add your bag below.
					</p>
				) : null}
			</div>

			{/* Add club */}
			<div className="mt-3 flex items-center gap-2">
				<input
					value={name}
					placeholder="Club (7i)"
					onChange={(e) => setName(e.target.value)}
					className="w-24 rounded-lg border border-card-line bg-cream px-3 py-2 text-[14px] text-ink"
				/>
				<input
					value={carry}
					placeholder="Carry m"
					inputMode="numeric"
					onChange={(e) => setCarry(e.target.value)}
					className="w-24 rounded-lg border border-card-line bg-cream px-3 py-2 text-center text-[14px] text-ink"
				/>
				<button
					type="button"
					disabled={name.trim() === "" || Number.isNaN(Number.parseInt(carry, 10))}
					onClick={() => {
						create({
							name: name.trim(),
							carryMeters: Number.parseInt(carry, 10),
						});
						setName("");
						setCarry("");
					}}
					className="flex items-center gap-1 rounded-full bg-flag px-4 py-2 font-display text-[13px] font-semibold text-white disabled:opacity-40"
				>
					<Plus className="size-4" /> Add
				</button>
			</div>
		</div>
	);
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="mt-6">
			<h2 className="font-display text-sm font-semibold uppercase tracking-wide text-moss">
				{title}
			</h2>
			<div className="mt-3">{children}</div>
		</section>
	);
}

function StatCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-card-line bg-white/60 px-3 py-3 text-center">
			<p className="text-[10px] font-semibold uppercase tracking-wide text-stone">
				{label}
			</p>
			<p className="mt-1 font-display text-xl font-bold text-ink">{value}</p>
		</div>
	);
}
```

> Note: `Minus` is imported for parity with other screens' stepper idiom but the club bag uses inline inputs; if Biome flags `Minus` as unused, drop it from the import. (The implementer should let `pnpm lint:fix` guide this and remove any genuinely unused import.)

- [ ] **Step 2: Route-gen, typecheck, lint, build**

Run: `pnpm generate-routes && pnpm typecheck && pnpm lint:fix && pnpm check && pnpm build`
Expected: all exit 0. Remove any unused import (e.g. `Minus`) that Biome flags, then re-run.

- [ ] **Step 3: Commit**

```bash
git add src/routes/profile.tsx
git commit -m "feat(ui): Profile — handicap, units, home course, club bag CRUD"
```

---

## Task 11: Full verification gate + browser QA

**Files:** none (verification only)

- [ ] **Step 1: Regenerate + drift check**

Run: `pnpm exec convex codegen && pnpm generate-routes && git status --short`
Expected: no unexpected drift (commit any that appears with a `chore:` message).

- [ ] **Step 2: Four gates**

- `pnpm check` → exit 0
- `pnpm typecheck` → exit 0
- `pnpm test` → all suites pass (Plans 1–4 suites + `format`, `stats`, extended `handicap`)
- `pnpm build` → exit 0

- [ ] **Step 3: Browser QA**

Launch `preview_start({name:"All (dev:watch)"})`. Drive with `javascript_tool` per the `golf-app-verification-infra` memory (screenshots/ref-clicks are unreliable in this project; query the DOM and read `document.querySelector('main').innerText`).

1. **Profile round-trip:** open `/profile`. Set handicap index to `18.4` (set the input's value via the native setter + dispatch `input`, then click **Save**); assert the summary "Handicap" card reads `18.4`. Toggle **Yards**; add a club ("7i", "150"); assert it appears and its distance renders in yards (`164 yd`). Reorder and delete a club; assert the list updates. Pick a home course; assert it highlights.
2. **Home:** open `/`. Assert the club strip shows the club you added (in the current units), and the hero shows `18.4` (manual index) or `—` if no rounds. If a finished round exists, assert the last-round card shows course + score.
3. **Progress:** open `/progress`. Assert the club distance list renders and the stat grid shows values (or `—` when there are too few rounds). If ≥3 counting rounds exist, assert the would-be index is a number and the sparkline `<svg>` is present.

To get real data into Home/Progress, optionally finish the current active round via `/card` first (the active round from Plan 4 QA is 18 holes on De Oosterhoutse). Capture `innerText` of the relevant sections as proof.

- [ ] **Step 4: Secrets scan + wrap**

Run: `git log --oneline` over the plan range + `git status`; confirm no `.env*`, keys, or tokens were staged. (Settings/stats/clubs need no secrets.)

---

## Self-review checklist (run after execution)

1. **Spec §4 Home** — greeting ✓, handicap hero + sparkline + delta ✓, Start-a-round CTA (most-played subtitle) ✓, last-round card (score, vs par, FIR/GIR/putts) ✓, club yardages strip ✓.
2. **Spec §4 Progress** — would-be index + trend ✓, avg score ✓, putts/round (as putts/18) ✓, FIR% ✓, GIR% ✓, club distance list ✓, last-20 window ✓.
3. **Spec §4/§6 Profile** — manual handicap entry ✓, rounds count ✓, best score ✓, units toggle ✓ (functional in new surfaces), home course ✓, GPS-accuracy row ✓ (informational, matches §8), club bag add/edit/reorder/delete ✓.
4. **Spec §7 data** — reads `userSettings`, `clubs`, `rounds`/`holeScores`; adds no new tables, no migration ✓.
5. **Units seam** — `formatDistance` used in Home strip, Progress list, Profile bag ✓. **Deferral:** Play/Card still hardcode meters; unify through `formatDistance` in a follow-up (see Known deferrals).
6. **Type consistency** — `RoundStatInput`/`AggregateStats`/`Units` identical across `stats`, `format`, and the routes; `rounds.history` owner shape matches the `RoundStatInput` mapping in Progress ✓.
7. **No placeholders / no secrets / stable keys** (`club._id`, `course._id`) ✓.

## Known deferrals (carried forward)

- **App-wide units** — `formatDistance` is wired into the three new surfaces; the Play and Scorecard distance displays still hardcode meters. Unify them through `formatDistance(_, settings.units)` in a small follow-up (needs a `settings.get` read in Play/Card).
- **Real GPS-accuracy toggle** — presented as an informational row now (spec §8 says never hide the number); a user-controllable halo toggle can be added with a `userSettings.showAccuracyHalo` field + a Play gate later.
- **Stamped round summaries** — `rounds.history` recomputes owner stats from `holeScores` each call. If round volume ever grows, stamp the owner summary onto the round in `finish` and read it directly.
- **Home CTA deep-link** — the CTA routes to `/rounds/new` generically; pre-selecting the most-played course in the setup flow is a nicety for later.
```
