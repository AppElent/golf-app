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
});

let live: typeof import("./live-hole");
beforeEach(() => {
	jest.resetModules();
	jest.clearAllMocks();
	mockInstance.update.mockResolvedValue(undefined);
	mockInstance.end.mockResolvedValue(undefined);
	Platform.OS = "ios";
	live = require("./live-hole");
});

it("starts with the distances once there is a hole and a position", () => {
	live.setLiveHole(hole("1"), true);
	expect(mockFactory.start).not.toHaveBeenCalled();
	live.liveHolePosition(anchors.tee, true);
	expect(mockFactory.start).toHaveBeenCalledWith(
		expect.objectContaining({ hole: "Hole 1", center: "334" }),
		"fairway://play",
	);
});

it("never starts from the background, but updates there", () => {
	live.setLiveHole(hole("1"), true);
	live.liveHolePosition(anchors.tee, false);
	expect(mockFactory.start).not.toHaveBeenCalled();
	live.liveHolePosition({ lat: 52.001, lng: 5 }, true);
	live.liveHolePosition({ lat: 52.002, lng: 5 }, false);
	jest.spyOn(Date, "now").mockReturnValue(Date.now() + 5000);
	live.liveHolePosition({ lat: 52.0025, lng: 5 }, false);
	expect(mockInstance.update).toHaveBeenLastCalledWith(
		expect.objectContaining({ center: "56" }),
	);
});

it("does nothing with the preference off, and ends on null", () => {
	live.setLiveHole(hole("1"), false);
	live.liveHolePosition(anchors.tee, true);
	expect(mockFactory.start).not.toHaveBeenCalled();
	live.setLiveHole(hole("1"), true);
	live.liveHolePosition(anchors.tee, true);
	live.setLiveHole(null, false);
	expect(mockInstance.end).toHaveBeenCalledWith("immediate");
});

it("takes over an activity left by an earlier launch", () => {
	mockFactory.getInstances.mockReturnValue([mockInstance]);
	live.setLiveHole(hole("2"), true);
	live.liveHolePosition(anchors.tee, true);
	expect(mockFactory.start).not.toHaveBeenCalled();
	expect(mockInstance.update).toHaveBeenCalledWith(
		expect.objectContaining({ hole: "Hole 2" }),
	);
});
