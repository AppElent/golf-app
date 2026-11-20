import { emailFromParam, emailToParam } from "./email-param";

/** What Expo Router does to a deep link's query: decode, then re-read it as a form. */
function throughRouter(value: string): string {
	return new URLSearchParams(`email=${decodeURIComponent(value)}`).get(
		"email",
	) as string;
}

describe("email param", () => {
	it.each([
		"me+golf@example.com",
		"a%b@example.com",
		"a b@example.com",
		"jürgen@example.nl",
		"plain@example.com",
	])("round-trips %s, also through the router's lossy re-read", (email) => {
		const param = emailToParam(email);
		expect(param).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(emailFromParam(param)).toBe(email);
		expect(emailFromParam(throughRouter(param))).toBe(email);
	});

	it("keeps a plain email from an older link", () => {
		expect(emailFromParam("me@example.com")).toBe("me@example.com");
	});

	it("shows a value that does not decode as given", () => {
		expect(emailFromParam("%%%")).toBe("%%%");
		expect(emailFromParam(undefined)).toBeUndefined();
	});
});
