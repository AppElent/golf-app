import { scoreEn } from "../../../i18n/messages/score";
import {
	draftUpdate,
	flightDetail,
	flightQuickStrokes,
	initialDrafts,
	isOtherResult,
	ownerQuickStrokes,
	pickTeeShot,
	resultBadge,
	type ScoreDraft,
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

const owner = (par = 4) => ({ par, owner: true, stored: false });
const guest = { par: 4, owner: false, stored: false };

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
			draftUpdate({ ...stored, nr: false }, { ...guest, stored: true }),
		).toEqual({ nr: false });
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
