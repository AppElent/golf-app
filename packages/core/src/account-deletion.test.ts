import { describe, expect, it, vi } from "vitest";
import { deleteInBatches } from "./account-deletion";

describe("deleteInBatches", () => {
	it("repeats the batch until the server says done", async () => {
		const batch = vi
			.fn<() => Promise<{ done: boolean }>>()
			.mockResolvedValueOnce({ done: false })
			.mockResolvedValueOnce({ done: false })
			.mockResolvedValueOnce({ done: true });
		await deleteInBatches(batch);
		expect(batch).toHaveBeenCalledTimes(3);
	});

	it("stops at the first failure", async () => {
		const batch = vi
			.fn<() => Promise<{ done: boolean }>>()
			.mockResolvedValueOnce({ done: false })
			.mockRejectedValueOnce(new Error("offline"));
		await expect(deleteInBatches(batch)).rejects.toThrow("offline");
		expect(batch).toHaveBeenCalledTimes(2);
	});

	it("gives up instead of looping forever", async () => {
		const batch = vi.fn(async () => ({ done: false }));
		await expect(deleteInBatches(batch, 3)).rejects.toThrow("did not finish");
		expect(batch).toHaveBeenCalledTimes(3);
	});
});
