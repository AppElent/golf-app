import { reverifyFactor, reverifyStep } from "./reverify-model";

describe("reverifyFactor", () => {
	it("asks for the password when the account has one", () => {
		expect(
			reverifyFactor([
				{ strategy: "email_code", emailAddressId: "e1", primary: true },
				{ strategy: "password" },
			]),
		).toEqual({ strategy: "password" });
	});

	it("emails a code otherwise, to the primary address first", () => {
		expect(
			reverifyFactor([
				{
					strategy: "email_code",
					emailAddressId: "e2",
					safeIdentifier: "b@x.nl",
				},
				{
					strategy: "email_code",
					emailAddressId: "e1",
					safeIdentifier: "a@x.nl",
					primary: true,
				},
			]),
		).toEqual({
			strategy: "email_code",
			emailAddressId: "e1",
			email: "a@x.nl",
		});
	});

	it("has nothing to ask for with only passkeys, phones or SSO", () => {
		expect(reverifyFactor([{ strategy: "passkey" }])).toBeNull();
		expect(reverifyFactor([{ strategy: "phone_code" }])).toBeNull();
		expect(reverifyFactor(null)).toBeNull();
	});
});

describe("reverifyStep", () => {
	it("reads Clerk's session verification status", () => {
		expect(reverifyStep("complete")).toBe("done");
		expect(reverifyStep("needs_first_factor")).toBe("first-factor");
		expect(reverifyStep("needs_second_factor")).toBe("unsupported");
	});
});
