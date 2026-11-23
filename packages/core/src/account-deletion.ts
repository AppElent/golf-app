/**
 * Account deletion runs in bounded batches (`account.deleteMyData`, convex
 * standard): the client repeats the call until the server says `done`. Shared
 * by "Delete Fairway data only" and "Delete my whole AppElent account" on the
 * web and the phone.
 */

/** More batches than any real account needs; past it something is wrong. */
const MAX_BATCHES = 500;

export async function deleteInBatches(
	batch: () => Promise<{ done: boolean }>,
	maxBatches = MAX_BATCHES,
): Promise<void> {
	for (let i = 0; i < maxBatches; i += 1) {
		if ((await batch()).done) return;
	}
	throw new Error("Account deletion did not finish.");
}
