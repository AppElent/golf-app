import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	signOut: vi.fn<(options?: { redirectUrl?: string }) => Promise<void>>(),
	deleteUser: vi.fn<() => Promise<void>>(),
	deleteMyData: vi.fn<(args: object) => Promise<{ done: boolean }>>(),
	email: "golfer@example.com" as string | undefined,
}));
vi.mock("@clerk/react", () => ({
	useClerk: () => ({ signOut: mocks.signOut }),
	useUser: () => ({
		user: mocks.email
			? {
					id: "user_golfer",
					primaryEmailAddress: { emailAddress: mocks.email },
					delete: mocks.deleteUser,
				}
			: null,
	}),
	// Clerk's reverification modal is not under test: pass the call through.
	useReverification: <A extends unknown[], R>(fetcher: (...a: A) => R) =>
		fetcher,
}));
vi.mock("convex/react", () => ({
	useMutation: () => mocks.deleteMyData,
}));

import { AccountSection } from "./account-section";

const QUEUE = "fairway.scoreQueue:user_golfer";

/** This jsdom has no working localStorage; a Map stands in for it. */
function memoryStorage(): Storage {
	const items = new Map<string, string>();
	return {
		get length() {
			return items.size;
		},
		key: (i) => [...items.keys()][i] ?? null,
		getItem: (k) => items.get(k) ?? null,
		setItem: (k, v) => void items.set(k, String(v)),
		removeItem: (k) => void items.delete(k),
		clear: () => items.clear(),
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.email = "golfer@example.com";
	mocks.signOut.mockResolvedValue(undefined);
	mocks.deleteMyData.mockResolvedValue({ done: true });
	window.sessionStorage.clear();
	mocks.deleteUser.mockResolvedValue(undefined);
	Object.defineProperty(window, "localStorage", {
		configurable: true,
		value: memoryStorage(),
	});
});
afterEach(cleanup);

const signOutButton = () =>
	screen.getByRole("button", { name: /sign(ing)? out/i });

it("shows who is signed in", () => {
	render(<AccountSection />);
	expect(screen.getByText("golfer@example.com")).toBeTruthy();
	expect(screen.getByRole("heading", { name: "Account" })).toBeTruthy();
});

it("signs out through Clerk once", async () => {
	let finish = () => {};
	mocks.signOut.mockReturnValue(
		new Promise<void>((resolve) => {
			finish = resolve;
		}),
	);
	render(<AccountSection />);
	fireEvent.click(signOutButton());
	expect(mocks.signOut).toHaveBeenCalledTimes(1);
	// While Clerk works, the button cannot send a second request.
	expect(signOutButton().textContent).toBe("Signing out…");
	expect((signOutButton() as HTMLButtonElement).disabled).toBe(true);
	fireEvent.click(signOutButton());
	expect(mocks.signOut).toHaveBeenCalledTimes(1);
	await act(async () => finish());
});

it("says so and allows a retry when sign-out fails", async () => {
	mocks.signOut.mockRejectedValueOnce(new Error("offline"));
	render(<AccountSection />);
	fireEvent.click(signOutButton());
	expect((await screen.findByRole("alert")).textContent).toMatch(
		/couldn't sign out/i,
	);
	expect((signOutButton() as HTMLButtonElement).disabled).toBe(false);
	await act(async () => fireEvent.click(signOutButton()));
	expect(mocks.signOut).toHaveBeenCalledTimes(2);
});

it("still offers sign-out before Clerk has loaded the user", () => {
	mocks.email = undefined;
	render(<AccountSection />);
	expect(screen.queryByText(/signed in as/i)).toBeNull();
	expect(signOutButton()).toBeTruthy();
});

describe("account deletion", () => {
	const open = () =>
		fireEvent.click(screen.getByRole("button", { name: "Delete account…" }));
	const choose = (name: RegExp) =>
		fireEvent.click(screen.getByRole("button", { name }));
	const APP = /^delete fairway data only/i;
	const ACCOUNT = /^delete my whole appelent account/i;
	const confirmButton = () =>
		screen.getByRole("button", {
			name: /^(delete fairway data|delete appelent account|deleting…)$/i,
		});

	it("offers Fairway data first, then the whole account, naming the other apps", () => {
		render(<AccountSection />);
		open();
		const panel = screen.getByRole("region", {
			name: "What do you want to delete?",
		});
		const options = [...panel.querySelectorAll("button")].map(
			(b) => b.textContent ?? "",
		);
		expect(options[0]).toMatch(APP);
		expect(options[1]).toMatch(ACCOUNT);
		expect(options[1]).toMatch(/gather, foundry,\s+fairway and arcade club/i);
		// The safe choice has focus.
		expect(document.activeElement?.textContent).toBe("Cancel");
	});

	it("cancelling at either step deletes nothing", () => {
		window.localStorage.setItem(QUEUE, "[]");
		render(<AccountSection />);
		open();
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		expect(screen.queryByRole("region")).toBeNull();
		expect(document.activeElement?.textContent).toBe("Delete account…");
		open();
		choose(ACCOUNT);
		expect(
			screen.getByRole("region", {
				name: "Delete your whole AppElent account?",
			}).textContent,
		).toMatch(/can't be undone/i);
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

		expect(mocks.deleteMyData).not.toHaveBeenCalled();
		expect(mocks.deleteUser).not.toHaveBeenCalled();
		expect(mocks.signOut).not.toHaveBeenCalled();
		expect(window.localStorage.getItem(QUEUE)).toBe("[]");
	});

	describe("Fairway data only", () => {
		it("deletes the data in batches, then signs out and keeps the Clerk user", async () => {
			window.localStorage.setItem(QUEUE, "[]");
			mocks.deleteMyData
				.mockResolvedValueOnce({ done: false })
				.mockResolvedValueOnce({ done: true });
			render(<AccountSection />);
			open();
			choose(APP);
			expect(
				screen.getByRole("region", { name: "Delete your Fairway data?" })
					.textContent,
			).toMatch(/keeps working in gather, foundry and arcade club/i);
			await act(async () => fireEvent.click(confirmButton()));

			expect(mocks.deleteMyData).toHaveBeenCalledTimes(2);
			expect(mocks.deleteMyData).toHaveBeenCalledWith({
				expectedSubject: "user_golfer",
			});
			expect(mocks.signOut).toHaveBeenCalledTimes(1);
			// The public `/` has no sign-in card to show the notice on.
			expect(mocks.signOut).toHaveBeenCalledWith({ redirectUrl: "/profile" });
			expect(mocks.deleteMyData.mock.invocationCallOrder[1]).toBeLessThan(
				mocks.signOut.mock.invocationCallOrder[0],
			);
			// The login is shared with the other AppElent apps.
			expect(mocks.deleteUser).not.toHaveBeenCalled();
			expect(window.localStorage.getItem(QUEUE)).toBeNull();
			// The sign-in card confirms it once.
			expect(window.sessionStorage.getItem("fairway.dataDeleted")).toBe("1");
		});

		it("stays signed in and offers a retry when the data cannot go", async () => {
			mocks.deleteMyData.mockRejectedValueOnce(new Error("offline"));
			render(<AccountSection />);
			open();
			choose(APP);
			await act(async () => fireEvent.click(confirmButton()));

			expect(screen.getByRole("alert").textContent).toMatch(
				/login wasn't touched/i,
			);
			expect(mocks.signOut).not.toHaveBeenCalled();
			expect(mocks.deleteUser).not.toHaveBeenCalled();
			await act(async () => fireEvent.click(confirmButton()));
			expect(mocks.signOut).toHaveBeenCalledTimes(1);
			expect(mocks.deleteUser).not.toHaveBeenCalled();
		});
	});

	describe("whole AppElent account", () => {
		it("deletes the app data, then the local queue, then the Clerk user", async () => {
			window.localStorage.setItem(QUEUE, "[]");
			window.localStorage.setItem("fairway.scoreQueue", "[]");
			let finish = () => {};
			mocks.deleteUser.mockImplementation(() => {
				// The account's queue is gone before Clerk ends the session.
				expect(window.localStorage.getItem(QUEUE)).toBeNull();
				return new Promise<void>((resolve) => {
					finish = resolve;
				});
			});
			render(<AccountSection />);
			open();
			choose(ACCOUNT);
			await act(async () => fireEvent.click(confirmButton()));

			expect(mocks.deleteMyData).toHaveBeenCalledWith({
				expectedSubject: "user_golfer",
			});
			expect(mocks.deleteUser).toHaveBeenCalledTimes(1);
			expect(mocks.deleteMyData.mock.invocationCallOrder[0]).toBeLessThan(
				mocks.deleteUser.mock.invocationCallOrder[0],
			);
			expect(mocks.signOut).not.toHaveBeenCalled();
			// The unclaimed queue is nobody's to delete.
			expect(window.localStorage.getItem("fairway.scoreQueue")).toBe("[]");
			// Nothing can start a second run, or sign out halfway.
			expect(confirmButton().textContent).toBe("Deleting…");
			expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
			expect((signOutButton() as HTMLButtonElement).disabled).toBe(true);
			await act(async () => finish());
			expect(screen.queryByRole("alert")).toBeNull();
			expect(window.sessionStorage.getItem("fairway.dataDeleted")).toBeNull();
		});

		it("keeps the golfer signed in when the data cannot go", async () => {
			window.localStorage.setItem(QUEUE, "[]");
			mocks.deleteMyData.mockRejectedValueOnce(new Error("offline"));
			render(<AccountSection />);
			open();
			choose(ACCOUNT);
			await act(async () => fireEvent.click(confirmButton()));

			expect(screen.getByRole("alert").textContent).toMatch(
				/couldn't finish deleting/i,
			);
			expect(mocks.deleteUser).not.toHaveBeenCalled();
			expect(mocks.signOut).not.toHaveBeenCalled();
			expect(window.localStorage.getItem(QUEUE)).toBe("[]");
			expect((confirmButton() as HTMLButtonElement).disabled).toBe(false);
			await act(async () => fireEvent.click(confirmButton()));
			expect(mocks.deleteUser).toHaveBeenCalledTimes(1);
		});

		it("says the login is left when Clerk refuses, and a retry finishes it", async () => {
			mocks.deleteUser.mockRejectedValueOnce(new Error("offline"));
			render(<AccountSection />);
			open();
			choose(ACCOUNT);
			await act(async () => fireEvent.click(confirmButton()));

			expect(screen.getByRole("alert").textContent).toMatch(
				/your appelent login wasn't/i,
			);
			expect(mocks.signOut).not.toHaveBeenCalled();
			await act(async () => fireEvent.click(confirmButton()));
			expect(mocks.deleteMyData).toHaveBeenCalledTimes(2);
			expect(mocks.deleteUser).toHaveBeenCalledTimes(2);
			expect(screen.queryByRole("alert")).toBeNull();
		});
	});
});
