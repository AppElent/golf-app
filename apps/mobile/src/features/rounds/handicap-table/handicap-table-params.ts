import type { Id } from "../../../convex/api";

/** The round being set up, as the sheet's `setup` route parameter carries it. */
export interface HandicapTableSetup {
	courseId: Id<"courses">;
	teeId: Id<"tees">;
	holeRefs: string[];
	players: { name: string; playingHandicap?: number }[];
}

export function setupParam(setup: HandicapTableSetup): string {
	return JSON.stringify(setup);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

/** `null` for a missing or malformed parameter (a hand-written deep link). */
export function parseSetupParam(
	raw: string | undefined,
): HandicapTableSetup | null {
	let value: unknown;
	try {
		value = JSON.parse(raw ?? "");
	} catch {
		return null;
	}
	if (
		!isRecord(value) ||
		typeof value.courseId !== "string" ||
		typeof value.teeId !== "string" ||
		!Array.isArray(value.holeRefs) ||
		!value.holeRefs.every((ref) => typeof ref === "string") ||
		!Array.isArray(value.players) ||
		!value.players.every(
			(player: unknown) =>
				isRecord(player) &&
				typeof player.name === "string" &&
				(player.playingHandicap === undefined ||
					Number.isInteger(player.playingHandicap)),
		)
	) {
		return null;
	}
	return value as unknown as HandicapTableSetup;
}
