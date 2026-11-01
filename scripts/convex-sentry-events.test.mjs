import { describe, expect, it } from "vitest";
import { executionErrorEvent } from "./convex-sentry-events.mjs";

const options = { deployment: "happy-otter-123" };
const failure = {
	kind: "Completion",
	error:
		"Uncaught Error: Round not found for anna@example.com\n    at handler (../convex/rounds.ts:41:13)",
	identifier: "rounds.js:finish",
	udfType: "Mutation",
	caller: "Scheduler",
	timestamp: 1767225600.5,
	requestId: "request-1",
	executionId: "execution-1",
	logLines: ["[LOG] players: Anna, Bob"],
	success: null,
	identityType: "user",
	willRetry: false,
};

describe("executionErrorEvent", () => {
	it("forwards a failed execution with its stack and structural tags only", () => {
		const result = executionErrorEvent(failure, options);
		expect(result.error.message).toBe(
			"Uncaught Error: Round not found for [Filtered]",
		);
		expect(result.error.stack).toBe(
			"Uncaught Error: Round not found for [Filtered]\n    at handler (../convex/rounds.ts:41:13)",
		);
		expect(result.timestamp).toBe(failure.timestamp);
		expect(result.tags).toEqual({
			app: "fairway-convex",
			func: "rounds.js:finish",
			func_type: "Mutation",
			caller: "Scheduler",
			request_id: "request-1",
		});
		const serialized = JSON.stringify({ ...result, stack: result.error.stack });
		expect(serialized).not.toContain("Anna");
		expect(serialized).not.toContain("anna@example.com");
		expect(serialized).not.toContain("user");
	});

	it("redacts the arguments a validator error echoes back", () => {
		const result = executionErrorEvent(
			{
				...failure,
				error:
					"ArgumentValidationError: Object is missing the required field `holeIndex`.\n\nObject: {players: [\"Anna\"]}",
			},
			options,
		);
		expect(result.error.stack).not.toContain("Anna");
	});

	it("ignores successes, retried conflicts, progress records and malformed lines", () => {
		for (const entry of [
			null,
			{},
			{ ...failure, kind: "Progress" },
			{ ...failure, error: null },
			{ ...failure, error: "" },
			{ ...failure, identifier: undefined },
			{ ...failure, timestamp: "now" },
			{ ...failure, willRetry: true },
		]) {
			expect(executionErrorEvent(entry, options)).toBeNull();
		}
	});

	it("gives replayed history a stable event id and new executions a new one", () => {
		const id = executionErrorEvent(failure, options).eventId;
		expect(executionErrorEvent({ ...failure }, options).eventId).toBe(id);
		expect(
			executionErrorEvent({ ...failure, executionId: "execution-2" }, options)
				.eventId,
		).not.toBe(id);
		expect(
			executionErrorEvent(failure, { deployment: "other-deployment-1" })
				.eventId,
		).not.toBe(id);
	});
});
