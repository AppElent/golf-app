import { handicapText, parseCarry, parseHandicap } from "./profile-model";

describe("parseHandicap", () => {
	it.each([
		["18.4", 18.4],
		["18,4", 18.4],
		[" 7 ", 7],
		["+1.2", -1.2],
		["54", 54],
	])("reads %s", (text, value) => {
		expect(parseHandicap(text)).toEqual({ ok: true, value });
	});
	it("clears on empty input", () => {
		expect(parseHandicap("")).toEqual({ ok: true, value: null });
	});
	it.each(["55", "18.45", "abc", "+11", "1.2.3"])("rejects %s", (text) => {
		expect(parseHandicap(text).ok).toBe(false);
	});
});

describe("handicapText", () => {
	it("writes plus handicaps with a plus", () => {
		expect(handicapText(-1.2)).toBe("+1.2");
		expect(handicapText(18.4)).toBe("18.4");
		expect(handicapText(null)).toBe("");
	});
});

describe("parseCarry", () => {
	it("accepts whole metres in range", () => {
		expect(parseCarry("150")).toEqual({ ok: true, value: 150 });
	});
	it.each(["0", "401", "15.5", ""])("rejects %s", (text) => {
		expect(parseCarry(text).ok).toBe(false);
	});
});
