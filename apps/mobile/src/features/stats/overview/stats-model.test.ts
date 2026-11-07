import { clubRows, distributionShares } from "./stats-model";

describe("distributionShares", () => {
	it("gives each bucket its share of scored holes", () => {
		const shares = distributionShares({
			eagle: 0,
			birdie: 1,
			par: 2,
			bogey: 1,
			double: 0,
		});
		expect(shares.find((s) => s.key === "par")?.share).toBe(0.5);
	});
	it("is all zero without holes", () => {
		const shares = distributionShares({
			eagle: 0,
			birdie: 0,
			par: 0,
			bogey: 0,
			double: 0,
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
