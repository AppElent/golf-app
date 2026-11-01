import { describe, expect, it } from "vitest";
import { parTypeAverages, scoringDistribution } from "./par-stats";

const results = [
	{ par: 3, strokes: 3 },
	{ par: 3, strokes: 4 },
	{ par: 4, strokes: 6 },
	{ par: 4, strokes: null },
	{ par: 5, strokes: 4 },
	{ par: 5, strokes: 3 },
];

describe("parTypeAverages", () => {
	it("averages per par, skipping NR holes", () => {
		expect(parTypeAverages(results)).toEqual([
			{ par: 3, average: 3.5, holes: 2 },
			{ par: 4, average: 6, holes: 1 },
			{ par: 5, average: 3.5, holes: 2 },
		]);
	});
});

describe("scoringDistribution", () => {
	it("buckets scores to par", () => {
		expect(scoringDistribution(results)).toEqual({
			eagles: 1,
			birdies: 1,
			pars: 1,
			bogeys: 1,
			doubles: 1,
		});
	});
});
