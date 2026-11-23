import {
	type DeletionSteps,
	runAccountDeletion,
} from "./account-deletion-model";

function steps(overrides: Partial<DeletionSteps> = {}) {
	const calls: string[] = [];
	const batches = [false, true];
	const all: DeletionSteps = {
		deleteBatch: jest.fn(async () => {
			calls.push("batch");
			return { done: batches.shift() ?? true };
		}),
		clearLocalCopy: jest.fn(() => {
			calls.push("clear");
		}),
		signOut: jest.fn(async () => {
			calls.push("signOut");
		}),
		deleteLogin: jest.fn(async () => {
			calls.push("deleteLogin");
		}),
		...overrides,
	};
	return { all, calls };
}

describe("runAccountDeletion", () => {
	it("Fairway data only: purges in batches, clears the phone's copy, signs out, keeps the login", async () => {
		const { all, calls } = steps();
		await expect(runAccountDeletion("app", all)).resolves.toBe("done");
		expect(calls).toEqual(["batch", "batch", "clear", "signOut"]);
		expect(all.deleteLogin).not.toHaveBeenCalled();
	});

	it("whole account: purges, clears the phone's copy, then deletes the login", async () => {
		const { all, calls } = steps();
		await expect(runAccountDeletion("account", all)).resolves.toBe("done");
		expect(calls).toEqual(["batch", "batch", "clear", "deleteLogin"]);
		expect(all.signOut).not.toHaveBeenCalled();
	});

	it.each(["app", "account"] as const)(
		"%s: a failed purge stops before the phone or the login is touched",
		async (choice) => {
			const { all, calls } = steps({
				deleteBatch: jest.fn(async () => {
					throw new Error("offline");
				}),
			});
			await expect(runAccountDeletion(choice, all)).resolves.toBe("data");
			expect(calls).toEqual([]);
		},
	);

	it("whole account: reports a login Clerk would not delete", async () => {
		const { all } = steps({
			deleteLogin: jest.fn(async () => {
				throw new Error("offline");
			}),
		});
		await expect(runAccountDeletion("account", all)).resolves.toBe("login");
		expect(all.clearLocalCopy).toHaveBeenCalled();
	});

	it("Fairway data only: reports a sign-out that failed", async () => {
		const { all } = steps({
			signOut: jest.fn(async () => {
				throw new Error("offline");
			}),
		});
		await expect(runAccountDeletion("app", all)).resolves.toBe("sign-out");
		expect(all.deleteLogin).not.toHaveBeenCalled();
	});
});
