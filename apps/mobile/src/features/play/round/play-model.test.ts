import { GPS_WEAK_ACCURACY_M, haversineMeters } from "@fairway/core/geo";
import {
	defaultTarget,
	gpsNotice,
	hazardLabel,
	isOnHole,
	legLabel,
	lockScreenHole,
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
	it("counts the hole's back tee when a forward tee is being played", () => {
		const backTee = { lat: 51.996, lng: 5 }; // ~845 m from the green
		expect(isOnHole(backTee, { ...anchors, spanMeters: 845 })).toBe(true);
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
