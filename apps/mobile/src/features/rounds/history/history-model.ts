/**
 * How the rounds list reads: newest first, one section per month, and one
 * line per round that says the score the way a golfer says it.
 */
import { formatVsPar } from "@fairway/core/scoring";

export interface HistoryRound {
	_id: string;
	startedAt: number;
	owner: { strokes: number; vsPar: number };
}

export interface MonthSection<R> {
	key: string;
	title: string;
	rounds: R[];
}

/** Sections per calendar month (local time), in the order given. */
export function groupByMonth<R extends HistoryRound>(
	rounds: readonly R[],
	locale: string,
): MonthSection<R>[] {
	const sections: MonthSection<R>[] = [];
	for (const round of rounds) {
		const date = new Date(round.startedAt);
		const key = `${date.getFullYear()}-${date.getMonth()}`;
		let section = sections.at(-1);
		if (section?.key !== key) {
			section = {
				key,
				title: date.toLocaleDateString(locale, {
					month: "long",
					year: "numeric",
				}),
				rounds: [],
			};
			sections.push(section);
		}
		section.rounds.push(round);
	}
	return sections;
}

/** "84 (+12)"; undefined for a round with no strokes recorded. */
export function scoreLabel(owner: HistoryRound["owner"]): string | undefined {
	return owner.strokes > 0
		? `${owner.strokes} (${formatVsPar(owner.vsPar)})`
		: undefined;
}

/** The owner's putts / fairways / greens on one round, from stored scores. */
export function ownerRoundStats(
	holes: readonly { par: number }[],
	scores: readonly {
		holeIndex: number;
		playerIndex: number;
		putts?: number;
		fir?: boolean;
		gir?: boolean;
	}[],
): {
	putts: number | null;
	fairways: { hit: number; of: number } | null;
	greens: { hit: number; of: number } | null;
} {
	const own = scores.filter((s) => s.playerIndex === 0);
	const withPutts = own.filter((s) => s.putts !== undefined);
	const fir = own.filter(
		(s) => s.fir !== undefined && (holes[s.holeIndex]?.par ?? 0) >= 4,
	);
	const gir = own.filter((s) => s.gir !== undefined);
	return {
		putts:
			withPutts.length > 0
				? withPutts.reduce((t, s) => t + (s.putts ?? 0), 0)
				: null,
		fairways:
			fir.length > 0
				? { hit: fir.filter((s) => s.fir).length, of: fir.length }
				: null,
		greens:
			gir.length > 0
				? { hit: gir.filter((s) => s.gir).length, of: gir.length }
				: null,
	};
}
