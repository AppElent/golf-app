# Rounds + Scorecard Implementation Plan (Plan 3 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Playable rounds end-to-end without GPS — round setup (course → loops → tee → partners → format) and a Fairway scorecard (golf-notation marks, per-hole editor, Stableford, Out/In, finish with WHS differential).

**Architecture:** Rounds reference course holes by **`ref`** (ordered `holeRefs: string[]`), never by bare number — the same loop-collision fix from Plan 2 (`"1"` vs `"(1)"` are distinct physical holes). A round's *display* hole number is its position in that array (`holeIndex + 1`). Two new pure domain modules (`loops`, scoring additions) are TDD'd against the real course fixtures. Convex `rounds.ts` functions compute playing handicaps, totals, and the WHS differential **server-side** by importing the existing domain modules (Plan 2 proved Convex bundles `src/domain/*` cleanly). Everything backend is live-verified via `convex run` against the seeded local deployment; the two routes are typecheck/build-verified (Clerk key still absent).

**Tech Stack:** Convex (rounds functions, `convex/`), TanStack Start routes, Convex React hooks, existing `src/domain/{scoring,handicap}` modules, Vitest, Tailwind v4 Fairway tokens, Biome, pnpm.

---

## Scope & decisions (read before starting)

- **Schema adjustment while tables are empty:** `rounds.holeNumbers: number[]` → `rounds.holeRefs: string[]`; `rounds.currentHole` → `rounds.currentHoleIndex`; `holeScores.holeNumber` → `holeScores.holeIndex` (0-based position in `holeRefs`). Numbers are ambiguous across loops; position-in-round is what the scorecard actually keys on. `rounds`/`holeScores` have no data anywhere, so this is free now and expensive later.
- **Par + stroke index are required to start a round.** Stroke allocation, Stableford, net double bogey, and the differential all need them. Setup shows which holes are incomplete and links to the course editor instead of starting a broken round. (Oosterhoutse is 26/27 complete; Welderen needs a one-time editor session — that's the editor doing its job, not a blocker.)
- **Auth soft-fallback:** `ctx.auth.getUserIdentity()` returns null on the local anonymous deployment (dummy issuer) and under `convex run`. A `getUserId` helper returns `identity?.subject ?? "local-dev"`. Single-user app; the helper is the one place to tighten when real auth lands. Do NOT skip identity plumbing — use the helper everywhere `userId` is written/filtered.
- **One active round at a time.** `start` throws if an active round exists; an `abandon` mutation deletes the active round + its scores.
- **Differential rules (v1):** owner's WHS score differential is stamped on finish only when the round is **18 holes, no NR, all strokes entered**; otherwise `null` (spec §8: NR voids the differential; 9-hole differential math is deferred — noted in spec's parked list spirit).
- **Same loop twice is a valid 18** (e.g. front 9 × 2) — loop composition allows duplicate selection.
- **Guest without handicap index** plays off scratch: `playingHandicap` left undefined, strokes received 0, shown as "—" (spec §8).
- **After finish, `/card` returns to its empty state.** Round history/summary screens are Plan 5 (Home/Progress). The finish response returns totals so the UI can flash them, but no history UI is built here.
- **Owner HI is typed into setup manually** for now; prefill from `userSettings` arrives with Profile (Plan 5).

## Verification reality

Same environment as Plan 2:
- **Live-verifiable:** all Convex functions via `pnpm exec convex dev --once` + `pnpm exec convex run` against the anonymous local deployment (already seeded with both courses). Plan includes explicit live-run steps for start → score → finish.
- **NOT live-verifiable:** the two routes in a browser (no `VITE_CLERK_PUBLISHABLE_KEY` in `.env.local`; do not fabricate). Static gates (typecheck/check/build) + code review cover them.

## File structure

| File | Responsibility |
|---|---|
| `convex/schema.ts` | Rename round/score fields to ref/index model (Task 1). |
| `src/domain/loops.ts` + `.test.ts` | Pure loop detection from hole refs (`1–9`, `10–18`, `(1)–(9)`), tested against real fixtures via `normalizeCourse`. |
| `src/domain/scoring.ts` + `.test.ts` | Add `scoreMark` (eagle/birdie/par/bogey/double classification) and `splitTotals` (Out/In). |
| `convex/lib.ts` | `getUserId(ctx)` auth soft-fallback helper. |
| `convex/rounds.ts` | `start`, `active`, `setScore`, `setCurrentHole`, `finish`, `abandon`. |
| `src/routes/rounds.new.tsx` | Round setup screen (course → loops → tee → players → format → start). |
| `src/routes/card.tsx` | Rewrite placeholder into the scorecard (grid, marks, hole editor, totals, finish). |
| `src/routes/index.tsx` | Wire the Home "Start a round" CTA to `/rounds/new` (small edit). |

Shared shapes used across tasks:

```ts
// src/domain/loops.ts
export interface Loop {
	label: string;   // "1–9", "10–18", "(1)–(9)"
	refs: string[];  // ordered hole refs
}

// src/domain/scoring.ts (additions)
export type ScoreMark = "eagle" | "birdie" | "par" | "bogey" | "double";
// scoreMark(par, strokes) → ScoreMark | null   (null = no strokes)
// splitTotals(strokes, size) → number[]        (chunk sums, nulls = 0)

// convex/rounds.ts — `active`/`get` return shape (assembled server-side)
// {
//   round: Doc<"rounds">,
//   course: Doc<"courses">,
//   tee: Doc<"tees">,
//   holes: Array<{ ref: string; par: number; strokeIndex: number; lengthMeters?: number }>,  // ordered per holeRefs
//   scores: Doc<"holeScores">[],
// }
```

---

## Task 1: Schema — refs/index model for rounds & scores

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Edit the `rounds` table**

In `convex/schema.ts`, replace within `rounds: defineTable({ ... })`:

```ts
		loop: v.optional(v.string()),
		holeNumbers: v.array(v.number()),
```
with
```ts
		loopLabel: v.optional(v.string()),
		holeRefs: v.array(v.string()),
```
and replace
```ts
		currentHole: v.optional(v.number()),
```
with
```ts
		currentHoleIndex: v.optional(v.number()),
```

- [ ] **Step 2: Edit the `holeScores` table**

Replace the `holeScores` table definition with:

```ts
	holeScores: defineTable({
		roundId: v.id("rounds"),
		// 0-based position in the round's holeRefs (display number = index + 1).
		holeIndex: v.number(),
		playerIndex: v.number(),
		strokes: v.optional(v.number()),
		putts: v.optional(v.number()),
		fir: v.optional(v.boolean()),
		gir: v.optional(v.boolean()),
		penalties: v.optional(v.number()),
		nr: v.optional(v.boolean()),
	})
		.index("by_round", ["roundId"])
		.index("by_round_hole_player", ["roundId", "holeIndex", "playerIndex"]),
```

- [ ] **Step 3: Push + typecheck + lint**

Run: `pnpm exec convex dev --once && pnpm typecheck && pnpm lint:fix && pnpm check`
Expected: all exit 0 (tables are empty; rename is free).

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts convex/_generated
git commit -m "feat(convex): rounds reference holes by ref + position index (loop-safe)"
```

---

## Task 2: Domain `loops` (TDD)

**Files:**
- Create: `src/domain/loops.ts`
- Test: `src/domain/loops.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/domain/loops.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import oosterhoutse from "./__fixtures__/oosterhoutse.overpass.json";
import welderen from "./__fixtures__/welderen.overpass.json";
import { detectLoops } from "./loops";
import { normalizeCourse } from "./osm";

const holesOf = (fixture: { elements: unknown[] }) =>
	normalizeCourse(
		fixture.elements as Parameters<typeof normalizeCourse>[0],
	).holes.map((h) => ({ ref: h.ref, number: h.number }));

describe("detectLoops", () => {
	it("splits plain 1–18 into two loops and parenthesized refs into their own", () => {
		const loops = detectLoops([
			...Array.from({ length: 18 }, (_, i) => ({
				ref: `${i + 1}`,
				number: i + 1,
			})),
			...Array.from({ length: 9 }, (_, i) => ({
				ref: `(${i + 1})`,
				number: i + 1,
			})),
		]);
		expect(loops.map((l) => l.label)).toEqual(["1–9", "10–18", "(1)–(9)"]);
		expect(loops[0].refs).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
		expect(loops[2].refs[0]).toBe("(1)");
		expect(loops[2].refs).toHaveLength(9);
	});

	it("orders refs numerically within a loop regardless of input order", () => {
		const loops = detectLoops([
			{ ref: "3", number: 3 },
			{ ref: "1", number: 1 },
			{ ref: "2", number: 2 },
		]);
		expect(loops).toHaveLength(1);
		expect(loops[0].refs).toEqual(["1", "2", "3"]);
		expect(loops[0].label).toBe("1–3");
	});

	it("finds three 9-hole loops at Welderen (real data)", () => {
		const loops = detectLoops(holesOf(welderen));
		expect(loops).toHaveLength(3);
		expect(loops.every((l) => l.refs.length === 9)).toBe(true);
	});

	it("finds three 9-hole loops at De Oosterhoutse (real data)", () => {
		const loops = detectLoops(holesOf(oosterhoutse));
		expect(loops).toHaveLength(3);
		expect(loops.every((l) => l.refs.length === 9)).toBe(true);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run src/domain/loops.test.ts`
Expected: FAIL — `./loops` does not exist.

- [ ] **Step 3: Implement**

Create `src/domain/loops.ts`:

```ts
export interface Loop {
	label: string;
	refs: string[];
}

interface HoleRef {
	ref: string;
	number: number;
}

const isParenthesized = (ref: string): boolean => ref.startsWith("(");

/**
 * Group a course's holes into playable loops from their OSM refs:
 * plain refs are split into 1–9 and 10–18 bands; parenthesized refs
 * ("(1)"…"(9)", a third loop at both home courses) form their own loop.
 * Refs are ordered numerically within each loop.
 */
export function detectLoops(holes: ReadonlyArray<HoleRef>): Loop[] {
	const buckets = new Map<string, HoleRef[]>();
	for (const hole of holes) {
		const key = isParenthesized(hole.ref)
			? "paren"
			: hole.number <= 9
				? "front"
				: "back";
		const bucket = buckets.get(key) ?? [];
		bucket.push(hole);
		buckets.set(key, bucket);
	}

	const loops: Loop[] = [];
	for (const key of ["front", "back", "paren"] as const) {
		const bucket = buckets.get(key);
		if (!bucket || bucket.length === 0) continue;
		const sorted = [...bucket].sort((a, b) => a.number - b.number);
		const first = sorted[0];
		const last = sorted[sorted.length - 1];
		loops.push({
			label: `${first.ref}–${last.ref}`,
			refs: sorted.map((h) => h.ref),
		});
	}
	return loops;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm exec vitest run src/domain/loops.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Lint + commit**

```bash
pnpm lint:fix && pnpm check
git add src/domain/loops.ts src/domain/loops.test.ts
git commit -m "feat(domain): loop detection from hole refs, tested on real courses"
```

---

## Task 3: Domain scoring additions — `scoreMark` + `splitTotals` (TDD)

**Files:**
- Modify: `src/domain/scoring.ts`
- Modify: `src/domain/scoring.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/domain/scoring.test.ts` (extend the existing `./scoring` import with `scoreMark, splitTotals`):

```ts
describe("scoreMark", () => {
	it("classifies against par", () => {
		expect(scoreMark(4, 2)).toBe("eagle");
		expect(scoreMark(4, 3)).toBe("birdie");
		expect(scoreMark(4, 4)).toBe("par");
		expect(scoreMark(4, 5)).toBe("bogey");
		expect(scoreMark(4, 6)).toBe("double");
		expect(scoreMark(4, 9)).toBe("double");
	});
	it("returns null when strokes are missing", () => {
		expect(scoreMark(4, null)).toBeNull();
	});
});

describe("splitTotals", () => {
	it("sums 18 holes into Out/In nines", () => {
		const strokes = [4, 5, 3, 4, 4, 5, 4, 3, 5, 4, 4, 6, 3, 5, 4, 4, 5, 4];
		expect(splitTotals(strokes, 9)).toEqual([37, 39]);
	});
	it("treats null (unplayed) as 0 and handles 9-hole rounds", () => {
		expect(splitTotals([4, null, 5], 9)).toEqual([9]);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run src/domain/scoring.test.ts`
Expected: FAIL — `scoreMark`/`splitTotals` not exported.

- [ ] **Step 3: Implement**

Append to `src/domain/scoring.ts`:

```ts
export type ScoreMark = "eagle" | "birdie" | "par" | "bogey" | "double";

/** Classic scorecard notation class for a hole result (spec §3). */
export function scoreMark(par: number, strokes: number | null): ScoreMark | null {
	if (strokes === null) return null;
	const diff = strokes - par;
	if (diff <= -2) return "eagle";
	if (diff === -1) return "birdie";
	if (diff === 0) return "par";
	if (diff === 1) return "bogey";
	return "double";
}

/** Chunk stroke totals (Out/In nines). Nulls count 0; trailing partial chunk kept. */
export function splitTotals(
	strokes: ReadonlyArray<number | null>,
	size: number,
): number[] {
	const totals: number[] = [];
	for (let i = 0; i < strokes.length; i += size) {
		totals.push(totalStrokes(strokes.slice(i, i + size)));
	}
	return totals;
}
```

- [ ] **Step 4: Run to verify pass + full suite**

Run: `pnpm exec vitest run src/domain/scoring.test.ts && pnpm test`
Expected: PASS, no regressions.

- [ ] **Step 5: Lint + commit**

```bash
pnpm lint:fix && pnpm check
git add src/domain/scoring.ts src/domain/scoring.test.ts
git commit -m "feat(domain): scoreMark notation classes + Out/In splitTotals"
```

---

## Task 4: `convex/lib.ts` + `rounds.start` / `rounds.active`

**Files:**
- Create: `convex/lib.ts`
- Create: `convex/rounds.ts`

- [ ] **Step 1: Auth helper**

Create `convex/lib.ts`:

```ts
import type { QueryCtx } from "./_generated/server";

/**
 * Owner identity with a local-dev fallback: the anonymous local deployment
 * (dummy Clerk issuer) and `convex run` have no identity. Single-user app —
 * tighten to a hard throw when real Clerk auth is wired end-to-end.
 */
export async function getUserId(ctx: QueryCtx): Promise<string> {
	const identity = await ctx.auth.getUserIdentity();
	return identity?.subject ?? "local-dev";
}
```

- [ ] **Step 2: `start` + `active`**

Create `convex/rounds.ts`:

```ts
import { v } from "convex/values";
import { playingHandicap } from "../src/domain/handicap";
import { mutation, query } from "./_generated/server";
import { getUserId } from "./lib";

const playerInput = v.object({
	name: v.string(),
	handicapIndex: v.optional(v.number()),
});

/**
 * Start a round. Validates every selected hole has par + stroke index
 * (scoring math needs them) and computes each player's playing handicap
 * server-side from the tee's CR/slope and the selected holes' par total.
 */
export const start = mutation({
	args: {
		courseId: v.id("courses"),
		teeId: v.id("tees"),
		holeRefs: v.array(v.string()),
		loopLabel: v.optional(v.string()),
		format: v.union(v.literal("stroke"), v.literal("stableford")),
		players: v.array(playerInput),
	},
	handler: async (ctx, args) => {
		const userId = await getUserId(ctx);

		const existing = await ctx.db
			.query("rounds")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.filter((q) => q.eq(q.field("status"), "active"))
			.first();
		if (existing) {
			throw new Error("An active round already exists — finish or abandon it first.");
		}
		if (args.players.length === 0) {
			throw new Error("A round needs at least one player.");
		}
		if (args.holeRefs.length === 0) {
			throw new Error("A round needs at least one hole.");
		}

		const tee = await ctx.db.get(args.teeId);
		if (!tee || tee.courseId !== args.courseId) {
			throw new Error("Tee does not belong to this course.");
		}

		const courseHoles = await ctx.db
			.query("holes")
			.withIndex("by_course", (q) => q.eq("courseId", args.courseId))
			.collect();
		const byRef = new Map(courseHoles.map((h) => [h.ref, h]));

		const incomplete: string[] = [];
		let parTotal = 0;
		for (const ref of args.holeRefs) {
			const hole = byRef.get(ref);
			if (!hole || hole.par === undefined || hole.strokeIndex === undefined) {
				incomplete.push(ref);
			} else {
				parTotal += hole.par;
			}
		}
		if (incomplete.length > 0) {
			throw new Error(
				`Holes missing par/stroke index: ${incomplete.join(", ")}. Complete them in the course editor first.`,
			);
		}

		const players = args.players.map((p) => ({
			name: p.name,
			handicapIndex: p.handicapIndex,
			playingHandicap:
				p.handicapIndex === undefined
					? undefined
					: playingHandicap(
							p.handicapIndex,
							tee.slopeRating,
							tee.courseRating,
							parTotal,
						),
		}));

		return await ctx.db.insert("rounds", {
			userId,
			courseId: args.courseId,
			teeId: args.teeId,
			holeRefs: args.holeRefs,
			loopLabel: args.loopLabel,
			startedAt: Date.now(),
			format: args.format,
			status: "active",
			players,
			currentHoleIndex: 0,
		});
	},
});

/** The user's active round, assembled for the scorecard/play screens. */
export const active = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getUserId(ctx);
		const round = await ctx.db
			.query("rounds")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.filter((q) => q.eq(q.field("status"), "active"))
			.first();
		if (!round) return null;

		const [course, tee, courseHoles, scores] = await Promise.all([
			ctx.db.get(round.courseId),
			ctx.db.get(round.teeId),
			ctx.db
				.query("holes")
				.withIndex("by_course", (q) => q.eq("courseId", round.courseId))
				.collect(),
			ctx.db
				.query("holeScores")
				.withIndex("by_round", (q) => q.eq("roundId", round._id))
				.collect(),
		]);
		if (!course || !tee) return null;

		const byRef = new Map(courseHoles.map((h) => [h.ref, h]));
		const holes = round.holeRefs.map((ref) => {
			const hole = byRef.get(ref);
			return {
				ref,
				// start() guarantees these exist for every round hole
				par: hole?.par ?? 0,
				strokeIndex: hole?.strokeIndex ?? 0,
				lengthMeters: hole?.lengthMeters,
			};
		});

		return { round, course, tee, holes, scores };
	},
});
```

- [ ] **Step 3: Push, typecheck, lint**

Run: `pnpm exec convex dev --once && pnpm typecheck && pnpm lint:fix && pnpm check`
Expected: all exit 0.

- [ ] **Step 4: Live-verify `start` validation + happy path**

The seeded Oosterhoutse course has one hole missing par/SI. First find and fill it (this exercises the editor mutation):

```bash
# Identify the incomplete hole + grab ids (adjust course id from courses:list)
pnpm exec convex run courses:list '{}'
pnpm exec convex run courses:get '{"courseId":"<OOSTERHOUTSE_ID>"}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s.slice(s.indexOf("{")));console.log("tee:",j.tees[0]._id);for(const h of j.holes)if(h.par==null||h.strokeIndex==null)console.log("incomplete:",h._id,h.ref);})'
# Fill it (real values for the missing hole; par 4 / SI 15 as placeholder is fine for dev)
pnpm exec convex run courses:upsertHole '{"holeId":"<HOLE_ID>","par":4,"strokeIndex":15}'
```

Then verify validation and the happy path:

```bash
# 1) Expect ERROR — Welderen holes have no par yet
pnpm exec convex run rounds:start '{"courseId":"<WELDEREN_ID>","teeId":"<WELDEREN_TEE_ID>","holeRefs":["1","2","3","4","5","6","7","8","9"],"format":"stroke","players":[{"name":"Eric","handicapIndex":20}]}'
# Expected: "Holes missing par/stroke index: 1, 2, ..."

# 2) Expect SUCCESS — Oosterhoutse 18 (refs "1".."18"), Stableford, one guest
pnpm exec convex run rounds:start '{"courseId":"<OOSTERHOUTSE_ID>","teeId":"<OOSTERHOUTSE_TEE_ID>","holeRefs":["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18"],"loopLabel":"1–18","format":"stableford","players":[{"name":"Eric","handicapIndex":20},{"name":"Guest"}]}'
# Expected: returns a round id

# 3) active returns the assembled round
pnpm exec convex run rounds:active '{}'
# Expected: round with 18 ordered holes (par/strokeIndex present),
# players[0].playingHandicap ≈ 20 (slope 113, CR 72 vs par total),
# players[1].playingHandicap undefined

# 4) Starting again fails
pnpm exec convex run rounds:start '{... same as 2 ...}'
# Expected: "An active round already exists"
```

- [ ] **Step 5: Commit**

```bash
git add convex/lib.ts convex/rounds.ts convex/_generated
git commit -m "feat(convex): round start + active query with server-side playing handicaps"
```

---

## Task 5: `setScore` / `setCurrentHole` / `finish` / `abandon`

**Files:**
- Modify: `convex/rounds.ts`

- [ ] **Step 1: Add the mutations**

Extend the imports in `convex/rounds.ts`:

```ts
import { v } from "convex/values";
import {
	adjustedGrossScore,
	scoreDifferential,
} from "../src/domain/handicap";
import { playingHandicap } from "../src/domain/handicap";
import { stablefordPoints, totalStrokes } from "../src/domain/scoring";
import { mutation, query } from "./_generated/server";
import { getUserId } from "./lib";
```

(Merge the two handicap imports into one statement; shown split here for clarity of what's new.)

Append:

```ts
/** Guard: the round exists, belongs to the caller, and is active. */
async function requireActiveRound(
	ctx: Parameters<Parameters<typeof mutation>[0]["handler"]>[0],
	roundId: import("./_generated/dataModel").Id<"rounds">,
) {
	const userId = await getUserId(ctx);
	const round = await ctx.db.get(roundId);
	if (!round || round.userId !== userId) throw new Error("Round not found.");
	if (round.status !== "active") throw new Error("Round is not active.");
	return round;
}

/** Upsert one player's result on one hole. Last write wins (single scorer). */
export const setScore = mutation({
	args: {
		roundId: v.id("rounds"),
		holeIndex: v.number(),
		playerIndex: v.number(),
		strokes: v.optional(v.number()),
		putts: v.optional(v.number()),
		fir: v.optional(v.boolean()),
		gir: v.optional(v.boolean()),
		penalties: v.optional(v.number()),
		nr: v.optional(v.boolean()),
	},
	handler: async (ctx, { roundId, holeIndex, playerIndex, ...fields }) => {
		const round = await requireActiveRound(ctx, roundId);
		if (holeIndex < 0 || holeIndex >= round.holeRefs.length) {
			throw new Error("holeIndex out of range.");
		}
		if (playerIndex < 0 || playerIndex >= round.players.length) {
			throw new Error("playerIndex out of range.");
		}
		const existing = await ctx.db
			.query("holeScores")
			.withIndex("by_round_hole_player", (q) =>
				q
					.eq("roundId", roundId)
					.eq("holeIndex", holeIndex)
					.eq("playerIndex", playerIndex),
			)
			.first();
		if (existing) {
			await ctx.db.patch(existing._id, fields);
		} else {
			await ctx.db.insert("holeScores", {
				roundId,
				holeIndex,
				playerIndex,
				...fields,
			});
		}
	},
});

export const setCurrentHole = mutation({
	args: { roundId: v.id("rounds"), holeIndex: v.number() },
	handler: async (ctx, { roundId, holeIndex }) => {
		const round = await requireActiveRound(ctx, roundId);
		if (holeIndex < 0 || holeIndex >= round.holeRefs.length) {
			throw new Error("holeIndex out of range.");
		}
		await ctx.db.patch(roundId, { currentHoleIndex: holeIndex });
	},
});

/** Delete the active round and its scores. */
export const abandon = mutation({
	args: { roundId: v.id("rounds") },
	handler: async (ctx, { roundId }) => {
		await requireActiveRound(ctx, roundId);
		const scores = await ctx.db
			.query("holeScores")
			.withIndex("by_round", (q) => q.eq("roundId", roundId))
			.collect();
		await Promise.all(scores.map((s) => ctx.db.delete(s._id)));
		await ctx.db.delete(roundId);
	},
});

/**
 * Finish the round: stamp per-player totals (strokes + Stableford points) and
 * the owner's WHS score differential — only for complete 18-hole rounds with
 * no NR (spec §8); otherwise null.
 */
export const finish = mutation({
	args: { roundId: v.id("rounds") },
	handler: async (ctx, { roundId }) => {
		const round = await requireActiveRound(ctx, roundId);
		const [tee, courseHoles, scores] = await Promise.all([
			ctx.db.get(round.teeId),
			ctx.db
				.query("holes")
				.withIndex("by_course", (q) => q.eq("courseId", round.courseId))
				.collect(),
			ctx.db
				.query("holeScores")
				.withIndex("by_round", (q) => q.eq("roundId", round._id))
				.collect(),
		]);
		if (!tee) throw new Error("Tee not found.");

		const byRef = new Map(courseHoles.map((h) => [h.ref, h]));
		const holes = round.holeRefs.map((ref) => {
			const hole = byRef.get(ref);
			return { par: hole?.par ?? 0, strokeIndex: hole?.strokeIndex ?? 0 };
		});

		const scoreOf = (holeIndex: number, playerIndex: number) =>
			scores.find(
				(s) => s.holeIndex === holeIndex && s.playerIndex === playerIndex,
			);

		const totals = round.players.map((player, playerIndex) => {
			const strokes = holes.map((_, holeIndex) => {
				const s = scoreOf(holeIndex, playerIndex);
				return s?.nr ? null : (s?.strokes ?? null);
			});
			const points = strokes.reduce<number>(
				(sum, s, i) =>
					sum + stablefordPoints(holes[i], s, player.playingHandicap ?? 0),
				0,
			);
			return { strokes: totalStrokes(strokes), points };
		});

		// Owner differential: 18 holes, no NR, every stroke entered.
		const owner = round.players[0];
		const ownerStrokes = holes.map((_, i) => scoreOf(i, 0));
		const complete =
			round.holeRefs.length === 18 &&
			ownerStrokes.every((s) => s?.strokes !== undefined && !s.nr);
		const differential =
			complete && owner.playingHandicap !== undefined
				? scoreDifferential(
						adjustedGrossScore(
							holes,
							ownerStrokes.map((s) => s?.strokes ?? 0),
							owner.playingHandicap,
						),
						tee.courseRating,
						tee.slopeRating,
					)
				: null;

		await ctx.db.patch(roundId, {
			status: "finished",
			totals,
			scoreDifferential: differential,
		});
		return { totals, scoreDifferential: differential };
	},
});
```

> Note on the `requireActiveRound` ctx type: if the `Parameters<...>` gymnastics fight the Convex types, use `MutationCtx` from `./_generated/server` instead — `async function requireActiveRound(ctx: MutationCtx, roundId: Id<"rounds">)` with `import type { MutationCtx } from "./_generated/server"; import type { Id } from "./_generated/dataModel";`. That is the preferred, plainer form.

- [ ] **Step 2: Push, typecheck, lint**

Run: `pnpm exec convex dev --once && pnpm typecheck && pnpm lint:fix && pnpm check`
Expected: all exit 0.

- [ ] **Step 3: Live-verify score → finish end-to-end**

Using the active round from Task 4 (id from `rounds:active`):

```bash
# Enter 18 owner scores (par+1 everywhere → bogey round) + a couple guest scores
ROUND=<ROUND_ID>
for i in $(seq 0 17); do
  pnpm exec convex run rounds:setScore "{\"roundId\":\"$ROUND\",\"holeIndex\":$i,\"playerIndex\":0,\"strokes\":5,\"putts\":2}"
done
pnpm exec convex run rounds:setScore "{\"roundId\":\"$ROUND\",\"holeIndex\":0,\"playerIndex\":1,\"strokes\":6}"

# Overwrite one score (last-write-wins upsert)
pnpm exec convex run rounds:setScore "{\"roundId\":\"$ROUND\",\"holeIndex\":0,\"playerIndex\":0,\"strokes\":4}"

# Finish
pnpm exec convex run rounds:finish "{\"roundId\":\"$ROUND\"}"
```

Expected `finish` result: owner totals.strokes = 89 (17×5 + 4), points > 0, and a numeric `scoreDifferential` (sanity: AGS ≈ 89 minus any net-double-bogey caps; differential = (113/slope)×(AGS − CR), with the seeded default tee CR 72 / slope 113 that's ≈ AGS − 72 ≈ 17ish given HI 20). Verify:

```bash
pnpm exec convex run rounds:active '{}'
# Expected: null (round is finished, no longer active)
```

Also verify NR voids the differential: start a fresh round, set one hole `{"nr":true}` plus strokes on the rest, finish → `scoreDifferential: null`. Then abandon-test: start another round, `rounds:abandon`, confirm `rounds:active` → null.

- [ ] **Step 4: Commit**

```bash
git add convex/rounds.ts convex/_generated
git commit -m "feat(convex): setScore/setCurrentHole/finish/abandon with WHS differential stamping"
```

---

## Task 6: Round setup route (`/rounds/new`)

**Files:**
- Create: `src/routes/rounds.new.tsx`
- Modify: `src/routes/index.tsx` (wire the CTA)

- [ ] **Step 1: Write the setup route**

Create `src/routes/rounds.new.tsx`:

```tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Minus, Plus, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { playingHandicap } from "../domain/handicap";
import { detectLoops } from "../domain/loops";

export const Route = createFileRoute("/rounds/new")({ component: RoundSetup });

interface GuestDraft {
	name: string;
	handicapIndex: string; // raw input, "" = scratch
}

function RoundSetup() {
	const navigate = useNavigate();
	const courses = useQuery(api.courses.list);
	const [courseId, setCourseId] = useState<Id<"courses"> | null>(null);
	const detail = useQuery(
		api.courses.get,
		courseId ? { courseId } : "skip",
	);
	const start = useMutation(api.rounds.start);

	const [loopIdxs, setLoopIdxs] = useState<number[]>([]); // 1 or 2 picks, dup ok
	const [ownerHi, setOwnerHi] = useState("");
	const [guests, setGuests] = useState<GuestDraft[]>([]);
	const [format, setFormat] = useState<"stroke" | "stableford">("stableford");
	const [error, setError] = useState<string | null>(null);

	const loops = useMemo(
		() =>
			detail
				? detectLoops(
						detail.holes.flatMap((h) =>
							h.ref !== undefined ? [{ ref: h.ref, number: h.number }] : [],
						),
					)
				: [],
		[detail],
	);

	const holeRefs = loopIdxs.flatMap((i) => loops[i]?.refs ?? []);
	const byRef = new Map((detail?.holes ?? []).map((h) => [h.ref, h]));
	const incomplete = holeRefs.filter((ref) => {
		const h = byRef.get(ref);
		return !h || h.par === undefined || h.strokeIndex === undefined;
	});
	const parTotal = holeRefs.reduce(
		(sum, ref) => sum + (byRef.get(ref)?.par ?? 0),
		0,
	);
	const tee = detail?.tees[0];

	const phFor = (hi: string): number | undefined => {
		const n = Number.parseFloat(hi);
		if (Number.isNaN(n) || !tee || holeRefs.length === 0) return undefined;
		return playingHandicap(n, tee.slopeRating, tee.courseRating, parTotal);
	};

	const canStart =
		courseId && tee && holeRefs.length > 0 && incomplete.length === 0;

	async function onStart() {
		if (!courseId || !tee) return;
		setError(null);
		try {
			await start({
				courseId,
				teeId: tee._id,
				holeRefs,
				loopLabel: loopIdxs.map((i) => loops[i]?.label).join(" + "),
				format,
				players: [
					{
						name: "Eric",
						handicapIndex: ownerHi === "" ? undefined : Number.parseFloat(ownerHi),
					},
					...guests.map((g) => ({
						name: g.name || "Guest",
						handicapIndex:
							g.handicapIndex === ""
								? undefined
								: Number.parseFloat(g.handicapIndex),
					})),
				],
			});
			navigate({ to: "/card" });
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not start the round.");
		}
	}

	return (
		<main className="px-5 pt-16 pb-[110px]">
			<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
				New round
			</h1>

			{/* Course */}
			<Section title="Course">
				<div className="flex flex-col gap-2">
					{(courses ?? []).map((c) => (
						<button
							type="button"
							key={c._id}
							onClick={() => {
								setCourseId(c._id);
								setLoopIdxs([]);
							}}
							className={`rounded-xl border px-4 py-3 text-left font-display text-[15px] font-semibold ${
								courseId === c._id
									? "border-live bg-live/10 text-ink"
									: "border-card-line bg-white/60 text-ink"
							}`}
						>
							{c.name}
							{c.city ? (
								<span className="block text-[12px] font-normal text-moss">
									{c.city}
								</span>
							) : null}
						</button>
					))}
				</div>
			</Section>

			{/* Loops */}
			{courseId && loops.length > 0 ? (
				<Section title="Holes" hint="Pick one loop for 9, two for 18 (same loop twice is fine).">
					<div className="flex flex-wrap gap-2">
						{loops.map((loop, i) => {
							const count = loopIdxs.filter((x) => x === i).length;
							return (
								<button
									type="button"
									key={loop.label}
									onClick={() =>
										setLoopIdxs((prev) =>
											count > 0 && prev.length >= 2
												? prev.filter((x) => x !== i)
												: prev.length >= 2
													? prev
													: [...prev, i],
										)
									}
									className={`rounded-full border px-4 py-2 font-display text-[13px] font-semibold ${
										count > 0
											? "border-live bg-live text-white"
											: "border-card-line bg-white/60 text-ink"
									}`}
								>
									{loop.label}
									{count > 1 ? " ×2" : ""}
								</button>
							);
						})}
					</div>
					{holeRefs.length > 0 ? (
						<p className="mt-2 text-[12px] text-moss">
							{holeRefs.length} holes · par {parTotal}
						</p>
					) : null}
					{incomplete.length > 0 ? (
						<p className="mt-2 flex items-start gap-1.5 text-[12px] text-flag">
							<TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
							<span>
								{incomplete.length} holes missing par/stroke index.{" "}
								<Link
									to="/courses/$courseId/edit"
									params={{ courseId }}
									className="underline"
								>
									Complete them in the editor
								</Link>{" "}
								before starting.
							</span>
						</p>
					) : null}
				</Section>
			) : null}

			{/* Players */}
			{holeRefs.length > 0 ? (
				<Section title="Players">
					<PlayerRow
						name="Eric (you)"
						hi={ownerHi}
						onHi={setOwnerHi}
						ph={phFor(ownerHi)}
					/>
					{guests.map((g, i) => (
						<div key={`guest-${i}-${g.name}`} className="mt-2 flex items-center gap-2">
							<input
								value={g.name}
								placeholder="Guest name"
								onChange={(e) =>
									setGuests((prev) =>
										prev.map((x, j) =>
											j === i ? { ...x, name: e.target.value } : x,
										),
									)
								}
								className="min-w-0 flex-1 rounded-lg border border-card-line bg-cream px-3 py-2 text-[15px] text-ink"
							/>
							<HiInput
								value={g.handicapIndex}
								onChange={(v2) =>
									setGuests((prev) =>
										prev.map((x, j) =>
											j === i ? { ...x, handicapIndex: v2 } : x,
										),
									)
								}
								ph={phFor(g.handicapIndex)}
							/>
							<button
								type="button"
								aria-label="Remove guest"
								onClick={() =>
									setGuests((prev) => prev.filter((_, j) => j !== i))
								}
								className="rounded-full border border-card-line p-2 text-moss"
							>
								<Minus className="size-4" />
							</button>
						</div>
					))}
					<button
						type="button"
						onClick={() =>
							setGuests((prev) => [...prev, { name: "", handicapIndex: "" }])
						}
						className="mt-3 flex items-center gap-1.5 rounded-full border border-card-line px-4 py-2 font-display text-[13px] font-semibold text-ink"
					>
						<Plus className="size-4" /> Add guest
					</button>
				</Section>
			) : null}

			{/* Format */}
			{holeRefs.length > 0 ? (
				<Section title="Format">
					<div className="flex gap-2">
						{(["stableford", "stroke"] as const).map((f) => (
							<button
								type="button"
								key={f}
								onClick={() => setFormat(f)}
								className={`rounded-full border px-4 py-2 font-display text-[13px] font-semibold capitalize ${
									format === f
										? "border-pine bg-pine text-cream"
										: "border-card-line bg-white/60 text-ink"
								}`}
							>
								{f === "stroke" ? "Stroke play" : "Stableford"}
							</button>
						))}
					</div>
				</Section>
			) : null}

			{error ? (
				<p className="mt-4 text-[13px] font-semibold text-flag">{error}</p>
			) : null}

			<button
				type="button"
				disabled={!canStart}
				onClick={onStart}
				className="mt-8 w-full rounded-full bg-flag px-6 py-4 font-display text-[16px] font-bold text-white shadow-lg shadow-flag/25 disabled:opacity-40"
			>
				Start round
			</button>
		</main>
	);
}

function Section({
	title,
	hint,
	children,
}: {
	title: string;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<section className="mt-6">
			<h2 className="font-display text-sm font-semibold uppercase tracking-wide text-moss">
				{title}
			</h2>
			{hint ? <p className="mt-0.5 text-[12px] text-stone">{hint}</p> : null}
			<div className="mt-3">{children}</div>
		</section>
	);
}

function PlayerRow({
	name,
	hi,
	onHi,
	ph,
}: {
	name: string;
	hi: string;
	onHi: (v: string) => void;
	ph: number | undefined;
}) {
	return (
		<div className="flex items-center gap-2">
			<span className="min-w-0 flex-1 rounded-lg border border-card-line bg-white/60 px-3 py-2 font-display text-[15px] font-semibold text-ink">
				{name}
			</span>
			<HiInput value={hi} onChange={onHi} ph={ph} />
		</div>
	);
}

function HiInput({
	value,
	onChange,
	ph,
}: {
	value: string;
	onChange: (v: string) => void;
	ph: number | undefined;
}) {
	return (
		<span className="flex items-center gap-1.5">
			<input
				value={value}
				placeholder="HI"
				inputMode="decimal"
				onChange={(e) => onChange(e.target.value)}
				className="w-16 rounded-lg border border-card-line bg-cream px-2 py-2 text-center text-[15px] text-ink"
			/>
			<span className="w-10 text-center font-display text-[13px] font-semibold text-live">
				{ph !== undefined ? `PH ${ph}` : "—"}
			</span>
		</span>
	);
}
```

Note: `api.courses.get`'s holes include `ref?: string` — the flatMap in `loops` handles the optional. `useQuery(..., "skip")` is the Convex idiom for conditional queries.

- [ ] **Step 2: Wire the Home CTA**

In `src/routes/index.tsx`, make the "Start a round" element a `Link` to `/rounds/new` (import `Link` from `@tanstack/react-router`; keep the existing Fairway styling — orange pill CTA). If the current placeholder has no CTA yet, add one under the hero:

```tsx
<Link
	to="/rounds/new"
	className="mt-6 block w-full rounded-full bg-flag px-6 py-4 text-center font-display text-[16px] font-bold text-white shadow-lg shadow-flag/25"
>
	Start a round
</Link>
```

- [ ] **Step 3: Route-gen, typecheck, lint, build**

Run: `pnpm generate-routes && pnpm typecheck && pnpm lint:fix && pnpm check && pnpm build`
Expected: all exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/routes/rounds.new.tsx src/routes/index.tsx src/routeTree.gen.ts
git commit -m "feat(ui): round setup — course, loop composition, guests, format, playing handicaps"
```

---

## Task 7: Scorecard route (`/card` rewrite)

**Files:**
- Modify: `src/routes/card.tsx` (replace the placeholder)

- [ ] **Step 1: Rewrite the scorecard**

Replace `src/routes/card.tsx` entirely:

```tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import {
	formatVsPar,
	type ScoreMark,
	scoreMark,
	splitTotals,
	stablefordPoints,
	totalStrokes,
	vsPar,
} from "../domain/scoring";

export const Route = createFileRoute("/card")({ component: CardScreen });

function CardScreen() {
	const data = useQuery(api.rounds.active);
	const navigate = useNavigate();
	const setScore = useMutation(api.rounds.setScore);
	const finish = useMutation(api.rounds.finish);
	const abandon = useMutation(api.rounds.abandon);
	const [selected, setSelected] = useState(0);
	const [playerIndex, setPlayerIndex] = useState(0);
	const [confirmFinish, setConfirmFinish] = useState(false);

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
				<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
					Scorecard
				</h1>
				<p className="mt-1 text-[13px] text-moss">No active round.</p>
				<Link
					to="/rounds/new"
					className="mt-6 block w-full rounded-full bg-flag px-6 py-4 text-center font-display text-[16px] font-bold text-white shadow-lg shadow-flag/25"
				>
					Start a round
				</Link>
			</main>
		);
	}

	const { round, course, holes, scores } = data;
	const player = round.players[playerIndex];

	const scoreOf = (holeIndex: number, pIdx: number) =>
		scores.find((s) => s.holeIndex === holeIndex && s.playerIndex === pIdx);

	const strokesFor = (pIdx: number): (number | null)[] =>
		holes.map((_, i) => {
			const s = scoreOf(i, pIdx);
			return s?.nr ? null : (s?.strokes ?? null);
		});

	const ownerStrokes = strokesFor(playerIndex);
	const playedPars = holes.map((h) => h.par);
	const total = totalStrokes(ownerStrokes);
	const diff = vsPar(
		playedPars.map((par) => ({ par })),
		ownerStrokes,
	);
	const points = ownerStrokes.reduce<number>(
		(sum, s, i) =>
			sum + stablefordPoints(holes[i], s, player.playingHandicap ?? 0),
		0,
	);
	const nines = splitTotals(ownerStrokes, 9);

	const selHole = holes[selected];
	const selScore = scoreOf(selected, playerIndex);

	const patch = (fields: Record<string, number | boolean | undefined>) =>
		setScore({
			roundId: round._id,
			holeIndex: selected,
			playerIndex,
			...fields,
		});

	async function onFinish() {
		await finish({ roundId: round._id });
		setConfirmFinish(false);
		navigate({ to: "/" });
	}

	return (
		<main className="px-5 pt-16 pb-[110px]">
			<header className="flex items-baseline justify-between">
				<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
					{course.name}
				</h1>
				<span className="text-[12px] text-moss">{round.loopLabel}</span>
			</header>

			{/* Player switcher (owner + guests) */}
			{round.players.length > 1 ? (
				<div className="mt-3 flex gap-2">
					{round.players.map((p, i) => (
						<button
							type="button"
							key={`${i}-${p.name}`}
							onClick={() => setPlayerIndex(i)}
							className={`rounded-full border px-3 py-1.5 font-display text-[12px] font-semibold ${
								playerIndex === i
									? "border-pine bg-pine text-cream"
									: "border-card-line bg-white/60 text-ink"
							}`}
						>
							{p.name}
							{p.playingHandicap !== undefined ? ` · ${p.playingHandicap}` : " · —"}
						</button>
					))}
				</div>
			) : null}

			{/* Grid: rows of 9 */}
			{Array.from({ length: Math.ceil(holes.length / 9) }, (_, row) => (
				<div key={`row-${row}`} className="mt-4 grid grid-cols-9 gap-1">
					{holes.slice(row * 9, row * 9 + 9).map((hole, i) => {
						const holeIndex = row * 9 + i;
						const s = scoreOf(holeIndex, playerIndex);
						const strokes = s?.nr ? null : (s?.strokes ?? null);
						return (
							<button
								type="button"
								key={hole.ref}
								onClick={() => setSelected(holeIndex)}
								className={`flex flex-col items-center rounded-lg py-1.5 ${
									selected === holeIndex ? "bg-pine/10 ring-1 ring-pine" : ""
								}`}
							>
								<span className="text-[10px] font-semibold text-stone">
									{holeIndex + 1}
								</span>
								<MarkCell
									mark={scoreMark(hole.par, strokes)}
									strokes={s?.nr ? "NR" : (strokes ?? "·")}
								/>
								<span className="text-[9px] text-stone">{hole.par}</span>
							</button>
						);
					})}
				</div>
			))}

			{/* Totals strip */}
			<div className="mt-4 flex items-center justify-between rounded-2xl border border-card-line bg-white/60 px-4 py-3">
				<Total label="Out" value={nines[0] || "—"} />
				{nines.length > 1 ? <Total label="In" value={nines[1] || "—"} /> : null}
				<Total label="Total" value={total || "—"} />
				<Total label="vs par" value={total ? formatVsPar(diff) : "—"} accent />
				{round.format === "stableford" ? (
					<Total label="Pts" value={points} accent />
				) : null}
			</div>

			{/* Hole editor */}
			<section className="mt-5 rounded-2xl border border-card-line bg-white/60 p-4">
				<div className="flex items-baseline justify-between">
					<h2 className="font-display text-lg font-bold text-ink">
						Hole {selected + 1}
						<span className="ml-2 text-[12px] font-semibold text-moss">
							par {selHole.par} · SI {selHole.strokeIndex}
						</span>
					</h2>
					<span className="text-[11px] uppercase tracking-wide text-stone">
						{player.name}
					</span>
				</div>

				<Stepper
					label="Strokes"
					value={selScore?.nr ? null : (selScore?.strokes ?? null)}
					min={1}
					onChange={(n2) => patch({ strokes: n2, nr: false })}
				/>
				{playerIndex === 0 ? (
					<>
						<Stepper
							label="Putts"
							value={selScore?.putts ?? null}
							min={0}
							onChange={(n2) => patch({ putts: n2 })}
						/>
						<div className="mt-3 flex gap-2">
							{selHole.par > 3 ? (
								<Toggle
									label="FIR"
									on={selScore?.fir ?? false}
									onToggle={() => patch({ fir: !(selScore?.fir ?? false) })}
								/>
							) : null}
							<Toggle
								label="GIR"
								on={selScore?.gir ?? false}
								onToggle={() => patch({ gir: !(selScore?.gir ?? false) })}
							/>
							<Toggle
								label="NR"
								flag
								on={selScore?.nr ?? false}
								onToggle={() => patch({ nr: !(selScore?.nr ?? false) })}
							/>
						</div>
					</>
				) : null}

				<div className="mt-4 flex justify-between">
					<button
						type="button"
						disabled={selected === 0}
						onClick={() => setSelected((s) => s - 1)}
						className="rounded-full border border-card-line px-4 py-2 font-display text-[13px] font-semibold text-ink disabled:opacity-40"
					>
						← Prev
					</button>
					<button
						type="button"
						disabled={selected === holes.length - 1}
						onClick={() => setSelected((s) => s + 1)}
						className="rounded-full border border-card-line px-4 py-2 font-display text-[13px] font-semibold text-ink disabled:opacity-40"
					>
						Next →
					</button>
				</div>
			</section>

			{/* Finish / abandon */}
			{confirmFinish ? (
				<div className="mt-6 rounded-2xl border border-flag/40 bg-flag/5 p-4">
					<p className="text-[13px] font-semibold text-ink">
						Finish this round? Totals and your differential get stamped.
					</p>
					<div className="mt-3 flex gap-2">
						<button
							type="button"
							onClick={onFinish}
							className="flex-1 rounded-full bg-flag px-4 py-3 font-display text-[14px] font-bold text-white"
						>
							Finish round
						</button>
						<button
							type="button"
							onClick={() => setConfirmFinish(false)}
							className="rounded-full border border-card-line px-4 py-3 font-display text-[14px] font-semibold text-ink"
						>
							Cancel
						</button>
					</div>
				</div>
			) : (
				<div className="mt-6 flex gap-2">
					<button
						type="button"
						onClick={() => setConfirmFinish(true)}
						className="flex-1 rounded-full bg-pine px-4 py-3 font-display text-[14px] font-bold text-cream"
					>
						Finish round
					</button>
					<button
						type="button"
						onClick={async () => {
							await abandon({ roundId: round._id });
						}}
						className="rounded-full border border-card-line px-4 py-3 font-display text-[13px] font-semibold text-moss"
					>
						Abandon
					</button>
				</div>
			)}
		</main>
	);
}

/** Classic golf notation: circle = under par, square = over par (spec §3). */
function MarkCell({
	mark,
	strokes,
}: {
	mark: ScoreMark | null;
	strokes: number | string;
}) {
	const base =
		"flex size-7 items-center justify-center font-display text-[13px] font-bold";
	switch (mark) {
		case "eagle":
			return (
				<span className={`${base} rounded-full bg-flag text-white`}>
					{strokes}
				</span>
			);
		case "birdie":
			return (
				<span className={`${base} rounded-full border-2 border-flag text-ink`}>
					{strokes}
				</span>
			);
		case "bogey":
			return (
				<span className={`${base} rounded-md border-2 border-stone text-ink`}>
					{strokes}
				</span>
			);
		case "double":
			return (
				<span className={`${base} rounded-md bg-stone text-white`}>
					{strokes}
				</span>
			);
		default:
			return <span className={`${base} text-ink`}>{strokes}</span>;
	}
}

function Total({
	label,
	value,
	accent,
}: {
	label: string;
	value: number | string;
	accent?: boolean;
}) {
	return (
		<span className="flex flex-col items-center">
			<span className="text-[10px] uppercase tracking-wide text-stone">
				{label}
			</span>
			<span
				className={`font-display text-[17px] font-bold ${accent ? "text-live" : "text-ink"}`}
			>
				{value}
			</span>
		</span>
	);
}

function Stepper({
	label,
	value,
	min,
	onChange,
}: {
	label: string;
	value: number | null;
	min: number;
	onChange: (n: number) => void;
}) {
	return (
		<div className="mt-3 flex items-center justify-between">
			<span className="text-[13px] font-semibold text-moss">{label}</span>
			<span className="flex items-center gap-3">
				<button
					type="button"
					aria-label={`decrease ${label}`}
					disabled={value === null || value <= min}
					onClick={() => value !== null && onChange(value - 1)}
					className="rounded-full border border-card-line p-2 text-ink disabled:opacity-30"
				>
					<Minus className="size-4" />
				</button>
				<span className="w-8 text-center font-display text-xl font-bold text-ink">
					{value ?? "·"}
				</span>
				<button
					type="button"
					aria-label={`increase ${label}`}
					onClick={() => onChange(value === null ? Math.max(min, 1) : value + 1)}
					className="rounded-full border border-card-line p-2 text-ink"
				>
					<Plus className="size-4" />
				</button>
			</span>
		</div>
	);
}

function Toggle({
	label,
	on,
	onToggle,
	flag,
}: {
	label: string;
	on: boolean;
	onToggle: () => void;
	flag?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onToggle}
			className={`rounded-full border px-4 py-2 font-display text-[12px] font-bold ${
				on
					? flag
						? "border-flag bg-flag text-white"
						: "border-live bg-live text-white"
					: "border-card-line bg-white/60 text-moss"
			}`}
		>
			{label}
		</button>
	);
}
```

Notes:
- Guests get strokes only (`playerIndex !== 0` hides putts/FIR/GIR/NR) — spec §4.
- FIR hidden on par 3 (spec §8). Totals strip recomputes per selected player.
- Convex reactivity keeps the grid live as `setScore` writes land; no local mirror state.

- [ ] **Step 2: Typecheck, lint, build**

Run: `pnpm typecheck && pnpm lint:fix && pnpm check && pnpm build`
Expected: all exit 0. (`/card` already exists in the route tree — no generate-routes needed, but running it is harmless.)

- [ ] **Step 3: Commit**

```bash
git add src/routes/card.tsx
git commit -m "feat(ui): scorecard — notation grid, hole editor, live totals, finish/abandon"
```

---

## Task 8: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Regenerate + drift check**

Run: `pnpm exec convex codegen && pnpm generate-routes && git status --short`
Expected: no drift (commit any that appears).

- [ ] **Step 2: The four gates**

- `pnpm check` → 0
- `pnpm typecheck` → 0
- `pnpm test` → all suites pass (Plans 1+2 suites + `loops` + scoring additions; expect ~7 files / 60+ tests)
- `pnpm build` → 0

- [ ] **Step 3: Live end-to-end replay (fresh)**

With `pnpm exec convex dev --once` pushed, replay the whole flow once from clean state via `convex run`: abandon any active round → `rounds:start` (Oosterhoutse 18, 2 players) → 18× `setScore` → one overwrite → `finish` → assert numeric differential and `rounds:active` → null. This is the plan's definition of "playable rounds end-to-end".

- [ ] **Step 4: Secrets scan + wrap up**

Run: `git log --oneline` over the plan range + `git status`; confirm no `.env*`, keys, or tokens anywhere.

---

## Self-review checklist (run after execution)

1. **Spec §4 round setup:** course picker (seeded courses) ✓ · loop selection incl. combinations ✓ · tee (single default tee auto-used; multi-tee picker deferred until multiple tees exist) ✓ · guest partners name+HI ✓ · format ✓ · playing handicap per player computed and shown ✓.
2. **Spec §4 scorecard:** 9×2 grid ✓ · notation marks ✓ · tap-to-select hole editor ✓ · strokes all players ✓ · putts + FIR/GIR owner-only ✓ · FIR hidden par-3 ✓ · running total, vs par, Stableford, Out/In ✓.
3. **Spec §8:** NR → 0 points + voids differential ✓ · guest w/o HI off scratch "—" ✓ · loops compose 9/18, scorecard adapts ✓ · last-write-wins ✓.
4. **Type consistency:** `holeRefs`/`holeIndex` naming identical across schema, rounds.ts, and both routes; `Loop`/`ScoreMark` shapes match between domain and UI imports.
5. **No placeholders; no secrets.**

## Known deferrals (carried forward)

- **Search/import a new course via GolfCourseAPI in setup** — still deferred with the importer (Plan 2 deferral).
- **Multi-tee picker** — setup uses `tees[0]`; both seeded courses have exactly one editable default tee. Add a picker when a second tee exists (editor already upserts only tee 0; extend then).
- **Owner HI prefill from `userSettings` + round history/summary UI** — Plan 5 (Home/Progress/Profile).
- **9-hole WHS differentials** — v1 stamps differentials for 18-hole rounds only.
- **Offline buffering of `setScore`** — Plan 6 (mutation buffer); writes are direct Convex mutations here.
- **Browser QA of both routes** — still blocked on a Clerk dev publishable key in `.env.local`.
