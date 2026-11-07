import { describe, expect, it } from "vitest";
import oosterhoutse from "./__fixtures__/oosterhoutse.overpass.json";
import welderen from "./__fixtures__/welderen.overpass.json";
import { normalizeCourse, parseHoleRef } from "./osm";

describe("parseHoleRef", () => {
	it("reads a plain number", () => {
		expect(parseHoleRef("10")).toEqual({ number: 10, ref: "10" });
	});
	it("reads a parenthesized loop ref", () => {
		expect(parseHoleRef("(3)")).toEqual({ number: 3, ref: "(3)" });
	});
	it("takes the first integer of a shared ref", () => {
		expect(parseHoleRef("1;10")).toEqual({ number: 1, ref: "1;10" });
	});
	it("returns number 0 when no integer is present", () => {
		expect(parseHoleRef("clubhouse")).toEqual({ number: 0, ref: "clubhouse" });
	});
	it("handles undefined", () => {
		expect(parseHoleRef(undefined)).toEqual({ number: 0, ref: "" });
	});
});

describe("normalizeCourse — Welderen (relation 901850)", () => {
	const course = normalizeCourse(welderen.elements);

	it("extracts at least 27 holes", () => {
		expect(course.holes.length).toBeGreaterThanOrEqual(27);
	});
	it("parses hole numbers from refs", () => {
		expect(course.holes.every((h) => h.number >= 1)).toBe(true);
	});
	it("produces one geometry entry per hole (keyed by ref) and assigns greens", () => {
		expect(course.geometry.length).toBe(course.holes.length);
		const totalGreens = course.geometry.reduce(
			(n, g) => n + g.greens.length,
			0,
		);
		expect(totalGreens).toBeGreaterThanOrEqual(18);
	});
	it("keeps loop holes distinct — '1' and '(1)' are separate holes", () => {
		const refs = course.holes.map((h) => h.ref);
		expect(refs).toContain("1");
		expect(refs).toContain("(1)");
	});
});

describe("normalizeCourse — De Oosterhoutse (relation 4458605)", () => {
	const course = normalizeCourse(oosterhoutse.elements);

	it("extracts at least 27 holes", () => {
		expect(course.holes.length).toBeGreaterThanOrEqual(27);
	});
	it("assigns bunkers and fairways to holes", () => {
		const bunkers = course.geometry.reduce((n, g) => n + g.bunkers.length, 0);
		expect(bunkers).toBeGreaterThanOrEqual(20);
		const fairways = course.geometry.reduce((n, g) => n + g.fairways.length, 0);
		expect(fairways).toBeGreaterThanOrEqual(1);
	});
});

describe("normalizeCourse — green matching", () => {
	// ~0.0005° ≈ 55 m north per step.
	const square = (lat: number, lon: number) =>
		[
			[lat - 0.0001, lon - 0.0001],
			[lat - 0.0001, lon + 0.0001],
			[lat + 0.0001, lon + 0.0001],
			[lat + 0.0001, lon - 0.0001],
			[lat - 0.0001, lon - 0.0001],
		].map(([la, lo]) => ({ lat: la, lon: lo }));
	const hole = (ref: string, from: number, to: number, lon: number) => ({
		type: "way",
		id: Number(ref),
		tags: { golf: "hole", ref },
		geometry: [
			{ lat: from, lon },
			{ lat: to, lon },
		],
	});
	const green = (id: number, lat: number, lon: number) => ({
		type: "way",
		id,
		tags: { golf: "green" },
		geometry: square(lat, lon),
	});

	it("puts the green at the line's end and flips a hole drawn green-to-tee", () => {
		const course = normalizeCourse([
			hole("1", 52.0, 52.003, 5.0),
			hole("2", 52.003, 52.0, 5.01), // drawn backwards
			green(10, 52.003, 5.0),
			green(11, 52.0, 5.01),
		]);
		const byRef = new Map(course.geometry.map((g) => [g.ref, g]));
		expect(byRef.get("1")?.greens).toHaveLength(1);
		expect(byRef.get("2")?.greens).toHaveLength(1);
		expect(byRef.get("2")?.holeLine[0].lat).toBe(52.003);
	});

	it("drops a practice green that no hole ends on", () => {
		const course = normalizeCourse([
			hole("1", 52.0, 52.003, 5.0),
			green(10, 52.003, 5.0),
			green(11, 52.0015, 5.003), // ~200 m beside the fairway
		]);
		expect(course.geometry[0].greens).toHaveLength(1);
	});
});

describe("normalizeCourse — lone pins", () => {
	const hole = (ref: string, from: number, to: number) => ({
		type: "way",
		id: Number(ref),
		tags: { golf: "hole", ref },
		geometry: [
			{ lat: from, lon: 5.0 },
			{ lat: to, lon: 5.0 },
		],
	});
	const pin = (id: number, lat: number) => ({
		type: "node",
		id,
		lat,
		lon: 5.0,
		tags: { golf: "pin" },
	});

	it("draws a stand-in green around a pin at the line's end and flips the line to it", () => {
		const course = normalizeCourse([
			hole("1", 52.003, 52.0), // drawn green-to-tee
			pin(10, 52.003),
		]);
		const g = course.geometry[0];
		expect(g.greens).toHaveLength(1);
		expect(g.greens[0]).toHaveLength(16);
		expect(g.holeLine[g.holeLine.length - 1].lat).toBe(52.003);
	});

	it("ignores a pin far from the line's ends", () => {
		const course = normalizeCourse([hole("1", 52.0, 52.003), pin(10, 52.0015)]);
		expect(course.geometry[0].greens).toHaveLength(0);
	});
});

describe("normalizeCourse — features", () => {
	const at = (dLat: number, dLng = 0) => ({
		lat: 52 + dLat,
		lon: 5.9 + dLng,
	});
	const box = (dLat: number, dLng: number, r = 0.0001) => [
		at(dLat - r, dLng - r),
		at(dLat - r, dLng + r),
		at(dLat + r, dLng + r),
		at(dLat + r, dLng - r),
		at(dLat - r, dLng - r),
	];
	// Two parallel holes running north, about 130 m apart.
	const holes = [
		{
			type: "way",
			id: 1,
			tags: { golf: "hole", ref: "1" },
			geometry: [at(0), at(0.003)],
		},
		{
			type: "way",
			id: 2,
			tags: { golf: "hole", ref: "2" },
			geometry: [at(0, 0.002), at(0.003, 0.002)],
		},
		{ type: "way", id: 3, tags: { golf: "green" }, geometry: box(0.003, 0) },
		{
			type: "way",
			id: 4,
			tags: { golf: "green" },
			geometry: box(0.003, 0.002),
		},
	];
	const hole = (
		extra: Parameters<typeof normalizeCourse>[0],
		ref: string,
		overrides?: Parameters<typeof normalizeCourse>[1],
	) => {
		const { geometry } = normalizeCourse([...holes, ...extra], overrides);
		const found = geometry.find((g) => g.ref === ref);
		if (!found) throw new Error(`no hole ${ref}`);
		return found;
	};

	it("reads multipolygon fairways, stitching their outer ways", () => {
		const ring = box(0.0015, 0.0001, 0.0005);
		const g = hole(
			[
				{
					type: "relation",
					id: 10,
					tags: { golf: "fairway" },
					members: [
						{ type: "way", role: "outer", geometry: ring.slice(0, 3) },
						{ type: "way", role: "outer", geometry: ring.slice(2) },
						{ type: "way", role: "inner", geometry: box(0.0015, 0.0001) },
					],
				},
			],
			"1",
		);
		expect(g.fairways).toHaveLength(1);
		expect(g.fairways[0]).toHaveLength(ring.length);
	});

	it("gives a tee to the hole starting nearest, with its colors", () => {
		const onRing = hole(
			[
				{
					type: "way",
					id: 20,
					tags: { golf: "tee", tee: "white;yellow" },
					geometry: box(-0.0002, 0.0018, 0.00003),
				},
			],
			"2",
		);
		expect(onRing.teeBoxes.map((b) => b.colors)).toEqual([["white", "yellow"]]);
		expect(onRing.tees).toHaveLength(1);
	});

	it("reads a tee mapped only as a node", () => {
		const node = hole(
			[
				{
					type: "node",
					id: 21,
					tags: { golf: "tee", tee: "red" },
					...at(0.0001),
				},
			],
			"1",
		);
		expect(node.teeBoxes).toEqual([
			{
				position: { lat: 52.0001, lng: 5.9 },
				colors: ["red"],
			},
		]);
	});

	it("doesn't count a node on a mapped tee as a second tee", () => {
		const g = hole(
			[
				{
					type: "way",
					id: 22,
					tags: { golf: "tee", tee: "red" },
					geometry: box(0, 0, 0.00003),
				},
				{ type: "node", id: 23, tags: { golf: "tee" }, ...at(0) },
			],
			"1",
		);
		expect(g.teeBoxes).toHaveLength(1);
	});

	it("puts water on every hole it is in play on", () => {
		const between = [
			{
				type: "way",
				id: 30,
				tags: { natural: "water" },
				geometry: box(0.0015, 0.001, 0.0006),
			},
		];
		expect(hole(between, "1").water).toHaveLength(1);
		expect(hole(between, "2").water).toHaveLength(1);
		const offside = [
			{
				type: "way",
				id: 31,
				tags: { natural: "water" },
				geometry: box(0.0015, -0.002, 0.0002),
			},
		];
		expect(hole(offside, "1").water).toEqual([]);
	});

	it("draws an open ditch as thin water, and skips a culvert", () => {
		const ditch = {
			type: "way",
			id: 32,
			tags: { waterway: "ditch" },
			geometry: [at(0.001, -0.0003), at(0.001, 0.0003)],
		};
		const [strip] = hole([ditch], "1").water;
		expect(strip).toHaveLength(4);
		expect(
			hole([{ ...ditch, tags: { waterway: "ditch", tunnel: "culvert" } }], "1")
				.water,
		).toEqual([]);
	});

	it("assigns a bunker by its nearest point on the line, not its vertices", () => {
		// Mid-hole, nearer hole 1's line than either hole's end points.
		const g = hole(
			[
				{
					type: "way",
					id: 40,
					tags: { golf: "bunker" },
					geometry: box(0.0015, 0.0003),
				},
			],
			"1",
		);
		expect(g.bunkers).toHaveLength(1);
	});

	it("applies overrides: line, tee boxes, green and added hazards", () => {
		const back = { lat: 51.9995, lng: 5.9 };
		const ring = [
			back,
			{ lat: 51.9996, lng: 5.9 },
			{ lat: 51.9996, lng: 5.9001 },
		];
		const g = hole([], "1", {
			"1": {
				holeLine: [back, { lat: 52, lng: 5.9 }, { lat: 52.003, lng: 5.9 }],
				teeBoxes: [{ position: back, colors: ["white"] }],
				green: ring,
				water: [ring],
				bunkers: [ring],
			},
		});
		expect(g.holeLine[0]).toEqual(back);
		expect(g.teeBoxes).toEqual([{ position: back, colors: ["white"] }]);
		expect(g.greens).toEqual([ring]);
		expect(g.water).toEqual([ring]);
		expect(g.bunkers).toEqual([ring]);
	});
});
