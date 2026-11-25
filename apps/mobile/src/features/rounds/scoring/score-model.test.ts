import { scoreEn } from "../../../i18n/messages/score";
import {
	draftUpdate,
	fewerPutts,
	flightDetail,
	flightQuickStrokes,
	initialDrafts,
	isOtherResult,
	ownerQuickStrokes,
	pickStrokes,
	pickTeeShot,
	resultBadge,
	type ScoreDraft,
	sheetDrafts,
	sheetUpdates,
	stepOther,
	teeShotOf,
} from "./score-model";

const draft = (over: Partial<ScoreDraft> = {}): ScoreDraft => ({
	strokes: 4,
	putts: null,
	fir: null,
	firMiss: null,
	bunker: false,
	penalties: 0,
	nr: false,
	...over,
});

const owner = (par = 4) => ({ par, owner: true, stored: undefined });
const guest = { par: 4, owner: false, stored: undefined };

describe("initialDrafts", () => {
	it("starts the owner at par and the others without a score", () => {
		const drafts = initialDrafts(
			[{ holeIndex: 1, playerIndex: 0, strokes: 9 }],
			2,
			2,
			4,
		);
		expect(drafts).toEqual([draft(), draft({ strokes: null })]);
	});

	it("shows a stored result again", () => {
		const stored = {
			strokes: 6,
			putts: 2,
			fir: false,
			firMiss: "right" as const,
			bunker: true,
			penalties: 1,
			nr: false,
		};
		expect(
			initialDrafts([{ holeIndex: 2, playerIndex: 0, ...stored }], 2, 1, 4),
		).toEqual([stored]);
	});
});

it("starts every side empty without a par, as in a scramble", () => {
	expect(initialDrafts([], 0, 2).map((d) => d.strokes)).toEqual([null, null]);
});

describe("one-tap scores", () => {
	it("offers birdie to triple and birdie to double, never below one", () => {
		expect(ownerQuickStrokes(4)).toEqual([3, 4, 5, 6, 7]);
		expect(flightQuickStrokes(4)).toEqual([3, 4, 5, 6]);
		expect(flightQuickStrokes(1)).toEqual([1, 2, 3]);
	});

	it("leaves any other result to the ⋯ button", () => {
		expect(isOtherResult(draft({ strokes: 7 }), 4)).toBe(true);
		expect(isOtherResult(draft({ strokes: 2 }), 4)).toBe(true);
		expect(isOtherResult(draft({ strokes: 6 }), 4)).toBe(false);
		expect(isOtherResult(draft({ strokes: null }), 4)).toBe(false);
		expect(isOtherResult(draft({ nr: true }), 4)).toBe(true);
	});

	it("steps from the buttons' edges when there is no score", () => {
		expect(stepOther(draft({ strokes: null }), 4, 1)).toBe(7);
		expect(stepOther(draft({ strokes: null }), 4, -1)).toBe(2);
		expect(stepOther(draft({ strokes: 8 }), 4, 1)).toBe(9);
		expect(stepOther(draft({ strokes: 1 }), 4, -1)).toBe(1);
	});

	it("brings back a picked-up player's score before stepping it", () => {
		expect(stepOther(draft({ strokes: 8, nr: true }), 4, 1)).toBe(8);
		expect(stepOther(draft({ strokes: 8, nr: true }), 4, -1)).toBe(8);
		expect(stepOther(draft({ strokes: null, nr: true }), 4, 1)).toBe(7);
	});
});

describe("tee shot", () => {
	it("sets the miss side with a missed fairway only, and clears on a second tap", () => {
		const left = { ...draft(), ...pickTeeShot(draft(), "left") };
		expect(left).toMatchObject({ fir: false, firMiss: "left" });
		expect(teeShotOf(left)).toBe("left");
		const hit = { ...left, ...pickTeeShot(left, "fairway") };
		expect(hit).toMatchObject({ fir: true, firMiss: null });
		expect(pickTeeShot(hit, "fairway")).toEqual({ fir: null, firMiss: null });
	});

	it("keeps an older miss without a side when nothing is tapped", () => {
		const old = draft({ fir: false });
		expect(teeShotOf(old)).toBeNull();
		expect(draftUpdate(old, owner())).toMatchObject({
			fir: false,
			firMiss: null,
		});
	});
});

describe("draftUpdate", () => {
	it("derives GIR when putts are known", () => {
		expect(draftUpdate(draft({ putts: 2 }), owner())).toMatchObject({
			gir: true,
		});
		expect(draftUpdate(draft({ strokes: 5, putts: 2 }), owner())).toMatchObject(
			{ gir: false },
		);
		expect(
			draftUpdate(draft({ strokes: 5, putts: 2 }), owner(5)),
		).toMatchObject({ gir: true });
	});

	it("leaves GIR alone without putts and clears it on a picked-up hole", () => {
		expect(draftUpdate(draft(), owner())).not.toHaveProperty("gir");
		expect(draftUpdate(draft({ nr: true }), owner())).toMatchObject({
			nr: true,
			gir: null,
		});
		expect(draftUpdate(draft({ putts: 2, nr: true }), owner())).toMatchObject({
			gir: null,
		});
	});

	it("saves every owner field, with null to clear", () => {
		expect(draftUpdate(draft({ putts: 2, bunker: true }), owner())).toEqual({
			strokes: 4,
			putts: 2,
			fir: null,
			firMiss: null,
			bunker: true,
			penalties: 0,
			nr: false,
			gir: true,
		});
	});

	it("saves only the score of another player, and nothing before one", () => {
		expect(draftUpdate(draft({ strokes: 5 }), guest)).toEqual({
			strokes: 5,
			nr: false,
		});
		expect(draftUpdate(draft({ strokes: null }), guest)).toBeNull();
		expect(draftUpdate(draft({ strokes: null, nr: true }), guest)).toEqual({
			nr: true,
		});
	});

	it("undoes a stored pick-up that has no strokes", () => {
		const [stored] = initialDrafts(
			[{ holeIndex: 0, playerIndex: 1, nr: true }],
			0,
			2,
			4,
		).slice(1);
		expect(
			draftUpdate(
				{ ...stored, nr: false },
				{ ...guest, stored: { holeIndex: 0, playerIndex: 1, nr: true } },
			),
		).toEqual({ nr: false });
	});
});

describe("tapping a score off (APP-894)", () => {
	it("clears a guest's selected score, and picks any other", () => {
		expect(pickStrokes(draft({ strokes: 5 }), 5)).toEqual({
			strokes: null,
			nr: false,
		});
		expect(pickStrokes(draft({ strokes: 5 }), 4)).toEqual({
			strokes: 4,
			nr: false,
		});
		// A picked-up player's old score is not the selected one.
		expect(pickStrokes(draft({ strokes: 5, nr: true }), 5)).toEqual({
			strokes: 5,
			nr: false,
		});
	});

	it("clears the stored score on save, and stores nothing before one", () => {
		const off = draft({ strokes: null });
		expect(
			draftUpdate(off, {
				...guest,
				stored: { holeIndex: 0, playerIndex: 1, strokes: 5 },
			}),
		).toEqual({ strokes: null, nr: false });
		expect(draftUpdate(off, guest)).toBeNull();
	});

	it("takes putts back to empty below zero", () => {
		expect([2, 1, 0].map(fewerPutts)).toEqual([1, 0, null]);
		expect(
			draftUpdate(draft(), {
				...owner(),
				stored: {
					holeIndex: 0,
					playerIndex: 0,
					strokes: 4,
					putts: 2,
					gir: true,
				},
			}),
		).toMatchObject({ putts: null, gir: null });
	});
});

describe("a hand-set GIR without putts (APP-894)", () => {
	const stored = { holeIndex: 0, playerIndex: 0, strokes: 4, gir: true };

	it("goes with a stroke correction", () => {
		expect(
			draftUpdate(draft({ strokes: 6 }), { ...owner(), stored }),
		).toMatchObject({ strokes: 6, gir: null });
		expect(
			draftUpdate(draft({ strokes: 6, putts: 2 }), { ...owner(), stored }),
		).toMatchObject({ gir: false });
	});

	it("stays when the strokes do", () => {
		expect(draftUpdate(draft(), { ...owner(), stored })).not.toHaveProperty(
			"gir",
		);
	});
});

describe("another device scoring while the sheet is open (APP-894)", () => {
	const opened = [
		{ holeIndex: 0, playerIndex: 0, strokes: 4 },
		{ holeIndex: 0, playerIndex: 1, strokes: 5 },
		{ holeIndex: 0, playerIndex: 2, strokes: 5 },
	];
	const now = [opened[0], { ...opened[1], nr: true }, opened[2]];
	const sheet = { holeIndex: 0, par: 4, teams: false };
	const own = initialDrafts(opened, 0, 3, 4)[0];

	it("leaves a guest picked up there alone, and shows it", () => {
		const edits = { 0: own };
		expect(sheetUpdates(edits, now, sheet).map((u) => u.playerIndex)).toEqual([
			0,
		]);
		expect(sheetDrafts(initialDrafts(now, 0, 3, 4), edits)[1].nr).toBe(true);
	});

	it("saves the guests changed here", () => {
		const edits = { 0: own, 2: draft({ strokes: 6 }) };
		expect(sheetUpdates(edits, now, sheet).slice(1)).toEqual([
			{ playerIndex: 2, strokes: 6, nr: false },
		]);
	});

	it("gives a scramble's teams no owner stats", () => {
		expect(sheetUpdates({ 0: draft() }, [], { ...sheet, teams: true })).toEqual(
			[{ playerIndex: 0, strokes: 4, nr: false }],
		);
	});
});

describe("resultBadge", () => {
	const badge = (over: Partial<ScoreDraft>, stableford = false) =>
		resultBadge({
			draft: draft(over),
			par: 4,
			received: 1,
			stableford,
			copy: scoreEn,
		});

	it("shows what counts in a game: net and points", () => {
		const badge = (strokes: number, received: number, points: number | null) =>
			resultBadge({
				draft: draft({ strokes }),
				par: 4,
				received,
				stableford: false,
				game: { points },
				copy: scoreEn,
			});
		expect(badge(5, 1, 4)).toBe("Bogey · net 4 · 4 pt");
		expect(badge(4, 0, null)).toBe("Par");
	});

	it("names the result with its difference", () => {
		expect(badge({ strokes: 1 })).toBe("Albatross · −3");
		expect(badge({ strokes: 3 })).toBe("Birdie · −1");
		expect(badge({ strokes: 4 })).toBe("Par");
		expect(badge({ strokes: 5 })).toBe("Bogey · +1");
		expect(badge({ strokes: 8 })).toBe("+4");
		expect(badge({ nr: true })).toBe("Picked up");
	});

	it("shows points in Stableford", () => {
		expect(badge({ strokes: 6 }, true)).toBe("Double bogey · 1 pt");
		expect(badge({ strokes: 4 }, true)).toBe("Par · 3 pt");
		expect(badge({ nr: true }, true)).toBe("Picked up · 0 pt");
	});
});

describe("flightDetail", () => {
	const detail = (
		over: Partial<ScoreDraft>,
		received = 1,
		stableford = false,
	) =>
		flightDetail({
			draft: draft(over),
			par: 4,
			received,
			stableford,
			copy: scoreEn,
			strokesLabel: "+1 stroke",
		});

	it("shows the strokes received, then net or points", () => {
		expect(detail({ strokes: null })).toBe("+1 stroke");
		expect(detail({ strokes: 5 })).toBe("+1 stroke · net 4");
		expect(detail({ strokes: 5 }, 1, true)).toBe("+1 stroke · 2 pt");
		expect(detail({ nr: true })).toBe("+1 stroke · Picked up");
	});

	it("leaves out net without strokes received", () => {
		expect(detail({ strokes: 5 }, 0)).toBe("");
		expect(detail({ strokes: 5 }, 0, true)).toBe("1 pt");
	});
});
