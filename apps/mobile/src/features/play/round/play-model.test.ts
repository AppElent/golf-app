import { effectiveBag } from "@fairway/core/club-suggest";
import { GPS_WEAK_ACCURACY_M, haversineMeters } from "@fairway/core/geo";
import {
	defaultTarget,
	gpsNotice,
	hazardLabel,
	isOnHole,
	legLabel,
	lockScreenHole,
	nextTeeAction,
	nextTeeHole,
	playerPosition,
} from "./play-model";

const tee = { lat: 52, lng: 5.9 };
const green = { lat: 52.004, lng: 5.9 }; // ~445 m
const bag = [
	{ name: "Driver", carryMeters: 230 },
	{ name: "7i", carryMeters: 150 },
];

describe("play model", () => {
	it("lays up at the longest club on a long hole, else targets the green", () => {
		const t = defaultTarget(tee, green, bag);
		expect(haversineMeters(tee, t)).toBeCloseTo(230, 0);
		const near = { lat: 52.0025, lng: 5.9 };
		expect(defaultTarget(near, green, bag)).toEqual(green);
		expect(defaultTarget(tee, green, [])).toEqual(green);
	});

	it("formats numbers in units and adds the club for the first leg", () => {
		expect(legLabel(148, "m", bag, true)).toBe("148 · 7i");
		expect(legLabel(148, "m", bag, false)).toBe("148");
		expect(legLabel(148, "yd", bag, true)).toBe("162 · 7i");
	});

	it("labels a hazard by kind, with reach and carry in units", () => {
		const hazard = { reach: 100, carry: 150, at: tee, side: "left" as const };
		expect(hazardLabel({ ...hazard, kind: "water" }, "m")).toBe("W 100/150");
		expect(hazardLabel({ ...hazard, kind: "bunker" }, "yd")).toBe("B 109/164");
	});
});

describe("isOnHole", () => {
	const anchors = { green: { lat: 52.0036, lng: 5 }, spanMeters: 400 };
	it("counts a fix on or beside the hole", () => {
		expect(isOnHole({ lat: 52.001, lng: 5.001 }, anchors)).toBe(true);
		expect(isOnHole({ lat: 51.9995, lng: 5 }, anchors)).toBe(true);
	});
	it("ignores a fix two holes away", () => {
		expect(isOnHole({ lat: 51.996, lng: 5 }, anchors)).toBe(false);
	});
});

describe("playerPosition", () => {
	const anchors = {
		tee: { lat: 52, lng: 5 },
		green: { lat: 52.0036, lng: 5 },
		spanMeters: 400,
	};
	it("measures from a fix on the hole", () => {
		const onHole = { lat: 52.001, lng: 5 };
		expect(playerPosition(onHole, anchors)).toEqual({
			fix: onHole,
			player: onHole,
		});
	});
	it("falls back to the tee for no fix or one off the hole", () => {
		const tee = { fix: null, player: anchors.tee };
		expect(playerPosition(null, anchors)).toEqual(tee);
		expect(playerPosition({ lat: 51.9, lng: 5 }, anchors)).toEqual(tee);
	});
	it("stands a chosen spot where it was chosen, on the hole or not", () => {
		const offHole = { lat: 51.9, lng: 5 };
		expect(playerPosition(offHole, anchors, true)).toEqual({
			fix: offHole,
			player: offHole,
		});
	});
	it("has nothing to measure from without anchors", () => {
		expect(playerPosition({ lat: 52, lng: 5 }, null)).toEqual({
			fix: null,
			player: null,
		});
	});
});

describe("gpsNotice", () => {
	const onHole = { hasAnchors: true, located: true, hasFix: true };
	const weak = GPS_WEAK_ACCURACY_M + 1;

	it("says so when the fix is away from this hole", () => {
		expect(
			gpsNotice({ ...onHole, located: false, accuracyMeters: weak }),
		).toEqual({ kind: "offHole" });
	});
	it("says so when there is no fix", () => {
		expect(
			gpsNotice({
				...onHole,
				located: false,
				hasFix: false,
				accuracyMeters: null,
			}),
		).toEqual({ kind: "noGps" });
	});
	it("warns about a weak fix in whole metres", () => {
		expect(
			gpsNotice({ ...onHole, accuracyMeters: GPS_WEAK_ACCURACY_M + 5.4 }),
		).toEqual({ kind: "weak", meters: GPS_WEAK_ACCURACY_M + 5 });
	});
	it("is weak only beyond the threshold", () => {
		expect(
			gpsNotice({ ...onHole, accuracyMeters: GPS_WEAK_ACCURACY_M }),
		).toBeNull();
		expect(
			gpsNotice({ ...onHole, accuracyMeters: GPS_WEAK_ACCURACY_M + 0.1 })?.kind,
		).toBe("weak");
	});
	it("says nothing about a good fix or an unknown accuracy", () => {
		expect(gpsNotice({ ...onHole, accuracyMeters: 5 })).toBeNull();
		expect(gpsNotice({ ...onHole, accuracyMeters: null })).toBeNull();
	});
	it("with no hole to place the player on, only accuracy matters", () => {
		const noHole = { hasAnchors: false, located: false, hasFix: false };
		expect(gpsNotice({ ...noHole, accuracyMeters: null })).toBeNull();
		expect(gpsNotice({ ...noHole, accuracyMeters: weak })?.kind).toBe("weak");
	});
});

describe("lockScreenHole", () => {
	const anchors = {
		tee: { lat: 52, lng: 5 },
		green: { lat: 52.0036, lng: 5 },
		greenRing: null,
		spanMeters: 445,
	};
	const input = {
		preferred: true,
		anchors,
		title: "Hole 6",
		holeRef: "(6)",
		detail: "Par 4 · Welderen",
		units: "yd" as const,
		labels: { front: "F", center: "C", back: "B" },
		url: "fairway://play",
	};

	it("is nothing with GPS while locked off", () => {
		expect(lockScreenHole({ ...input, preferred: false })).toBeNull();
	});
	it("describes the hole in the player's units", () => {
		const hole = lockScreenHole(input);
		expect(hole?.props).toEqual({
			hole: "Hole 6",
			holeShort: "6",
			detail: "Par 4 · Welderen",
			unit: "yd",
			frontLabel: "F",
			centerLabel: "C",
			backLabel: "B",
		});
		expect(hole?.format(150)).toBe("164");
		expect(hole?.url).toBe("fairway://play");
	});
	it("accepts only fixes on the hole", () => {
		const hole = lockScreenHole(input);
		expect(hole?.accepts({ lat: 52.001, lng: 5 })).toBe(true);
		expect(hole?.accepts({ lat: 51.9, lng: 5 })).toBe(false);
	});
});

describe("nextTeeAction", () => {
	it("asks to score the hole being left when the owner has no result", () => {
		expect(nextTeeAction([], 1)).toBe("score");
		// Another player's score or another hole's doesn't count.
		expect(
			nextTeeAction(
				[
					{ holeIndex: 1, playerIndex: 1, strokes: 5 },
					{ holeIndex: 0, playerIndex: 0, strokes: 4 },
				],
				1,
			),
		).toBe("score");
	});

	it("still asks for a score that was cleared", () => {
		expect(
			nextTeeAction([{ holeIndex: 1, playerIndex: 0, nr: false }], 1),
		).toBe("score");
	});

	it("moves on once the owner scored the hole, picked up included", () => {
		expect(
			nextTeeAction([{ holeIndex: 1, playerIndex: 0, strokes: 4 }], 1),
		).toBe("advance");
		expect(nextTeeAction([{ holeIndex: 1, playerIndex: 0, nr: true }], 1)).toBe(
			"advance",
		);
	});
});

describe("a sparse bag", () => {
	it("still suggests a driver from the tee of a 361 m par 4", () => {
		const sparse = effectiveBag([{ name: "7 iron", carryMeters: 145 }]);
		const far = { lat: 52 + 361 / 111_195, lng: 5.9 };
		const target = defaultTarget(tee, far, sparse);
		const meters = Math.round(haversineMeters(tee, target));
		expect(meters).toBe(230);
		expect(legLabel(meters, "m", sparse, true)).toBe("230 · Driver");
		expect(legLabel(145, "m", sparse, true)).toBe("145 · 7 iron");
	});
});

describe("nextTeeHole", () => {
	/** The owner's results on these holes, entered in this order. */
	const entered = (holes: number[]) =>
		holes.map((holeIndex, i) => ({
			holeIndex,
			playerIndex: 0,
			strokes: 4,
			_creationTime: 1000 + i,
		}));
	const from10 = [9, 10, 11, 12, 13, 14, 15, 16];

	it("offers hole 1 from hole 18 on a round started on hole 10", () => {
		// Hole 18 not scored yet: the golfer walks on before entering it.
		expect(nextTeeHole(18, entered(from10), 17)).toBe(0);
		expect(nextTeeHole(18, entered([...from10, 17]), 17)).toBe(0);
		// And no next tee after hole 9, the last hole played.
		const all = [...from10, 17, 0, 1, 2, 3, 4, 5, 6, 7];
		expect(nextTeeHole(18, entered(all), 8)).toBeNull();
	});

	it("goes on in card order, and offers nothing from the last hole", () => {
		expect(nextTeeHole(18, [], 0)).toBe(1);
		expect(nextTeeHole(18, entered([0, 1, 2]), 3)).toBe(4);
		const card = Array.from({ length: 17 }, (_, i) => i);
		expect(nextTeeHole(18, entered(card), 17)).toBeNull();
		// A round started on hole 10 still goes 10 → 11 before anything wraps.
		expect(nextTeeHole(18, [], 9)).toBe(10);
	});

	it("follows a stored start hole, whatever was entered first (APP-913)", () => {
		// Hole 1 scored first by mistake on a round started on hole 3.
		expect(nextTeeHole(18, entered([0, 2, 3]), 17, 2)).toBe(0);
		expect(nextTeeHole(18, entered([0, 2, 3]), 1, 2)).toBeNull();
		expect(nextTeeHole(18, [], 2, 2)).toBe(3);
	});
});
