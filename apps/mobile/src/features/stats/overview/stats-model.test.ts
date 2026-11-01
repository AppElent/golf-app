import {
	clubRows,
	distributionShares,
	statInputs,
	wouldBeTrend,
} from "./stats-model";

const owner = {
	strokes: 90,
	vsPar: 18,
	putts: 34,
	holesWithPutts: 18,
	firMade: 6,
	firEligible: 14,
	girMade: 4,
	girHoles: 18,
};

describe("statInputs", () => {
	it("flattens the owner summary with the hole count", () => {
		expect(statInputs([{ differential: 10, holeCount: 18, owner }])).toEqual([
			{ holeCount: 18, ...owner },
		]);
	});
});

describe("wouldBeTrend", () => {
	it("runs oldest first and starts at the third differential", () => {
		const rounds = [30, 20, null, 10].map((differential) => ({
			differential,
			holeCount: 18,
			owner,
		}));
		// Oldest first: 10, 20, 30 → best 1 of 3 minus 2 = 8.
		expect(wouldBeTrend(rounds)).toEqual([8]);
	});
});

describe("distributionShares", () => {
	it("gives each bucket its share of scored holes", () => {
		const shares = distributionShares({
			eagles: 0,
			birdies: 1,
			pars: 2,
			bogeys: 1,
			doubles: 0,
		});
		expect(shares.find((s) => s.key === "pars")?.share).toBe(0.5);
	});
	it("is all zero without holes", () => {
		const shares = distributionShares({
			eagles: 0,
			birdies: 0,
			pars: 0,
			bogeys: 0,
			doubles: 0,
		});
		expect(shares.every((s) => s.share === 0)).toBe(true);
	});
});

describe("clubRows", () => {
	const shot = (club: string, lat: number, markedAt: number) => ({
		roundId: "r",
		holeIndex: 0,
		position: { lat, lng: 5 },
		club,
		markedAt,
	});
	it("keeps the bag order and appends clubs only seen in shots", () => {
		// ~0.0014° lat ≈ 156 m.
		const shots = [
			shot("7i", 52, 1),
			shot("Wood", 52.0014, 2),
			shot("PW", 52.0028, 3),
		];
		const rows = clubRows(
			[
				{ name: "Driver", carryMeters: 230 },
				{ name: "7i", carryMeters: 150 },
			],
			shots,
		);
		expect(rows.map((r) => r.name)).toEqual(["Driver", "7i", "Wood"]);
		expect(rows[0].learned).toBeNull();
		expect(rows[1].learned?.medianMeters).toBeCloseTo(156, -1);
		expect(rows[2].carryMeters).toBeNull();
	});
});
