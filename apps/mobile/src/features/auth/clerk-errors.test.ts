import { en } from "../../i18n/messages/en";
import { nl } from "../../i18n/messages/nl";
import {
	clerkErrorEntries,
	isReverifyCancelled,
	isReverifyHint,
	pickError,
	readError,
	thrownErrorKey,
} from "./clerk-errors";

const messages = en.authErrors;

describe("readError", () => {
	it("explains a password sign-in on an account without a password", () => {
		expect(readError({ code: "strategy_for_user_invalid" }, messages)).toMatch(
			/no password/,
		);
	});

	it("reads the code Clerk's API-response wrapper holds", () => {
		expect(
			readError(
				{
					code: "api_response_error",
					errors: [{ code: "strategy_for_user_invalid" }],
				},
				messages,
			),
		).toMatch(/no password/);
	});

	it("keeps the wrapper's own code when it holds no errors", () => {
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
		expect(
			readError({ code: "api_response_error", errors: [] }, messages),
		).toBe("Something went wrong. Please try again.");
		warn.mockRestore();
	});

	it("tells too many wrong codes apart from one wrong code", () => {
		// Clerk: three wrong codes give `form_code_incorrect`, the fourth
		// `verification_failed` ("Too many failed attempts") (APP-507).
		expect(readError({ code: "form_code_incorrect" }, messages)).toBe(
			"That code is not right.",
		);
		expect(readError({ code: "verification_failed" }, messages)).toBe(
			"Too many wrong codes. Send a new one.",
		);
		expect(readError({ code: "verification_failed" }, nl.authErrors)).toBe(
			"Te veel foute codes. Vraag een nieuwe aan.",
		);
	});

	it("falls back to a generic message for an unknown code", () => {
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
		expect(readError({ code: "something_new" }, messages)).toBe(
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
				messages,
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
				messages,
			),
		).toMatch(/no password/);
	});
});

describe("localized messages", () => {
	it("reads the same code in Dutch", () => {
		expect(readError({ code: "form_password_incorrect" }, nl.authErrors)).toBe(
			"Dat wachtwoord klopt niet.",
		);
	});

	it("asks to sign in again when Clerk wants a reverification", () => {
		expect(
			readError({ code: "session_reverification_required" }, messages),
		).toMatch(/sign in again/);
	});
});

describe("thrown user-method errors", () => {
	const thrown = {
		errors: [
			{
				code: "form_password_validation_failed",
				meta: { paramName: "current_password" },
			},
			{ code: "form_password_pwned", meta: { paramName: "new_password" } },
			{ code: "too_many_requests" },
		],
	};

	it("keeps each entry's field", () => {
		expect(clerkErrorEntries(thrown)).toEqual([
			{ code: "form_password_validation_failed", param: "current_password" },
			{ code: "form_password_pwned", param: "new_password" },
			{ code: "too_many_requests", param: null },
		]);
	});

	it("reads anything that is not a Clerk API error as a network failure", () => {
		expect(clerkErrorEntries(new TypeError("Network request failed"))).toEqual(
			[],
		);
		expect(thrownErrorKey(new TypeError("Network request failed"))).toBe(
			"network",
		);
		expect(thrownErrorKey(thrown)).toBe("passwordWeak");
	});
});

describe("reverification", () => {
	it("tells a cancelled prompt from a failure", () => {
		expect(isReverifyCancelled({ code: "reverification_cancelled" })).toBe(
			true,
		);
		expect(isReverifyCancelled({ code: "form_password_incorrect" })).toBe(
			false,
		);
		expect(isReverifyCancelled(null)).toBe(false);
	});

	it("spots the hint useReverification resolves with", () => {
		expect(isReverifyHint({ clerk_error: { type: "forbidden" } })).toBe(true);
		expect(isReverifyHint({ id: "user_1" })).toBe(false);
		expect(isReverifyHint(undefined)).toBe(false);
	});

	it("maps Clerk's reverification error to its message", () => {
		expect(
			thrownErrorKey({ errors: [{ code: "session_reverification_required" }] }),
		).toBe("reverify");
	});
});
