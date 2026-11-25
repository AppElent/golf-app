import { describe, expect, it } from "vitest";
import {
	countedStrokes,
	derivedGir,
	type HoleScore,
	ownerRoundStats,
	playedHoles,
	playerStrokes,
} from "./round";

describe("countedStrokes", () => {
	it("counts nothing for a picked-up or unplayed hole", () => {
		expect(countedStrokes({ strokes: 7, nr: true })).toBeNull();
		expect(countedStrokes(undefined)).toBeNull();
		expect(countedStrokes({ strokes: 4 })).toBe(4);
	});
});

describe("playerStrokes", () => {
	it("reads one player's holes in order", () => {
		const scores = [
			{ holeIndex: 1, playerIndex: 0, strokes: 5 },
			{ holeIndex: 0, playerIndex: 1, strokes: 3 },
			{ holeIndex: 2, playerIndex: 0, strokes: 9, nr: true },
		];
		expect(playerStrokes(3, scores, 0)).toEqual([null, 5, null]);
	});
});

describe("playedHoles", () => {
	it("lists the owner's holes with strokes or a pick-up", () => {
		expect(
			playedHoles(4, [
				{ holeIndex: 0, playerIndex: 0, strokes: 4 },
				{ holeIndex: 1, playerIndex: 1, strokes: 4 },
				{ holeIndex: 2, playerIndex: 0, nr: true },
				{ holeIndex: 3, playerIndex: 0, putts: 2 },
			]),
		).toEqual([0, 2]);
	});
});

describe("derivedGir", () => {
	it.each([
		// par, strokes, putts, gir
		[3, 3, 2, true],
		[3, 4, 2, false],
		[3, 2, 1, true],
		[4, 4, 2, true],
		[4, 5, 3, true],
		[4, 5, 2, false],
		[5, 5, 2, true],
		[5, 6, 2, false],
		[5, 4, 1, true],
		// Holed from off the green.
		[4, 2, 0, true],
		[4, 3, 0, false],
	])("par %i, %i strokes, %i putts: %s", (par, strokes, putts, gir) => {
		expect(derivedGir(par, { strokes, putts, nr: false })).toBe(gir);
	});

	it("is unknown when picked up, without putts, or with only putts", () => {
		expect(derivedGir(4, { strokes: 4, putts: 2, nr: true })).toBeNull();
		expect(derivedGir(4, { strokes: 4, putts: null, nr: false })).toBeNull();
		expect(derivedGir(4, { strokes: null, putts: 2, nr: false })).toBeNull();
		expect(derivedGir(4, { strokes: 2, putts: 2, nr: false })).toBeNull();
	});
});

describe("ownerRoundStats", () => {
	const holes = [{ par: 4 }, { par: 3 }, { par: 5 }];

	it("pools the owner's results and skips other players", () => {
		const stats = ownerRoundStats(holes, [
			{
				holeIndex: 0,
				playerIndex: 0,
				strokes: 5,
				putts: 2,
				fir: true,
				gir: false,
			},
			{
				holeIndex: 1,
				playerIndex: 0,
				strokes: 3,
				putts: 1,
				fir: true,
				gir: true,
			},
			{
				holeIndex: 2,
				playerIndex: 1,
				strokes: 9,
				putts: 4,
				fir: true,
				gir: true,
			},
		]);
		expect(stats).toEqual({
			strokes: 8,
			vsPar: 1,
			putts: 3,
			holesWithPutts: 2,
			firMade: 1,
			firEligible: 1,
			firMissLeft: 0,
			firMissRight: 0,
			girMade: 1,
			girHoles: 2,
		});
	});

	it("counts missed fairways by side, where the side is known", () => {
		const miss = (holeIndex: number, over: Partial<HoleScore>): HoleScore => ({
			holeIndex,
			playerIndex: 0,
			strokes: 4,
			...over,
		});
		const stats = ownerRoundStats(
			[{ par: 4 }, { par: 4 }, { par: 5 }, { par: 4 }, { par: 3 }],
			[
				miss(0, { fir: false, firMiss: "left" }),
				miss(1, { fir: false, firMiss: "right" }),
				miss(2, { fir: false, firMiss: "right" }),
				// Older score: missed, side unknown.
				miss(3, { fir: false }),
				// No fairway on a par 3.
				miss(4, { fir: false, firMiss: "left" }),
			],
		);
		expect(stats).toMatchObject({
			firMade: 0,
			firEligible: 4,
			firMissLeft: 1,
			firMissRight: 2,
		});
	});

	it("has no putts total when none were recorded", () => {
		expect(ownerRoundStats(holes, []).putts).toBeNull();
	});
});
