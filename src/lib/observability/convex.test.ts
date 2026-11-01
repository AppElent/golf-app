import type { ConvexReactClient } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
	captureException: vi.fn(),
	startSpan: vi.fn((_options: unknown, callback: () => unknown) => callback()),
}));
vi.mock("@sentry/react", () => sentry);

import { instrumentConvexClient } from "./convex";

const setScore = makeFunctionReference<"mutation">("rounds:setScore");
const args = { strokes: 4, player: "Anna" };

function clientRejecting(error: unknown) {
	const mutation = vi.fn().mockRejectedValue(error);
	const client = { mutation, action: vi.fn() } as unknown as ConvexReactClient;
	return { client: instrumentConvexClient(client), mutation };
}

beforeEach(() => vi.clearAllMocks());

describe("instrumentConvexClient", () => {
	it("reports a failed mutation once by name and rethrows the original error", async () => {
		const failure = new Error("Server Error");
		const { client, mutation } = clientRejecting(failure);

		await expect(client.mutation(setScore, args)).rejects.toBe(failure);
		await expect(client.mutation(setScore, args)).rejects.toBe(failure);

		expect(mutation).toHaveBeenCalledWith(setScore, args);
		expect(sentry.captureException).toHaveBeenCalledTimes(1);
		expect(sentry.captureException).toHaveBeenCalledWith(failure, {
			tags: { operation: "rounds:setScore", handled: true },
		});
		expect(JSON.stringify(sentry.captureException.mock.calls)).not.toContain(
			"Anna",
		);
	});

	it("leaves expected ConvexErrors to the UI", async () => {
		const { client } = clientRejecting(new ConvexError("Course not found."));

		await expect(client.mutation(setScore, args)).rejects.toBeInstanceOf(
			ConvexError,
		);
		expect(sentry.captureException).not.toHaveBeenCalled();
	});

	it("passes successful results through untouched", async () => {
		const mutation = vi.fn().mockResolvedValue("ok");
		const client = instrumentConvexClient({
			mutation,
			action: vi.fn(),
		} as unknown as ConvexReactClient);

		await expect(client.mutation(setScore, args)).resolves.toBe("ok");
		expect(sentry.captureException).not.toHaveBeenCalled();
	});
});
