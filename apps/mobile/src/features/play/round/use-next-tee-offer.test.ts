import { renderHook } from "@testing-library/react-native";
import type { CourseDetail } from "../../courses/course-detail";
import { nextTeeHole } from "./play-model";
import { useHoleAnchors } from "./use-hole-anchors";
import { useNextTeeOffer } from "./use-next-tee-offer";

/** 18 holes side by side, each a tee and a green 400 m north of it. */
const refs = Array.from({ length: 18 }, (_, i) => String(i + 1));
const teeOf = (i: number) => ({ lat: 52, lng: 5.9 + i * 0.01 });
const greenOf = (i: number) => ({ lat: 52.0036, lng: 5.9 + i * 0.01 });
const detail = {
	geometry: refs.map((ref, i) => ({
		ref,
		holeLine: [teeOf(i), greenOf(i)],
		fairways: [],
		greens: [],
		bunkers: [],
		water: [],
		tees: [],
	})),
} as unknown as CourseDetail;

/** The play screen's next-tee wiring, standing on the tee of hole `standOn`. */
async function offerOn(holeIndex: number, scored: number[], standOn: number) {
	const scores = scored.map((h, i) => ({
		holeIndex: h,
		playerIndex: 0,
		strokes: 4,
		_creationTime: 1000 + i,
	}));
	const { result } = await renderHook(() => {
		const nextIndex = nextTeeHole(refs.length, scores, holeIndex);
		const { anchors, nextAnchors } = useHoleAnchors(
			refs,
			detail,
			holeIndex,
			nextIndex,
			undefined,
		);
		const { offerNext } = useNextTeeOffer({
			position: teeOf(standOn),
			accuracyMeters: 5,
			anchors,
			nextAnchors,
			holeIndex,
		});
		return { nextIndex, offerNext };
	});
	return result.current;
}

describe("next-tee offer", () => {
	const from10 = [9, 10, 11, 12, 13, 14, 15, 16];

	it("offers hole 1 on hole 18 of a round started on hole 10", async () => {
		expect(await offerOn(17, from10, 0)).toEqual({
			nextIndex: 0,
			offerNext: true,
		});
	});

	it("offers the next hole in card order on a round started on hole 1", async () => {
		expect(await offerOn(3, [0, 1, 2], 4)).toEqual({
			nextIndex: 4,
			offerNext: true,
		});
		// Hole 1's tee is no next tee from hole 18 then.
		const card = Array.from({ length: 17 }, (_, i) => i);
		expect(await offerOn(17, card, 0)).toEqual({
			nextIndex: null,
			offerNext: false,
		});
	});
});
