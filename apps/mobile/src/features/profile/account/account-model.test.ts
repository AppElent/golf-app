import {
	displayName,
	emailRows,
	nameUpdate,
	passwordErrors,
	passwordMode,
	passwordReady,
} from "./account-model";

describe("displayName", () => {
	it("joins the parts that are set", () => {
		expect(displayName("Eric", "Jansen")).toBe("Eric Jansen");
		expect(displayName("Eric", null)).toBe("Eric");
		expect(displayName(" ", "Jansen")).toBe("Jansen");
		expect(displayName(null, undefined)).toBeNull();
	});

	it("trims, and an emptied field clears that part", () => {
		expect(nameUpdate(" Eric ", "")).toEqual({
			firstName: "Eric",
			lastName: "",
		});
	});
});

describe("password mode", () => {
	it("sets a password for an account without one, without the current one", () => {
		expect(passwordMode(false)).toBe("set");
		expect(passwordReady("set", { current: "", next: "new-pass" })).toBe(true);
	});

	it("needs the current password to change one", () => {
		expect(passwordMode(true)).toBe("change");
		expect(passwordReady("change", { current: "", next: "new-pass" })).toBe(
			false,
		);
		expect(passwordReady("change", { current: "old", next: "new-pass" })).toBe(
			true,
		);
	});
});

describe("emailRows", () => {
	const verified = { status: "verified" };
	const rows = emailRows(
		[
			{ id: "a", emailAddress: "old@example.com", verification: verified },
			{
				id: "b",
				emailAddress: "new@example.com",
				verification: { status: "unverified" },
			},
			{ id: "c", emailAddress: "main@example.com", verification: verified },
		],
		"c",
	);

	it("lists the primary address first", () => {
		expect(rows.map((row) => row.email)).toEqual([
			"main@example.com",
			"old@example.com",
			"new@example.com",
		]);
	});

	it("never removes the primary address", () => {
		expect(rows[0]).toMatchObject({
			status: "primary",
			canRemove: false,
			canMakePrimary: false,
		});
	});

	it("makes only a verified address primary, and offers to verify the rest", () => {
		expect(rows[1]).toMatchObject({
			status: "verified",
			canMakePrimary: true,
			canVerify: false,
		});
		expect(rows[2]).toMatchObject({
			status: "unverified",
			canMakePrimary: false,
			canVerify: true,
			canRemove: true,
		});
	});
});

describe("passwordErrors", () => {
	it("reads Clerk's validation code on the current password as a wrong password", () => {
		expect(
			passwordErrors({
				errors: [
					{
						code: "form_password_validation_failed",
						meta: { paramName: "current_password" },
					},
				],
			}),
		).toEqual({ fields: { current: "passwordIncorrect" }, form: null });
	});

	it("puts a weak new password on the new field", () => {
		expect(
			passwordErrors({
				errors: [
					{ code: "form_password_pwned", meta: { paramName: "new_password" } },
				],
			}),
		).toEqual({ fields: { next: "passwordPwned" }, form: null });
	});

	it("puts errors about no field, and network failures, on the form", () => {
		expect(passwordErrors({ errors: [{ code: "too_many_requests" }] })).toEqual(
			{ fields: {}, form: "tooManyRequests" },
		);
		expect(passwordErrors(new TypeError("Network request failed"))).toEqual({
			fields: {},
			form: "network",
		});
	});
});
