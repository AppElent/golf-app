import {
	type HandicapTableSetup,
	parseSetupParam,
	setupParam,
} from "./handicap-table-params";

const setup = {
	courseId: "c1",
	teeId: "t1",
	holeRefs: ["1", "(2)"],
	players: [{ name: "Eric", playingHandicap: -1 }, { name: "Piet & Jan" }],
} as HandicapTableSetup;

describe("the setup parameter", () => {
	it("round-trips", () => {
		expect(parseSetupParam(setupParam(setup))).toEqual(setup);
		const unset = {
			...setup,
			players: [{ name: "Eric", playingHandicap: undefined }],
		};
		expect(parseSetupParam(setupParam(unset))?.players).toEqual([
			{ name: "Eric" },
		]);
	});

	it.each([
		undefined,
		"",
		"{",
		"null",
		"[]",
		JSON.stringify({ ...setup, teeId: 1 }),
		JSON.stringify({ ...setup, holeRefs: [1] }),
		JSON.stringify({ ...setup, players: [null] }),
		JSON.stringify({
			...setup,
			players: [{ name: "x", playingHandicap: "9" }],
		}),
	])("is null for %s", (raw) => {
		expect(parseSetupParam(raw)).toBeNull();
	});
});
