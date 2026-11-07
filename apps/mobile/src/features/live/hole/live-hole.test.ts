import type { HoleAnchors } from "@fairway/core/hole-view";
import { Platform } from "react-native";

const mockInstance = { update: jest.fn(), end: jest.fn() };
const mockFactory = {
	start: jest.fn(() => mockInstance),
	getInstances: jest.fn((): unknown[] => []),
};
jest.mock("./hole-activity", () => ({
	__esModule: true,
	default: mockFactory,
}));

// ~111 m per 0.001° latitude: the green 0.003° north of the tee.
const anchors = {
	tee: { lat: 52, lng: 5 },
	green: { lat: 52.003, lng: 5 },
} as HoleAnchors;
const hole = (n: string) => ({
	anchors,
	props: {
		hole: `Hole ${n}`,
		holeShort: n,
		detail: "Par 4",
		unit: "m",
		frontLabel: "F",
		centerLabel: "C",
		backLabel: "B",
	},
	format: (m: number) => String(Math.round(m)),
	url: "fairway://play",
	accepts: (p: { lat: number }) => p.lat < 52.01,
});

let live: typeof import("./live-hole");
beforeEach(() => {
	jest.resetModules();
	jest.clearAllMocks();
	mockInstance.update.mockResolvedValue(undefined);
	mockInstance.end.mockResolvedValue(undefined);
	mockFactory.getInstances.mockReturnValue([]);
	// The throttle's timer and clock: faked so nothing outlives a test.
	jest.useFakeTimers();
	Platform.OS = "ios";
	live = require("./live-hole");
});
afterEach(() => jest.useRealTimers());

it("starts with the distances once there is a hole and a position", () => {
	live.setLiveHole(hole("1"));
	expect(mockFactory.start).not.toHaveBeenCalled();
	live.liveHolePosition(anchors.tee, "foreground");
	expect(mockFactory.start).toHaveBeenCalledWith(
		expect.objectContaining({ hole: "Hole 1", center: "334" }),
		"fairway://play",
	);
});

it("never starts from the background, but updates there", () => {
	live.setLiveHole(hole("1"));
	live.liveHolePosition(anchors.tee, "background");
	expect(mockFactory.start).not.toHaveBeenCalled();
	live.liveHolePosition({ lat: 52.001, lng: 5 }, "foreground");
	expect(mockFactory.start).toHaveBeenCalledTimes(1);
	jest.advanceTimersByTime(5000);
	live.liveHolePosition({ lat: 52.0025, lng: 5 }, "background");
	expect(mockInstance.update).toHaveBeenLastCalledWith(
		expect.objectContaining({ center: "56" }),
	);
});

it("does nothing without a hole, and ends the activity on null", () => {
	live.setLiveHole(null);
	live.liveHolePosition(anchors.tee, "foreground");
	expect(mockFactory.start).not.toHaveBeenCalled();
	live.setLiveHole(hole("1"));
	live.liveHolePosition(anchors.tee, "foreground");
	live.setLiveHole(null);
	expect(mockInstance.end).toHaveBeenCalledWith("immediate");
});

it("takes over an activity left by an earlier launch, ending any others", () => {
	const extra = { update: jest.fn(), end: jest.fn(async () => {}) };
	mockFactory.getInstances.mockReturnValue([mockInstance, extra]);
	live.setLiveHole(hole("2"));
	live.liveHolePosition(anchors.tee, "foreground");
	expect(mockFactory.start).not.toHaveBeenCalled();
	expect(mockInstance.update).toHaveBeenCalledWith(
		expect.objectContaining({ hole: "Hole 2" }),
	);
	expect(mockInstance.end).not.toHaveBeenCalled();
	expect(extra.end).toHaveBeenCalledWith("immediate");
});

it("lands a throttled fix once the interval is over", () => {
	live.setLiveHole(hole("1"));
	live.liveHolePosition(anchors.tee, "foreground");
	live.liveHolePosition({ lat: 52.0025, lng: 5 }, "foreground");
	expect(mockInstance.update).not.toHaveBeenCalled();
	jest.advanceTimersByTime(2000);
	expect(mockInstance.update).toHaveBeenLastCalledWith(
		expect.objectContaining({ center: "56" }),
	);
});

it("ignores fixes away from the hole", () => {
	live.setLiveHole(hole("1"));
	live.liveHolePosition({ lat: 52.5, lng: 5 }, "foreground");
	expect(mockFactory.start).not.toHaveBeenCalled();
});

it("shows a new hole at once, only with a fix it accepts", () => {
	live.setLiveHole(hole("1"));
	live.liveHolePosition(anchors.tee, "foreground");
	jest.clearAllMocks();
	live.setLiveHole({ ...hole("2"), accepts: () => false });
	expect(mockInstance.update).not.toHaveBeenCalled();
	live.setLiveHole(hole("3"));
	expect(mockInstance.update).toHaveBeenCalledWith(
		expect.objectContaining({ hole: "Hole 3" }),
	);
});

it("does nothing on Android", () => {
	Platform.OS = "android";
	live.setLiveHole(hole("1"));
	live.liveHolePosition(anchors.tee, "foreground");
	expect(mockFactory.start).not.toHaveBeenCalled();
});

it("forgets the last fix when the activity ends", () => {
	live.setLiveHole(hole("1"));
	live.liveHolePosition(anchors.tee, "foreground");
	live.setLiveHole(null);
	jest.clearAllMocks();
	live.setLiveHole(hole("1"));
	expect(mockFactory.start).not.toHaveBeenCalled();
});
