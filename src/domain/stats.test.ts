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
		const s = aggregateStats([round({ putts: null, holesWithPutts: 0 })]);
		expect(s.puttsPer18).toBeNull();
	});
});
