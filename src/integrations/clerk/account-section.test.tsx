import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	signOut: vi.fn<() => Promise<void>>(),
	setSimulating: vi.fn(),
	email: "golfer@example.com" as string | undefined,
}));
vi.mock("@clerk/react", () => ({
	useClerk: () => ({ signOut: mocks.signOut }),
	useUser: () => ({
		user: mocks.email
			? { primaryEmailAddress: { emailAddress: mocks.email } }
			: null,
	}),
}));
vi.mock("../../play/simulation", () => ({
	useSimulationMode: () => ({
		simulating: true,
		setSimulating: mocks.setSimulating,
	}),
}));

import { AccountSection } from "./account-section";

beforeEach(() => {
	vi.clearAllMocks();
	mocks.email = "golfer@example.com";
	mocks.signOut.mockResolvedValue(undefined);
});
afterEach(cleanup);

const button = () => screen.getByRole("button", { name: /sign(ing)? out/i });

it("shows who is signed in", () => {
	render(<AccountSection />);
	expect(screen.getByText("golfer@example.com")).toBeTruthy();
	expect(screen.getByRole("heading", { name: "Account" })).toBeTruthy();
});

it("signs out through Clerk once and leaves simulation mode", async () => {
	let finish = () => {};
	mocks.signOut.mockReturnValue(
		new Promise<void>((resolve) => {
			finish = resolve;
		}),
	);
	render(<AccountSection />);
	fireEvent.click(button());
	expect(mocks.signOut).toHaveBeenCalledTimes(1);
	// Simulation mode is off before Clerk navigates away.
	expect(mocks.setSimulating).toHaveBeenCalledWith(false);
	expect(mocks.setSimulating.mock.invocationCallOrder[0]).toBeLessThan(
		mocks.signOut.mock.invocationCallOrder[0],
	);
	// While Clerk works, the button cannot send a second request.
	expect(button().textContent).toBe("Signing out…");
	expect((button() as HTMLButtonElement).disabled).toBe(true);
	fireEvent.click(button());
	expect(mocks.signOut).toHaveBeenCalledTimes(1);
	await act(async () => finish());
	expect(mocks.setSimulating).toHaveBeenCalledTimes(1);
});

it("says so and allows a retry when sign-out fails", async () => {
	mocks.signOut.mockRejectedValueOnce(new Error("offline"));
	render(<AccountSection />);
	fireEvent.click(button());
	expect((await screen.findByRole("alert")).textContent).toMatch(
		/couldn't sign out/i,
	);
	expect((button() as HTMLButtonElement).disabled).toBe(false);
	// Still signed in, so back in simulation mode.
	expect(mocks.setSimulating).toHaveBeenLastCalledWith(true);
	await act(async () => fireEvent.click(button()));
	expect(mocks.signOut).toHaveBeenCalledTimes(2);
});

it("still offers sign-out before Clerk has loaded the user", () => {
	mocks.email = undefined;
	render(<AccountSection />);
	expect(screen.queryByText(/signed in as/i)).toBeNull();
	expect(button()).toBeTruthy();
});
