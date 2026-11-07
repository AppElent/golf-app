import { shouldCheckOnResume } from "./check-policy";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

describe("shouldCheckOnResume", () => {
	it("skips a quick return to the app", () => {
		expect(shouldCheckOnResume(0, MINUTE_MS)).toBe(false);
	});
	it("checks after a day in the background", () => {
		expect(shouldCheckOnResume(0, DAY_MS)).toBe(true);
	});
});
