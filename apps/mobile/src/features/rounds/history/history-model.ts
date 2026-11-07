interface HistoryRound {
	_id: string;
	startedAt: number;
}

interface MonthSection<R> {
	key: string;
	title: string;
	rounds: R[];
}

/** Sections per calendar month (local time). */
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
