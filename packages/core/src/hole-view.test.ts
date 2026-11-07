import { describe, expect, it } from "vitest";
import { greenNumbers, hazardsInPlay, holeAnchors } from "./hole-view";

// A hole running due north: tee at 0, green ~330 m north (0.003°).
const p = (dLat: number, dLng = 0) => ({ lat: 52 + dLat, lng: 5.9 + dLng });
const square = (dLat: number, dLng: number, r = 0.0001) => [
	p(dLat - r, dLng - r),
	p(dLat - r, dLng + r),
	p(dLat + r, dLng + r),
	p(dLat + r, dLng - r),
];
const geo = {
	holeLine: [p(0), p(0.003)],
	tees: [square(0, 0)],
	greens: [square(0.003, 0, 0.0001)],
	fairways: [],
	bunkers: [square(0.0018, 0.0002), square(0.0034, 0)],
	water: [square(0.0025, -0.0003), square(-0.0005, 0)],
};

describe("holeAnchors", () => {
	it("uses tee box and green centroids", () => {
		const a = holeAnchors(geo);
		expect(a?.tee.lat).toBeCloseTo(52, 6);
		expect(a?.green.lat).toBeCloseTo(52.003, 6);
		expect(a?.greenRing).toHaveLength(4);
	});
	it("plays from the tee box of the round's color, else the back tee", () => {
		const teeBoxes = [
			{ position: p(0.0005), colors: ["red", "orange"] },
			{ position: p(-0.0005), colors: ["white"] },
		];
		const withBoxes = { ...geo, teeBoxes };
		expect(holeAnchors(withBoxes, "red")?.tee).toEqual(p(0.0005));
		expect(holeAnchors(withBoxes, "white")?.tee).toEqual(p(-0.0005));
		expect(holeAnchors(withBoxes, "blue")?.tee).toEqual(p(-0.0005));
		expect(holeAnchors(withBoxes)?.tee).toEqual(p(-0.0005));
	});
	it("takes the farthest mapped tee when one was bucketed from a nearby hole", () => {
		const a = holeAnchors({ ...geo, tees: [square(0.0028, 0), square(0, 0)] });
		expect(a?.tee.lat).toBeCloseTo(52, 6);
	});
	it("spans the hole to its farthest tee or corner, whichever is played", () => {
		const teeBoxes = [
			{ position: p(0.0005), colors: ["red"] },
			{ position: p(-0.0005), colors: ["white"] },
		];
		const span = holeAnchors({ ...geo, teeBoxes }, "red")?.spanMeters;
		expect(Math.round(span ?? 0)).toBe(Math.round(0.0035 * 111195));
		const dogleg = [p(0.002), p(0.002, 0.01), p(0.003)];
		const corner = holeAnchors({ ...geo, holeLine: dogleg }, "red");
		expect(corner?.spanMeters).toBeGreaterThan(680);
	});
	it("falls back to the hole line, and to null", () => {
		const a = holeAnchors({ ...geo, tees: [], greens: [] });
		expect(a?.tee).toEqual(p(0));
		expect(a?.green).toEqual(p(0.003));
		expect(a?.greenRing).toBeNull();
		expect(
			holeAnchors({ ...geo, holeLine: [], tees: [], greens: [] }),
		).toBeNull();
	});
});

describe("hazardsInPlay", () => {
	it("keeps hazards ahead of you and short of the green, nearest first", () => {
		const hazards = hazardsInPlay(p(0), p(0.003), geo);
		expect(hazards.map((h) => h.kind)).toEqual(["bunker", "water"]);
		expect(hazards[0].reach).toBeLessThan(hazards[0].carry);
		expect(Math.round(hazards[0].reach)).toBeGreaterThan(185);
	});
	it("says which side of the line of play a hazard lies", () => {
		const hazards = hazardsInPlay(p(0), p(0.003), {
			holeLine: geo.holeLine,
			bunkers: [square(0.001, 0.0003)],
			water: [square(0.0015, -0.0003), square(0.002, 0)],
		});
		expect(hazards.map((h) => h.side)).toEqual(["right", "left", "center"]);
	});
	it("keeps a lake beside the line on its side, even curling past the green", () => {
		const crescent = [
			p(0.0025, 0.0001),
			p(0.0025, 0.0002),
			p(0.0035, 0.0002),
			p(0.0035, -0.0002),
			p(0.0033, -0.0002),
			p(0.0033, 0.0001),
		];
		const hazards = hazardsInPlay(p(0), p(0.003), {
			holeLine: [p(0), p(0.003)],
			bunkers: [],
			water: [crescent],
		});
		expect(hazards.map((h) => h.side)).toEqual(["right"]);
	});
	it("keeps the nearest bunker on a list full of water, over a bank", () => {
		const hazards = hazardsInPlay(
			p(0),
			p(0.003),
			{
				holeLine: [p(0), p(0.003)],
				bunkers: [square(0.0025, 0.0003)],
				water: [square(0.0005, 0.0003), square(0.001, 0), square(0.0015, 0)],
			},
			{ limit: 3 },
		);
		expect(hazards.map((h) => [h.kind, h.side])).toEqual([
			["water", "center"],
			["water", "center"],
			["bunker", "right"],
		]);
	});
	it("keeps a crossing on a capped list, even past a nearer bank", () => {
		const hazards = hazardsInPlay(
			p(0),
			p(0.003),
			{
				holeLine: [p(0), p(0.003)],
				bunkers: [square(0.0005, 0.0003)],
				water: [
					square(0.001, 0.0003),
					square(0.0015, -0.0003),
					square(0.0025, 0),
				],
			},
			{ limit: 3 },
		);
		expect(hazards.map((h) => [h.kind, h.side])).toEqual([
			["bunker", "right"],
			["water", "right"],
			["water", "center"],
		]);
	});
	it("follows a dogleg instead of the straight line to the green", () => {
		// Up 330 m, then 137 m east. The bunker sits on the corner, far off the
		// direct tee-to-green line.
		const dogleg = [p(0), p(0.003), p(0.003, 0.002)];
		const onCorner = square(0.003, 0.0002);
		const hazards = hazardsInPlay(
			p(0),
			p(0.003, 0.002),
			{ holeLine: dogleg, bunkers: [onCorner], water: [] },
			{ maxMeters: 600 },
		);
		expect(hazards).toHaveLength(1);
	});
	it("ignores hazards behind you, and those well behind the green", () => {
		const behindYou = square(-0.0003, 0);
		const longPastGreen = square(0.001, 0);
		const justPastGreen = square(0.00032, 0, 0.00005);
		const from = p(0);
		const hazards = hazardsInPlay(from, p(0.0003), {
			holeLine: [from, p(0.0003)],
			bunkers: [behindYou, longPastGreen, justPastGreen],
			water: [],
		});
		expect(hazards.map((h) => Math.round(h.reach))).toEqual([
			Math.round(0.00027 * 111195),
		]);
	});
	it("reads touching pieces of a ditch as one water hazard", () => {
		const piece = (from: number, to: number) => [
			p(from, 0.0002),
			p(from, 0.00025),
			p(to, 0.00025),
			p(to, 0.0002),
		];
		const hazards = hazardsInPlay(p(0), p(0.003), {
			holeLine: geo.holeLine,
			bunkers: [],
			water: [piece(0.0005, 0.001), piece(0.001, 0.0016)],
		});
		expect(hazards).toHaveLength(1);
		expect(hazards[0].carry).toBeGreaterThan(0.0015 * 111195);
	});
	it("measures water across the line where the line crosses it", () => {
		// 33 m of the line is in this lake; its shore runs on 200 m beside the line.
		const lake = [
			p(0.0005, -0.0002),
			p(0.0005, 0.0005),
			p(0.0025, 0.0005),
			p(0.0025, 0.0002),
			p(0.0008, 0.0002),
			p(0.0008, -0.0002),
		];
		const [across, beside] = hazardsInPlay(p(0), p(0.003), {
			holeLine: geo.holeLine,
			bunkers: [],
			water: [lake],
		});
		expect(across.side).toBe("center");
		expect(Math.round(across.reach)).toBe(56);
		expect(Math.round(across.carry)).toBe(89);
		expect(beside.side).toBe("right");
		expect(Math.round(beside.carry)).toBeGreaterThan(270);
	});
	it("lists each stretch when the line crosses the same water twice", () => {
		const horseshoe = [
			p(0.0003, -0.0002),
			p(0.0003, 0.0002),
			p(0.0009, 0.0002),
			p(0.0009, -0.0002),
			p(0.0008, -0.0002),
			p(0.0008, 0.0001),
			p(0.0004, 0.0001),
			p(0.0004, -0.0002),
		];
		const across = hazardsInPlay(p(0), p(0.003), {
			holeLine: geo.holeLine,
			bunkers: [],
			water: [horseshoe],
		}).filter((h) => h.side === "center");
		expect(
			across.map((h) => [Math.round(h.reach), Math.round(h.carry)]),
		).toEqual([
			[33, 44],
			[89, 100],
		]);
	});
	it("measures water beside the line along its bank, not its far shore", () => {
		// The near bank runs 22 m off the line, the far shore 300 m away.
		const bank = [
			p(0.001, 0.0003),
			p(0.0015, 0.0003),
			p(0.0015, 0.005),
			p(0.001, 0.005),
		];
		const [beside] = hazardsInPlay(p(0), p(0.003), {
			holeLine: geo.holeLine,
			bunkers: [],
			water: [bank],
		});
		expect(beside.side).toBe("right");
		expect(beside.reach).toBeGreaterThan(110);
		expect(beside.carry).toBeLessThan(175);
	});
	it("drops hazards out of range", () => {
		expect(hazardsInPlay(p(0), p(0.003), geo, { maxMeters: 150 })).toEqual([]);
	});
});

describe("greenNumbers", () => {
	it("gives front < center < back to a polygon, center-only to a point", () => {
		const a = holeAnchors(geo);
		if (!a) throw new Error("no anchors");
		const n = greenNumbers(p(0), a);
		expect(n.front).toBeLessThan(n.center);
		expect(n.back).toBeGreaterThan(n.center);
		const bare = greenNumbers(p(0), { ...a, greenRing: null });
		expect(bare.front).toBe(bare.back);
	});
});
