import {
	createAttemptLock,
	resetCalls,
	resetReady,
	stageAfterPassword,
} from "./reset-model";

describe("resetCalls", () => {
	it("verifies the code, then submits the password", () => {
		expect(resetCalls("needs_first_factor")).toEqual(["verify", "submit"]);
	});

	it("only resubmits the password once the code is verified", () => {
		expect(resetCalls("needs_new_password")).toEqual(["submit"]);
	});
});

describe("stageAfterPassword", () => {
	it("signs in once Clerk completes the attempt", () => {
		expect(stageAfterPassword("complete")).toBe("saved");
	});

	it("points to the web when Clerk wants a step mobile sign-in lacks", () => {
		expect(stageAfterPassword("needs_second_factor")).toBe("needsWeb");
	});
});

describe("resetReady", () => {
	it("needs a 6-digit code and a password while entering", () => {
		expect(resetReady("entering", { code: "424242", password: "x" })).toBe(
			true,
		);
		expect(resetReady("entering", { code: "4242", password: "x" })).toBe(false);
		expect(resetReady("entering", { code: "424242", password: "" })).toBe(
			false,
		);
		expect(resetReady("saved", { code: "424242", password: "x" })).toBe(false);
	});
});

describe("createAttemptLock", () => {
	it("refuses a second action while the first is pending", async () => {
		const lock = createAttemptLock();
		let release: () => void = () => {};
		const first = lock.exclusive(
			"blocked",
			() =>
				new Promise<string>((resolve) => {
					release = () => resolve("first");
				}),
		);
		expect(lock.busy).toBe(true);
		await expect(lock.exclusive("blocked", async () => "second")).resolves.toBe(
			"blocked",
		);
		release();
		await expect(first).resolves.toBe("first");
		expect(lock.busy).toBe(false);
	});

	it("releases after a throwing action", async () => {
		const lock = createAttemptLock();
		await expect(
			lock.exclusive(false, async () => {
				throw new Error("offline");
			}),
		).rejects.toThrow("offline");
		await expect(lock.exclusive(false, async () => true)).resolves.toBe(true);
	});
});
