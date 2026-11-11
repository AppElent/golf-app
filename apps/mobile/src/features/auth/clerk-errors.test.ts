import { pickError, readError } from "./clerk-errors";

describe("readError", () => {
	it("explains a password sign-in on an account without a password", () => {
		expect(readError({ code: "strategy_for_user_invalid" })).toMatch(
			/no password/,
		);
	});

	it("falls back to a generic message for an unknown code", () => {
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
		expect(readError({ code: "something_new" })).toBe(
			"Something went wrong. Please try again.",
		);
		warn.mockRestore();
	});
});

describe("pickError", () => {
	it("reads a global error when no field is blamed", () => {
		expect(
			pickError(
				{
					fields: { password: null },
					global: [{ code: "strategy_for_user_invalid" }],
				},
				{ code: "api_response_error" },
			),
		).toMatch(/no password/);
	});
});
