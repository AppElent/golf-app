import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	signOut: vi.fn<() => Promise<void>>(),
	deleteUser: vi.fn<() => Promise<void>>(),
	deleteMyData: vi.fn<(args: object) => Promise<null>>(),
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
	mocks.deleteMyData.mockResolvedValue(null);
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
	const openConfirm = () =>
		fireEvent.click(screen.getByRole("button", { name: "Delete account…" }));
	const confirmPanel = () =>
		screen.getByRole("region", { name: "Delete your account?" });
	const confirmButton = () =>
		screen.getByRole("button", { name: /^(delete account|deleting…)$/i });

	it("asks first, and cancelling deletes nothing", () => {
		window.localStorage.setItem(QUEUE, "[]");
		render(<AccountSection />);
		openConfirm();
		expect(confirmPanel().textContent).toMatch(/can't be undone/i);
		// The safe choice has focus.
		expect(document.activeElement?.textContent).toBe("Cancel");

		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

		expect(screen.queryByRole("region")).toBeNull();
		expect(document.activeElement?.textContent).toBe("Delete account…");
		expect(mocks.deleteMyData).not.toHaveBeenCalled();
		expect(mocks.deleteUser).not.toHaveBeenCalled();
		expect(window.localStorage.getItem(QUEUE)).toBe("[]");
	});

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
		openConfirm();
		await act(async () => fireEvent.click(confirmButton()));

		expect(mocks.deleteMyData).toHaveBeenCalledTimes(1);
		expect(mocks.deleteUser).toHaveBeenCalledTimes(1);
		expect(mocks.deleteMyData.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.deleteUser.mock.invocationCallOrder[0],
		);
		// The unclaimed queue is nobody's to delete.
		expect(window.localStorage.getItem("fairway.scoreQueue")).toBe("[]");
		// Nothing can start a second run, or sign out halfway.
		expect(confirmButton().textContent).toBe("Deleting…");
		expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
		expect((signOutButton() as HTMLButtonElement).disabled).toBe(true);
		await act(async () => finish());
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("keeps the golfer signed in and deletes nothing more when the data cannot go", async () => {
		window.localStorage.setItem(QUEUE, "[]");
		mocks.deleteMyData.mockRejectedValueOnce(new Error("offline"));
		render(<AccountSection />);
		openConfirm();
		await act(async () => fireEvent.click(confirmButton()));

		expect(screen.getByRole("alert").textContent).toMatch(
			/nothing was deleted/i,
		);
		expect(mocks.deleteUser).not.toHaveBeenCalled();
		expect(mocks.signOut).not.toHaveBeenCalled();
		expect(window.localStorage.getItem(QUEUE)).toBe("[]");
		// Still signed in, and free to retry.
		expect((confirmButton() as HTMLButtonElement).disabled).toBe(false);
		await act(async () => fireEvent.click(confirmButton()));
		expect(mocks.deleteUser).toHaveBeenCalledTimes(1);
	});

	it("says the sign-in is left when Clerk refuses, and a retry finishes it", async () => {
		mocks.deleteUser.mockRejectedValueOnce(new Error("offline"));
		render(<AccountSection />);
		openConfirm();
		await act(async () => fireEvent.click(confirmButton()));

		expect(screen.getByRole("alert").textContent).toMatch(
			/your data was deleted, but your sign-in wasn't/i,
		);
		expect(mocks.signOut).not.toHaveBeenCalled();
		await act(async () => fireEvent.click(confirmButton()));
		expect(mocks.deleteMyData).toHaveBeenCalledTimes(2);
		expect(mocks.deleteUser).toHaveBeenCalledTimes(2);
		expect(screen.queryByRole("alert")).toBeNull();
	});
});
