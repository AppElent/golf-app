import { describe, expect, it } from "vitest";
import {
	countedStrokes,
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
			girMade: 1,
			girHoles: 2,
		});
	});

	it("has no putts total when none were recorded", () => {
		expect(ownerRoundStats(holes, []).putts).toBeNull();
	});
});
