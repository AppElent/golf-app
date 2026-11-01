// @vitest-environment edge-runtime
/// <reference types="vite/client" />
/**
 * Convex functions against an in-memory backend (convex-test): the auth and
 * ownership rules every per-user function relies on, a round from start to
 * history, and the catalog sync's idempotence.
 */
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

// Function modules plus `_generated`, which convex-test uses to find the root.
const modules = import.meta.glob([
	"./**/*.ts",
	"./_generated/*.js",
	"!./**/*.d.ts",
	"!./**/*.test.ts",
]);

const ALICE = { subject: "user_alice" };
const BOB = { subject: "user_bob" };

async function setup() {
	const t = convexTest(schema, modules);
	await t.mutation(internal.courseCatalog.sync, {});
	const alice = t.withIdentity(ALICE);
	const [summary] = await alice.query(api.courses.list, {});
	const course = await alice.query(api.courses.get, {
		courseId: summary._id,
	});
	if (!course) throw new Error("catalog course missing");
	return { t, alice, bob: t.withIdentity(BOB), course };
}

async function startRound(
	who: Awaited<ReturnType<typeof setup>>["alice"],
	course: NonNullable<Awaited<ReturnType<typeof setup>>["course"]>,
	holeCount = 9,
) {
	return await who.mutation(api.rounds.start, {
		courseId: course.course._id,
		teeId: course.tees[0]._id,
		holeRefs: course.holes
			.slice(0, holeCount)
			.flatMap((h) => (h.ref ? [h.ref] : [])),
		format: "stroke",
		players: [{ name: "Alice", handicapIndex: 18 }],
	});
}

describe("auth", () => {
	it("refuses per-user functions without a session", async () => {
		const t = convexTest(schema, modules);
		await expect(t.query(api.rounds.active, {})).rejects.toThrow(
			"Not signed in.",
		);
		await expect(t.mutation(api.account.deleteMyData, {})).rejects.toThrow(
			"Not signed in.",
		);
	});
});

describe("rounds", () => {
	it("plays a round from start to history", async () => {
		const { alice, course } = await setup();
		const roundId = await startRound(alice, course);

		const active = await alice.query(api.rounds.active, {});
		expect(active?.round._id).toBe(roundId);
		expect(active?.round.players[0].playingHandicap).toBeTypeOf("number");

		for (const [holeIndex, hole] of active?.holes.entries() ?? []) {
			await alice.mutation(api.rounds.setScore, {
				roundId,
				holeIndex,
				playerIndex: 0,
				strokes: hole.par + 1,
				putts: 2,
			});
		}
		const parTotal = active?.holes.reduce((sum, h) => sum + h.par, 0) ?? 0;
		const result = await alice.mutation(api.rounds.finish, { roundId });
		expect(result.totals[0].strokes).toBe(parTotal + 9);
		expect(result.scoreDifferential).toBeTypeOf("number");

		expect(await alice.query(api.rounds.active, {})).toBeNull();
		const history = await alice.query(api.rounds.history, {});
		expect(history.map((r) => r._id)).toEqual([roundId]);
	});

	it("allows one active round at a time", async () => {
		const { alice, course } = await setup();
		await startRound(alice, course);
		await expect(startRound(alice, course)).rejects.toThrow(
			"An active round already exists",
		);
	});

	it("clears a field with null and keeps omitted ones", async () => {
		const { alice, course } = await setup();
		const roundId = await startRound(alice, course);
		const score = { roundId, holeIndex: 0, playerIndex: 0 };
		await alice.mutation(api.rounds.setScore, {
			...score,
			strokes: 5,
			putts: 2,
		});
		await alice.mutation(api.rounds.setScore, { ...score, putts: null });
		const [row] = (await alice.query(api.rounds.active, {}))?.scores ?? [];
		expect(row).toMatchObject({ strokes: 5 });
		expect(row.putts).toBeUndefined();
	});

	it("hides one player's round from another", async () => {
		const { alice, bob, course } = await setup();
		const roundId = await startRound(alice, course);
		expect(await bob.query(api.rounds.active, {})).toBeNull();
		await expect(
			bob.mutation(api.rounds.setScore, {
				roundId,
				holeIndex: 0,
				playerIndex: 0,
				strokes: 1,
			}),
		).rejects.toThrow("Round not found.");
		await expect(bob.mutation(api.rounds.remove, { roundId })).rejects.toThrow(
			"Round not found.",
		);
		await expect(
			bob.mutation(api.shots.mark, {
				roundId,
				holeIndex: 0,
				position: { lat: 51.6, lng: 4.87 },
			}),
		).rejects.toThrow();
	});
});

describe("courses", () => {
	it("keeps catalog courses read-only", async () => {
		const { alice, course } = await setup();
		await expect(
			alice.mutation(api.courses.upsertHole, {
				holeId: course.holes[0]._id,
				par: 3,
			}),
		).rejects.toThrow("Catalog courses are read-only.");
	});

	it("gives a fork to its owner only", async () => {
		const { alice, bob, course } = await setup();
		const copyId = await alice.mutation(api.courses.fork, {
			courseId: course.course._id,
			name: "Mine",
		});
		const copy = await alice.query(api.courses.get, { courseId: copyId });
		expect(copy?.holes).toHaveLength(course.holes.length);
		await alice.mutation(api.courses.upsertHole, {
			holeId: copy?.holes[0]._id ?? course.holes[0]._id,
			par: 3,
			strokeIndex: 1,
		});

		expect(await bob.query(api.courses.get, { courseId: copyId })).toBeNull();
		const bobList = await bob.query(api.courses.list, {});
		expect(bobList.map((c) => c._id)).not.toContain(copyId);
	});

	it("syncs the catalog idempotently", async () => {
		const { t, alice } = await setup();
		const before = await alice.query(api.courses.list, {});
		const results = await t.mutation(internal.courseCatalog.sync, {});
		expect(results.every((r) => !r.created)).toBe(true);
		const after = await alice.query(api.courses.list, {});
		expect(after.map((c) => c._id)).toEqual(before.map((c) => c._id));
	});
});

describe("account", () => {
	it("deletes the caller's data and nobody else's", async () => {
		const { t, alice, bob, course } = await setup();
		const aliceRound = await startRound(alice, course);
		await alice.mutation(api.shots.mark, {
			roundId: aliceRound,
			holeIndex: 0,
			position: { lat: 51.6, lng: 4.87 },
		});
		await startRound(bob, course);

		await alice.mutation(api.account.deleteMyData, {});

		expect(await alice.query(api.rounds.active, {})).toBeNull();
		expect(await bob.query(api.rounds.active, {})).not.toBeNull();
		const leftovers = await t.run(async (ctx) => ({
			shots: await ctx.db.query("shots").collect(),
			settings: await ctx.db.query("userSettings").collect(),
		}));
		expect(leftovers.shots).toHaveLength(0);
		expect(leftovers.settings.map((s) => s.userId)).toEqual([BOB.subject]);
	});
});
