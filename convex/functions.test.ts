// @vitest-environment edge-runtime
/// <reference types="vite/client" />
/**
 * Convex functions against an in-memory backend (convex-test): the auth and
 * ownership rules every per-user function relies on, a round from start to
 * history, and the catalog sync's idempotence.
 */

import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import * as seed from "./seed";
import * as seedPreview from "./seedPreview";

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

	it("refuses course writes without a session", async () => {
		const { t, course } = await setup();
		const courseId = course.course._id;
		const writes = [
			t.mutation(api.courses.fork, { courseId }),
			t.mutation(api.courses.updateMeta, { courseId, name: "x" }),
			t.mutation(api.courses.upsertTee, {
				courseId,
				name: "x",
				courseRating: 70,
				slopeRating: 120,
			}),
			t.mutation(api.courses.upsertHole, {
				holeId: course.holes[0]._id,
				par: 3,
			}),
			t.mutation(api.courses.remove, { courseId }),
			t.mutation(api.courses.suggest, { courseId, message: "x" }),
		];
		for (const write of writes)
			await expect(write).rejects.toThrow("Not signed in.");
	});

	it("keeps the seed entry points internal", () => {
		for (const fn of [seed.seedDummyData, seedPreview.seedPreview]) {
			expect(fn.isInternal).toBe(true);
		}
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
		await alice.mutation(api.rounds.finish, { roundId });

		expect(await alice.query(api.rounds.active, {})).toBeNull();
		const history = await alice.query(api.rounds.history, {});
		expect(history.map((r) => r._id)).toEqual([roundId]);
		expect(history[0].owner.strokes).toBe(parTotal + 9);
		expect(history[0].differential).toBeTypeOf("number");
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

	it("clears a hole's field with null and keeps omitted ones", async () => {
		const { alice, course } = await setup();
		const courseId = await alice.mutation(api.courses.fork, {
			courseId: course.course._id,
		});
		const copy = await alice.query(api.courses.get, { courseId });
		const holeId = copy?.holes[0]._id ?? course.holes[0]._id;
		const hole = async () => {
			const row = await alice.query(api.courses.get, { courseId });
			const found = row?.holes.find((h) => h._id === holeId);
			return { par: found?.par, strokeIndex: found?.strokeIndex };
		};

		await alice.mutation(api.courses.upsertHole, {
			holeId,
			par: 5,
			strokeIndex: 7,
		});
		await alice.mutation(api.courses.upsertHole, { holeId, par: null });
		expect(await hole()).toEqual({ par: undefined, strokeIndex: 7 });

		await alice.mutation(api.courses.upsertHole, { holeId, par: 4 });
		expect(await hole()).toEqual({ par: 4, strokeIndex: 7 });

		await alice.mutation(api.courses.upsertHole, { holeId, strokeIndex: null });
		expect(await hole()).toEqual({ par: 4, strokeIndex: undefined });
	});

	it("keeps another user's copy out of reach", async () => {
		const { alice, bob, course } = await setup();
		const copyId = await alice.mutation(api.courses.fork, {
			courseId: course.course._id,
		});
		const copy = await alice.query(api.courses.get, { courseId: copyId });
		const notFound = "Course not found.";
		await expect(
			bob.mutation(api.courses.updateMeta, { courseId: copyId, name: "x" }),
		).rejects.toThrow(notFound);
		await expect(
			bob.mutation(api.courses.upsertHole, {
				holeId: copy?.holes[0]._id ?? course.holes[0]._id,
				par: 3,
			}),
		).rejects.toThrow(notFound);
		await expect(
			bob.mutation(api.courses.remove, { courseId: copyId }),
		).rejects.toThrow(notFound);
		await expect(
			bob.mutation(api.courses.fork, { courseId: copyId }),
		).rejects.toThrow(notFound);
		await expect(
			bob.mutation(api.settings.update, { homeCourseId: copyId }),
		).rejects.toThrow(notFound);
		await expect(
			bob.mutation(api.rounds.start, {
				courseId: copyId,
				teeId: course.tees[0]._id,
				holeRefs: ["1"],
				format: "stroke",
				players: [{ name: "Bob" }],
			}),
		).rejects.toThrow(notFound);
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

describe("legacy catalog adoption", () => {
	const loopRefs = Array.from({ length: 9 }, (_, i) => `(${i + 1})`);

	/** A pre-catalog Welderen: one OSM import holding both layouts, with a
	 *  finished round and an active one on the par-3 loop. */
	async function legacyDeployment() {
		const t = convexTest(schema, modules);
		const ids = await t.run(async (ctx) => {
			const courseId = await ctx.db.insert("courses", {
				name: "Golfbaan Landgoed Welderen",
				osmRelationId: 901850,
				importStatus: "imported",
			});
			for (let n = 1; n <= 18; n++) {
				await ctx.db.insert("holes", {
					courseId,
					number: n,
					ref: String(n),
					par: 4,
					strokeIndex: n,
				});
			}
			for (const [i, ref] of loopRefs.entries()) {
				await ctx.db.insert("holes", {
					courseId,
					number: i + 1,
					ref,
					par: 3,
					strokeIndex: i + 1,
				});
			}
			const teeId = await ctx.db.insert("tees", {
				courseId,
				name: "Geel",
				courseRating: 60,
				slopeRating: 100,
			});
			const round = {
				courseId,
				teeId,
				holeRefs: loopRefs,
				startedAt: 1,
				format: "stroke" as const,
				players: [{ name: "Alice" }],
			};
			const finished = await ctx.db.insert("rounds", {
				...round,
				userId: ALICE.subject,
				status: "finished",
			});
			for (const [holeIndex] of loopRefs.entries()) {
				await ctx.db.insert("holeScores", {
					roundId: finished,
					holeIndex,
					playerIndex: 0,
					strokes: 4,
				});
			}
			const active = await ctx.db.insert("rounds", {
				...round,
				userId: BOB.subject,
				status: "active",
			});
			return { courseId, finished, active };
		});
		return { t, ...ids };
	}

	it("keeps the par of holes old rounds played", async () => {
		const { t, courseId, finished, active } = await legacyDeployment();
		await t.mutation(internal.courseCatalog.sync, {});
		await t.mutation(internal.courseCatalog.sync, {});

		const alice = t.withIdentity(ALICE);
		const detail = await alice.query(api.rounds.detail, { roundId: finished });
		if (!detail) throw new Error("legacy round missing");
		const finishedTee = detail.tee._id;
		expect(detail.holes.map((h) => h.par)).toEqual(loopRefs.map(() => 3));
		const [summary] = await alice.query(api.rounds.history, {});
		expect(summary.owner.vsPar).toBe(9);
		const bobRound = await t.withIdentity(BOB).query(api.rounds.active, {});
		expect(bobRound?.round._id).toBe(active);
		expect(bobRound?.holes.every((h) => h.par === 3)).toBe(true);

		// The adopted course now shows only its own 18 holes.
		const course = await alice.query(api.courses.get, { courseId });
		expect(course?.course.catalogKey).toBe("welderen");
		expect(course?.holes.map((h) => h.ref)).toEqual(
			Array.from({ length: 18 }, (_, i) => String(i + 1)),
		);
		await expect(
			alice.mutation(api.rounds.start, {
				courseId,
				teeId: course?.tees[0]._id ?? finishedTee,
				holeRefs: ["(1)"],
				format: "stroke",
				players: [{ name: "Alice" }],
			}),
		).rejects.toThrow("Holes missing par/stroke index: (1)");
	});

	it("deletes retired holes once no round uses them", async () => {
		const { t, courseId, finished, active } = await legacyDeployment();
		await t.mutation(internal.courseCatalog.sync, {});
		await t.withIdentity(ALICE).mutation(api.rounds.remove, {
			roundId: finished,
		});
		await t.withIdentity(BOB).mutation(api.rounds.abandon, { roundId: active });
		await t.mutation(internal.courseCatalog.sync, {});
		const holes = await t.run((ctx) =>
			ctx.db
				.query("holes")
				.withIndex("by_course", (q) => q.eq("courseId", courseId))
				.collect(),
		);
		expect(holes).toHaveLength(18);
		expect(holes.some((h) => h.retired)).toBe(false);
	});
});

describe("course copies", () => {
	async function playOnCopy() {
		const { t, alice, course } = await setup();
		const copyId = await alice.mutation(api.courses.fork, {
			courseId: course.course._id,
		});
		const copy = await alice.query(api.courses.get, { courseId: copyId });
		if (!copy) throw new Error("copy missing");
		const roundId = await startRound(alice, copy);
		return { t, alice, course, copyId, roundId };
	}

	it("refuses to delete a copy an active round is on", async () => {
		const { alice, copyId } = await playOnCopy();
		const error = await alice
			.mutation(api.courses.remove, { courseId: copyId })
			.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ConvexError);
		expect((error as ConvexError<{ code: string }>).data.code).toBe(
			"courseInActiveRound",
		);
		expect(await alice.query(api.rounds.active, {})).not.toBeNull();
	});

	it("deletes a copy with only a simulation on it, simulation included", async () => {
		const { t, alice, course } = await setup();
		const copyId = await alice.mutation(api.courses.fork, {
			courseId: course.course._id,
		});
		const copy = await alice.query(api.courses.get, { courseId: copyId });
		if (!copy) throw new Error("copy missing");
		await alice.mutation(api.rounds.start, {
			courseId: copy.course._id,
			teeId: copy.tees[0]._id,
			holeRefs: copy.holes.flatMap((h) => (h.ref ? [h.ref] : [])),
			format: "stroke",
			players: [{ name: "Alice" }],
			simulated: true,
		});
		await alice.mutation(api.courses.remove, { courseId: copyId });
		expect(await alice.query(api.rounds.activeSimulation, {})).toBeNull();
		expect(await t.run((ctx) => ctx.db.get(copyId))).toBeNull();
	});

	it("retires a copy finished rounds were played on", async () => {
		const { alice, course, copyId, roundId } = await playOnCopy();
		await alice.mutation(api.rounds.finish, { roundId });
		await alice.mutation(api.courses.remove, { courseId: copyId });

		const list = await alice.query(api.courses.list, {});
		expect(list.map((c) => c._id)).not.toContain(copyId);
		const detail = await alice.query(api.rounds.detail, { roundId });
		expect(detail?.course._id).toBe(copyId);
		expect(detail?.holes.every((h) => h.par > 0)).toBe(true);
		await expect(
			alice.mutation(api.rounds.start, {
				courseId: copyId,
				teeId: detail?.tee._id ?? course.tees[0]._id,
				holeRefs: ["1"],
				format: "stroke",
				players: [{ name: "Alice" }],
			}),
		).rejects.toThrow("Course not found.");
	});

	it("deletes an unplayed copy with its tees, holes and geometry", async () => {
		const { t, alice, copyId, roundId } = await playOnCopy();
		await alice.mutation(api.rounds.abandon, { roundId });
		await alice.mutation(api.courses.remove, { courseId: copyId });
		const left = await t.run(async (ctx) => ({
			course: await ctx.db.get(copyId),
			rows: (
				await Promise.all(
					(["tees", "holes", "holeGeometry"] as const).map((table) =>
						ctx.db
							.query(table)
							.withIndex("by_course", (q) => q.eq("courseId", copyId))
							.collect(),
					),
				)
			).flat(),
		}));
		expect(left.course).toBeNull();
		expect(left.rows).toHaveLength(0);
	});
});

describe("clubs and shots", () => {
	it("keep one user's clubs and shots from another", async () => {
		const { alice, bob, course } = await setup();
		const clubId = await alice.mutation(api.clubs.create, {
			name: "7i",
			carryMeters: 150,
		});
		const roundId = await startRound(alice, course);
		const shotId = await alice.mutation(api.shots.mark, {
			roundId,
			holeIndex: 0,
			position: { lat: 51.6, lng: 4.87 },
		});

		expect(await bob.query(api.clubs.list, {})).toEqual([]);
		expect(await bob.query(api.shots.mine, {})).toEqual([]);
		expect(await bob.query(api.rounds.detail, { roundId })).toBeNull();
		await expect(
			bob.mutation(api.clubs.update, { clubId, carryMeters: 1 }),
		).rejects.toThrow("Club not found.");
		await expect(
			bob.mutation(api.clubs.reorder, { orderedIds: [clubId] }),
		).rejects.toThrow("Club not found.");
		await expect(bob.mutation(api.clubs.remove, { clubId })).rejects.toThrow(
			"Club not found.",
		);
		await expect(bob.query(api.shots.forRound, { roundId })).rejects.toThrow(
			"Round not found.",
		);
		await expect(
			bob.mutation(api.shots.setClub, { shotId, club: "PW" }),
		).rejects.toThrow("Shot not found.");
		await expect(bob.mutation(api.rounds.finish, { roundId })).rejects.toThrow(
			"Round not found.",
		);
		await expect(bob.mutation(api.rounds.abandon, { roundId })).rejects.toThrow(
			"Round not found.",
		);
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

	it("deletes the caller's course copies and suggestions, not the catalog", async () => {
		const { t, alice, bob, course } = await setup();
		const catalogId = course.course._id;
		const aliceCopy = await alice.mutation(api.courses.fork, {
			courseId: catalogId,
		});
		await alice.mutation(api.courses.suggest, {
			courseId: aliceCopy,
			message: "hole 1 is a par 4",
		});
		const bobCopy = await bob.mutation(api.courses.fork, {
			courseId: catalogId,
		});
		await bob.mutation(api.courses.suggest, {
			courseId: catalogId,
			message: "hole 2 is a par 5",
		});

		await alice.mutation(api.account.deleteMyData, {});

		const left = await t.run(async (ctx) => ({
			courses: await ctx.db.query("courses").collect(),
			suggestions: await ctx.db.query("courseSuggestions").collect(),
			copyRows: (
				await Promise.all(
					(["tees", "holes", "holeGeometry"] as const).map((table) =>
						ctx.db
							.query(table)
							.withIndex("by_course", (q) => q.eq("courseId", aliceCopy))
							.collect(),
					),
				)
			).flat(),
		}));
		const ids = left.courses.map((c) => c._id);
		expect(ids).not.toContain(aliceCopy);
		expect(ids).toContain(bobCopy);
		expect(ids).toContain(catalogId);
		expect(left.copyRows).toHaveLength(0);
		expect(left.suggestions.map((s) => s.userId)).toEqual([BOB.subject]);
		expect(await alice.query(api.courses.get, { courseId: catalogId })).toEqual(
			course,
		);
	});
});

describe("simulated rounds", () => {
	async function startSimulation(
		who: Awaited<ReturnType<typeof setup>>["alice"],
		course: NonNullable<Awaited<ReturnType<typeof setup>>["course"]>,
	) {
		return await who.mutation(api.rounds.start, {
			courseId: course.course._id,
			teeId: course.tees[0]._id,
			holeRefs: course.holes.slice(0, 9).flatMap((h) => (h.ref ? [h.ref] : [])),
			format: "stroke",
			players: [{ name: "Alice", handicapIndex: 3 }],
			simulated: true,
		});
	}

	it("runs alongside a real round without touching it", async () => {
		const { alice, course } = await setup();
		const real = await startRound(alice, course);
		const sim = await startSimulation(alice, course);
		expect((await alice.query(api.rounds.active, {}))?.round._id).toBe(real);
		expect(
			(await alice.query(api.rounds.activeSimulation, {}))?.round._id,
		).toBe(sim);
	});

	it("keeps out of the active round, and a real round can still start", async () => {
		const { alice, course } = await setup();
		await startSimulation(alice, course);
		expect(await alice.query(api.rounds.active, {})).toBeNull();
		await expect(startRound(alice, course)).resolves.toBeTruthy();
	});

	it("leaves the profile's handicap alone", async () => {
		const { alice, course } = await setup();
		await startSimulation(alice, course);
		expect((await alice.query(api.settings.get, {})).handicapIndex).toBeNull();
	});

	it("replaces the previous simulation, deleting its scores and shots", async () => {
		const { t, alice, course } = await setup();
		const first = await startSimulation(alice, course);
		await alice.mutation(api.rounds.setScore, {
			roundId: first,
			holeIndex: 0,
			playerIndex: 0,
			strokes: 4,
		});
		await alice.mutation(api.shots.mark, {
			roundId: first,
			holeIndex: 0,
			position: { lat: 52, lng: 5.9 },
		});
		const second = await startSimulation(alice, course);
		expect(second).not.toBe(first);
		const left = await t.run(async (ctx) => ({
			round: await ctx.db.get(first),
			scores: await ctx.db.query("holeScores").collect(),
			shots: await ctx.db.query("shots").collect(),
		}));
		expect(left).toEqual({ round: null, scores: [], shots: [] });
	});

	it("never reaches history, stats or the learned bag", async () => {
		const { alice, course } = await setup();
		const roundId = await startSimulation(alice, course);
		await alice.mutation(api.rounds.setScore, {
			roundId,
			holeIndex: 0,
			playerIndex: 0,
			strokes: 4,
		});
		await alice.mutation(api.shots.mark, {
			roundId,
			holeIndex: 0,
			position: { lat: 52, lng: 5.9 },
			club: "7i",
		});
		expect(await alice.query(api.shots.mine, {})).toEqual([]);
		expect(await alice.query(api.shots.forRound, { roundId })).toHaveLength(1);

		await alice.mutation(api.rounds.finish, { roundId });
		expect(await alice.query(api.rounds.activeSimulation, {})).toBeNull();
		expect(await alice.query(api.rounds.detail, { roundId })).toBeNull();
		expect(await alice.query(api.rounds.history, {})).toEqual([]);
		expect(await alice.query(api.rounds.holeResults, {})).toEqual([]);
	});

	it("is private to its owner, and needs a session", async () => {
		const { t, alice, bob, course } = await setup();
		const roundId = await startSimulation(alice, course);
		expect(await bob.query(api.rounds.activeSimulation, {})).toBeNull();
		await expect(bob.mutation(api.rounds.finish, { roundId })).rejects.toThrow(
			"Round not found.",
		);
		await expect(t.query(api.rounds.activeSimulation, {})).rejects.toThrow(
			"Not signed in.",
		);
	});

	it("shows the card length of the round's tee", async () => {
		const { alice, course } = await setup();
		const white = course.tees.find((tee) => tee.marker === "white");
		if (!white) throw new Error("no white tee");
		await alice.mutation(api.rounds.start, {
			courseId: course.course._id,
			teeId: white._id,
			holeRefs: ["1"],
			format: "stroke",
			players: [{ name: "Alice" }],
		});
		const active = await alice.query(api.rounds.active, {});
		const hole = course.holes.find((h) => h.ref === "1");
		expect(active?.holes[0].lengthMeters).toBe(hole?.lengths?.white);
		expect(active?.holes[0].lengthMeters).not.toBe(hole?.lengthMeters);
	});
});
