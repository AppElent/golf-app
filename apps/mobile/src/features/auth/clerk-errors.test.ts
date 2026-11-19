import { pickError, readError } from "./clerk-errors";

describe("readError", () => {
	it("explains a password sign-in on an account without a password", () => {
		expect(readError({ code: "strategy_for_user_invalid" })).toMatch(
			/no password/,
		);
	});

	it("reads the code Clerk's API-response wrapper holds", () => {
		expect(
			readError({
				code: "api_response_error",
				errors: [{ code: "strategy_for_user_invalid" }],
			}),
		).toMatch(/no password/);
	});

	it("keeps the wrapper's own code when it holds no errors", () => {
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
		expect(readError({ code: "api_response_error", errors: [] })).toBe(
			"Something went wrong. Please try again.",
		);
		warn.mockRestore();
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

	it("reads a global wrapper with a no-password account inside", () => {
		expect(
			pickError(
				{
					fields: { password: null },
					global: [
						{
							code: "api_response_error",
							errors: [{ code: "strategy_for_user_invalid" }],
						},
					],
				},
				{ code: "api_response_error" },
			),
		).toMatch(/no password/);
	});
});
