import {
	draftUpdate,
	editDraft,
	inferredGir,
	initialDrafts,
	quickStrokes,
	type ScoreDraft,
} from "./score-model";

describe("initialDrafts", () => {
	it("starts unscored players at par and keeps stored results", () => {
		const stored = {
			strokes: 6,
			putts: 2,
			fir: true,
			gir: false,
			penalties: 1,
			nr: true,
		};
		const drafts = initialDrafts(
			[
				{ holeIndex: 1, playerIndex: 0, strokes: 9 },
				{ holeIndex: 2, playerIndex: 1, ...stored },
			],
			2,
			2,
			4,
		);
		expect(drafts).toEqual([
			{
				strokes: 4,
				putts: null,
				fir: null,
				gir: null,
				penalties: 0,
				nr: false,
				girTouched: false,
			},
			{ ...stored, girTouched: true },
		]);
	});
});

describe("quickStrokes", () => {
	it("offers birdie to double, never below one", () => {
		expect(quickStrokes(4)).toEqual([3, 4, 5, 6]);
		expect(quickStrokes(1)).toEqual([1, 2, 3]);
	});
});

describe("GIR from strokes and putts", () => {
	const fresh = (par: number) => initialDrafts([], 0, 1, par)[0];

	it.each([
		// par, strokes, putts, gir
		[3, 3, 2, true],
		[3, 4, 2, false],
		[3, 2, 1, true],
		[4, 4, 2, true],
		[4, 5, 3, true],
		[4, 5, 2, false],
		[5, 5, 2, true],
		[5, 6, 2, false],
		[5, 4, 1, true],
	])("par %i, %i strokes, %i putts: GIR %s", (par, strokes, putts, gir) => {
		expect(inferredGir({ strokes, putts, nr: false }, par)).toBe(gir);
		const draft = editDraft(
			editDraft(fresh(par), { strokes }, par),
			{ putts },
			par,
		);
		expect(draft.gir).toBe(gir);
	});

	it("stays unset without putts or on a picked-up hole", () => {
		expect(editDraft(fresh(4), { strokes: 5 }, 4).gir).toBeNull();
		const putted = editDraft(fresh(4), { putts: 2 }, 4);
		expect(putted.gir).toBe(true);
		const pickedUp = editDraft(putted, { nr: true }, 4);
		expect(pickedUp.gir).toBeNull();
		expect(editDraft(pickedUp, { nr: false }, 4).gir).toBe(true);
	});

	it("keeps a manual GIR through later edits", () => {
		const putted = editDraft(fresh(4), { putts: 2 }, 4);
		const manual = editDraft(putted, { gir: false }, 4);
		expect(manual).toMatchObject({ gir: false, girTouched: true });
		expect(editDraft(manual, { strokes: 3 }, 4).gir).toBe(false);
		// Cleared by hand stays cleared too.
		const cleared = editDraft(manual, { gir: null }, 4);
		expect(editDraft(cleared, { putts: 1 }, 4).gir).toBeNull();
	});

	it("keeps a stored GIR the rule disagrees with on a correction", () => {
		const [stored] = initialDrafts(
			[{ holeIndex: 0, playerIndex: 0, strokes: 5, putts: 2, gir: true }],
			0,
			1,
			4,
		);
		expect(stored.girTouched).toBe(true);
		expect(editDraft(stored, { strokes: 7 }, 4).gir).toBe(true);
	});

	it("keeps deriving a stored GIR that matches the rule", () => {
		const [stored] = initialDrafts(
			[{ holeIndex: 0, playerIndex: 0, strokes: 4, putts: 2, gir: true }],
			0,
			1,
			4,
		);
		expect(stored.girTouched).toBe(false);
		expect(editDraft(stored, { strokes: 5 }, 4).gir).toBe(false);
	});

	it("leaves GIR unknown when every stroke was a putt", () => {
		expect(inferredGir({ strokes: 2, putts: 2, nr: false }, 4)).toBeNull();
	});

	it("saves the draft without the touched flag", () => {
		const draft: ScoreDraft = { ...fresh(4), girTouched: true, gir: true };
		expect(draftUpdate(draft)).toEqual({
			strokes: 4,
			putts: null,
			fir: null,
			gir: true,
			penalties: 0,
			nr: false,
		});
	});
});
