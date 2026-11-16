import { pendingSignUpEmail } from "./verify-email-model";

describe("pendingSignUpEmail", () => {
	it("names the address the code went to", () => {
		expect(
			pendingSignUpEmail("a@b.nl", { id: "sua_1", emailAddress: "a@b.nl" }),
		).toBe("a@b.nl");
	});

	it("falls back to the sign-up's address without a param", () => {
		expect(
			pendingSignUpEmail(undefined, { id: "sua_1", emailAddress: "a@b.nl" }),
		).toBe("a@b.nl");
		expect(
			pendingSignUpEmail(" ", { id: "sua_1", emailAddress: "a@b.nl" }),
		).toBe("a@b.nl");
	});

	it("has nothing to verify without a sign-up in progress", () => {
		expect(
			pendingSignUpEmail("a@b.nl", { id: undefined, emailAddress: null }),
		).toBeNull();
		expect(
			pendingSignUpEmail(undefined, { id: "sua_1", emailAddress: null }),
		).toBeNull();
	});
});
