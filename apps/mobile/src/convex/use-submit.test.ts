import { runSubmit } from "./use-submit";

function screen() {
	const state = {
		open: true,
		pending: false,
		error: "from the last try" as string | null,
	};
	return {
		state,
		hooks: {
			isOpen: () => state.open,
			isPending: () => state.pending,
			setPending: (pending: boolean) => {
				state.pending = pending;
			},
			setError: (error: string | null) => {
				state.error = error;
			},
		},
	};
}

describe("runSubmit", () => {
	it("navigates on success and stays pending while the screen leaves", async () => {
		const { state, hooks } = screen();
		const onSuccess = jest.fn();
		await runSubmit(async () => {}, hooks, {
			errorFallback: "Failed",
			onSuccess,
		});
		expect(onSuccess).toHaveBeenCalledTimes(1);
		expect(state.pending).toBe(true);
		expect(state.error).toBeNull();
	});

	it("is pending while the action runs", async () => {
		const { state, hooks } = screen();
		let during = false;
		await runSubmit(
			async () => {
				during = state.pending;
			},
			hooks,
			{ errorFallback: "Failed" },
		);
		expect(during).toBe(true);
	});

	it("does not navigate once the screen has gone", async () => {
		const { state, hooks } = screen();
		const onSuccess = jest.fn();
		await runSubmit(
			async () => {
				state.open = false;
			},
			hooks,
			{ errorFallback: "Failed", onSuccess },
		);
		expect(onSuccess).not.toHaveBeenCalled();
	});

	it("tells a multi-step action when the screen has gone", async () => {
		const { state, hooks } = screen();
		const seen: boolean[] = [];
		await runSubmit(
			async (isOpen) => {
				seen.push(isOpen());
				state.open = false;
				seen.push(isOpen());
			},
			hooks,
			{ errorFallback: "Failed" },
		);
		expect(seen).toEqual([true, false]);
	});

	it("runs one submit at a time", async () => {
		const { hooks } = screen();
		const action = jest.fn(async () => {});
		const onSuccess = jest.fn();
		const options = { errorFallback: "Failed", onSuccess };
		await Promise.all([
			runSubmit(action, hooks, options),
			runSubmit(action, hooks, options),
		]);
		expect(action).toHaveBeenCalledTimes(1);
		expect(onSuccess).toHaveBeenCalledTimes(1);
	});

	it("shows the server's message, without its stack, and lets the user retry", async () => {
		const { state, hooks } = screen();
		const onSuccess = jest.fn();
		await runSubmit(
			async () => {
				throw new Error(
					"[Request ID: 42] Round not found.\n    at handler (rounds.ts:1)",
				);
			},
			hooks,
			{ errorFallback: "Failed", onSuccess },
		);
		expect(state.error).toBe("Round not found.");
		expect(state.pending).toBe(false);
		expect(onSuccess).not.toHaveBeenCalled();
	});

	it("falls back when the failure has no message to show", async () => {
		const { state, hooks } = screen();
		await runSubmit(() => Promise.reject("nope"), hooks, {
			errorFallback: "Failed",
		});
		expect(state.error).toBe("Failed");
	});

	it("hands the message to onError instead, when there is one", async () => {
		const { state, hooks } = screen();
		const onError = jest.fn();
		await runSubmit(() => Promise.reject(new Error("Nope.")), hooks, {
			errorFallback: "Failed",
			onError,
		});
		expect(onError).toHaveBeenCalledWith("Nope.");
		expect(state.error).toBeNull();
		expect(state.pending).toBe(false);
	});
});
