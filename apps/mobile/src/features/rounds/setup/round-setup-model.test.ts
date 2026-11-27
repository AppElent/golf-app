import {
	defaultTeeId,
	doubledLoop,
	loopOrder,
	nextPartner,
	playerInitial,
	playingHandicapText,
	scrambleTeams,
	startHoleChoices,
	teeLengthMeters,
	toggleLoopPick,
	unfitFormats,
} from "./round-setup-model";

describe("toggleLoopPick", () => {
	it("plays a tapped loop once, then twice, then not at all", () => {
		expect(toggleLoopPick([], 0)).toEqual([0]);
		expect(toggleLoopPick([0], 0)).toEqual([0, 0]);
		expect(toggleLoopPick([0, 0], 0)).toEqual([]);
	});

	it("joins a second loop and keeps the order of tapping", () => {
		expect(toggleLoopPick([0], 1)).toEqual([0, 1]);
		expect(toggleLoopPick([1], 0)).toEqual([1, 0]);
	});

	it("gives both slots to a picked loop that is tapped again", () => {
		expect(toggleLoopPick([0, 1], 0)).toEqual([0, 0]);
		expect(toggleLoopPick([0, 1], 1)).toEqual([1, 1]);
	});

	it("starts over when a new loop does not fit", () => {
		expect(toggleLoopPick([0, 1], 2)).toEqual([2]);
		expect(toggleLoopPick([0, 0], 1)).toEqual([1]);
	});
});

describe("loopOrder", () => {
	it("numbers two different loops in the order they are played", () => {
		expect(loopOrder([1, 0], 1)).toBe(1);
		expect(loopOrder([1, 0], 0)).toBe(2);
		expect(loopOrder([1, 0], 2)).toBeNull();
	});

	it("has no order for one loop, or one loop played twice", () => {
		expect(loopOrder([0], 0)).toBeNull();
		expect(loopOrder([0, 0], 0)).toBeNull();
	});
});

describe("doubledLoop", () => {
	it("names the loop played twice", () => {
		expect(doubledLoop([1, 1])).toBe(1);
	});

	it("is null otherwise", () => {
		expect(doubledLoop([])).toBeNull();
		expect(doubledLoop([0])).toBeNull();
		expect(doubledLoop([0, 1])).toBeNull();
	});
});

describe("playerInitial", () => {
	it("is the first letter in upper case", () => {
		expect(playerInitial(" piet")).toBe("P");
		expect(playerInitial("émile")).toBe("É");
		expect(playerInitial("🏌 Jan")).toBe("🏌");
		expect(playerInitial(" ")).toBe("");
	});
});

describe("playingHandicapText", () => {
	it("writes a plus handicap with a plus", () => {
		expect(playingHandicapText(14)).toBe("14");
		expect(playingHandicapText(0)).toBe("0");
		expect(playingHandicapText(-2)).toBe("+2");
	});
});

describe("defaultTeeId", () => {
	const tees = [{ _id: "white" }, { _id: "yellow" }, { _id: "red" }];

	it("prefers the tee last played on the course", () => {
		expect(defaultTeeId(tees, "yellow")).toBe("yellow");
	});

	it("falls back to the first tee without a usable last tee", () => {
		expect(defaultTeeId(tees, null)).toBe("white");
		expect(defaultTeeId(tees, undefined)).toBe("white");
		expect(defaultTeeId(tees, "retired")).toBe("white");
	});

	it("has no default on a course without tees", () => {
		expect(defaultTeeId([], "yellow")).toBeNull();
	});
});

describe("teeLengthMeters", () => {
	const holes = [
		{ ref: "1", lengthMeters: 300, lengths: { white: 320, red: 280 } },
		{ ref: "2", lengthMeters: 150 },
		{ ref: "3" },
	];

	it("sums each hole's length for the tee's marker, else its own length", () => {
		expect(teeLengthMeters({ marker: "white" }, holes, ["1", "2"])).toBe(470);
		expect(teeLengthMeters({ marker: "red" }, holes, ["1", "2"])).toBe(430);
		expect(teeLengthMeters({}, holes, ["1", "2"])).toBe(450);
	});

	it("counts a loop played twice twice", () => {
		expect(teeLengthMeters({ marker: "white" }, holes, ["1", "1"])).toBe(640);
	});

	it("is unknown when a hole has no length or nothing is selected", () => {
		expect(teeLengthMeters({ marker: "white" }, holes, ["1", "3"])).toBeNull();
		expect(teeLengthMeters({ marker: "white" }, holes, ["9"])).toBeNull();
		expect(teeLengthMeters({ marker: "white" }, holes, [])).toBeNull();
	});
});

describe("unfitFormats", () => {
	it("groups the formats a player count can't start by what they need", () => {
		expect(unfitFormats(1)).toEqual([
			{ formats: ["match"], min: 2, max: 2 },
			{ formats: ["skins", "scramble"], min: 2, max: 4 },
			{ formats: ["sixes"], min: 3, max: 3 },
		]);
		expect(unfitFormats(2).map((x) => x.formats)).toEqual([["sixes"]]);
		expect(unfitFormats(3).map((x) => x.formats)).toEqual([["match"]]);
		expect(unfitFormats(4).map((x) => x.formats)).toEqual([
			["match"],
			["sixes"],
		]);
	});
});

describe("scramble teams", () => {
	const members = (teams: { playerIndexes: number[] }[]) =>
		teams.map((x) => x.playerIndexes);

	it("splits only four players, the owner in team one", () => {
		expect(members(scrambleTeams(4, 2, 2))).toEqual([
			[0, 2],
			[1, 3],
		]);
		expect(members(scrambleTeams(3, 2, 1))).toEqual([[0, 1, 2]]);
		expect(members(scrambleTeams(4, 1, 1))).toEqual([[0, 1, 2, 3]]);
	});

	it("keeps the teams at two whoever moves", () => {
		const teams = scrambleTeams(4, 2, 1);
		expect(nextPartner(teams, 1, 3)).toBe(3);
		expect(nextPartner(teams, 1, 1)).toBe(2);
		expect(nextPartner(teams, 1, 0)).toBe(1);
	});
});

describe("startHoleChoices", () => {
	it("offers every hole once, a loop played twice on its first pass", () => {
		expect(startHoleChoices(["10", "11", "1", "2"])).toEqual([
			{ index: 0, ref: "10" },
			{ index: 1, ref: "11" },
			{ index: 2, ref: "1" },
			{ index: 3, ref: "2" },
		]);
		expect(startHoleChoices(["1", "2", "1", "2"])).toEqual([
			{ index: 0, ref: "1" },
			{ index: 1, ref: "2" },
		]);
		expect(startHoleChoices([])).toEqual([]);
	});
});
