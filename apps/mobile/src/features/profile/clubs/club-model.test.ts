import { parseCarry } from "./club-model";

describe("parseCarry", () => {
	it("accepts whole metres in range", () => {
		expect(parseCarry("150")).toEqual({ ok: true, value: 150 });
	});
	it.each(["0", "401", "15.5", ""])("rejects %s", (text) => {
		expect(parseCarry(text).ok).toBe(false);
	});
});
