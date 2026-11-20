import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	isLoaded: false,
	isSignedIn: false,
	convexAuthenticated: false,
}));
vi.mock("@clerk/react", () => ({
	useAuth: () => ({ isLoaded: mocks.isLoaded }),
	Show: ({
		when,
		children,
	}: {
		when: "signed-in" | "signed-out";
		children: React.ReactNode;
	}) =>
		mocks.isLoaded && (when === "signed-in") === mocks.isSignedIn
			? children
			: null,
	SignIn: () => <div>sign-in card</div>,
}));
vi.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: mocks.convexAuthenticated }),
}));

import { AuthGate } from "./auth-gate";

function renderGate() {
	return render(
		<AuthGate>
			<div>protected page</div>
		</AuthGate>,
	);
}

afterEach(() => {
	cleanup();
	mocks.isLoaded = false;
	mocks.isSignedIn = false;
	mocks.convexAuthenticated = false;
});

describe("AuthGate", () => {
	it("shows the themed placeholder while Clerk is loading", () => {
		renderGate();
		const placeholder = screen.getByRole("status");
		expect(placeholder.textContent).toBe("Connecting…");
		expect(placeholder.className).toContain("bg-canvas");
		expect(screen.queryByText("sign-in card")).toBeNull();
		expect(screen.queryByText("protected page")).toBeNull();
	});

	it("shows the sign-in card once Clerk has loaded signed out", () => {
		mocks.isLoaded = true;
		renderGate();
		expect(screen.getByText("sign-in card")).toBeTruthy();
		expect(screen.queryByRole("status")).toBeNull();
	});

	it("waits for Convex before mounting the page when signed in", () => {
		mocks.isLoaded = true;
		mocks.isSignedIn = true;
		renderGate();
		expect(screen.getByRole("status").textContent).toBe("Connecting…");
		expect(screen.queryByText("protected page")).toBeNull();
	});

	it("mounts the page once Convex has the token", () => {
		mocks.isLoaded = true;
		mocks.isSignedIn = true;
		mocks.convexAuthenticated = true;
		renderGate();
		expect(screen.getByText("protected page")).toBeTruthy();
		expect(screen.queryByRole("status")).toBeNull();
	});
});
