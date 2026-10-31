import { vsParLabel, wouldBeFromHistory } from "./home-summary-model";

describe("home summary model", () => {
	it("needs three differentials for a would-be index", () => {
		expect(
			wouldBeFromHistory([{ differential: 20 }, { differential: null }]),
		).toBeNull();
		expect(
			wouldBeFromHistory([
				{ differential: 20 },
				{ differential: 18 },
				{ differential: 22 },
			]),
		).toEqual({ value: 16, count: 3 });
	});

	it("labels score versus par", () => {
		expect(vsParLabel(0)).toBe("E");
		expect(vsParLabel(3)).toBe("+3");
		expect(vsParLabel(-2)).toBe("−2");
	});
});
