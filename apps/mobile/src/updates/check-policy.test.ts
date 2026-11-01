import { CHECK_INTERVAL_MS, shouldCheckOnResume } from "./check-policy";

describe("shouldCheckOnResume", () => {
	it("checks when it never has", () => {
		expect(shouldCheckOnResume(null, 1_000)).toBe(true);
	});

	it("waits out the interval", () => {
		expect(shouldCheckOnResume(0, CHECK_INTERVAL_MS - 1)).toBe(false);
		expect(shouldCheckOnResume(0, CHECK_INTERVAL_MS)).toBe(true);
	});
});
