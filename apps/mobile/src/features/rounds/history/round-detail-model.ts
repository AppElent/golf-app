import type { RoundRecap } from "@fairway/core/recap";
import type { RoundFormat } from "@fairway/core/round";
import { SCORE_MARKS } from "@fairway/core/scoring";
import type { Messages } from "../../../i18n/messages/en";

interface RoundTile {
	label: string;
	value: string;
	sub?: string;
}

/** The two headline figures, and the optional stats that follow them. */
export interface RoundTiles {
	score: RoundTile;
	toPar: RoundTile;
	stats: RoundTile[];
}

type RoundsCopy = Messages["rounds"];

/** How many stats the share image has room for. */
const SHARE_CARD_STATS = 3;
/** How many stats join the score and to-par on the share text's headline. */
const SHARE_HEADLINE_STATS = 2;

export function roundTiles({
	owner,
	recap,
	extra,
	format,
	holeCount,
	differential,
	decimal,
	vsPar,
	copy,
}: {
	owner: {
		scored: number;
		total: number;
		toPar: string | null;
		points: number;
	};
	recap: Pick<RoundRecap, "net" | "netToPar">;
	extra: {
		putts: number | null;
		firEligible: number;
		firMade: number;
		girHoles: number;
		girMade: number;
	};
	format: RoundFormat;
	holeCount: number;
	differential: number | null | undefined;
	decimal: (n: number) => string;
	vsPar: (n: number) => string;
	copy: RoundsCopy;
}): RoundTiles {
	return {
		score: {
			label: copy.score,
			value: owner.scored > 0 ? String(owner.total) : "–",
		},
		toPar: { label: copy.toPar, value: owner.toPar ?? "–" },
		stats: [
			recap.net !== null && recap.netToPar !== null
				? {
						label: copy.net,
						value: String(recap.net),
						sub: vsPar(recap.netToPar),
					}
				: null,
			format === "stableford"
				? { label: copy.points, value: String(owner.points) }
				: null,
			differential != null
				? {
						label: holeCount === 9 ? copy.differentialNine : copy.differential,
						value: decimal(differential),
					}
				: null,
			extra.putts !== null
				? { label: copy.putts, value: String(extra.putts) }
				: null,
			extra.firEligible > 0
				? {
						label: copy.fairways,
						value: `${extra.firMade}/${extra.firEligible}`,
					}
				: null,
			extra.girHoles > 0
				? {
						label: copy.greens,
						value: `${extra.girMade}/${extra.girHoles}`,
					}
				: null,
		].filter((tile): tile is RoundTile => Boolean(tile)),
	};
}

/** The stats shown on the share image. */
export function shareCardStats({ stats }: RoundTiles): RoundTile[] {
	return stats.slice(0, SHARE_CARD_STATS);
}

/** Latin letters NFKD does not split into a base letter and an accent. */
const LATIN_LETTERS: Record<string, string> = {
	ß: "ss",
	ø: "o",
	æ: "ae",
	œ: "oe",
	ł: "l",
	đ: "d",
	þ: "th",
};

/** Longest course part of a share file name; whole words are kept. */
const SHARE_NAME_COURSE_MAX = 40;

/**
 * `Fairway-<course>-<yyyy-mm-dd>.png` for the share image. The course is an
 * ASCII kebab-case slug (accents dropped, anything else becomes a dash), so the
 * name survives every share target; the date is the round's local calendar day.
 */
export function shareFileName(courseName: string, startedAt: Date): string {
	const words = courseName
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[ßøæœłđþ]/g, (c) => LATIN_LETTERS[c] ?? "")
		.split(/[^a-z0-9]+/)
		.filter(Boolean);
	let course = "";
	for (const word of words) {
		if (!course) {
			course = word.slice(0, SHARE_NAME_COURSE_MAX);
			continue;
		}
		const next = `${course}-${word}`;
		if (next.length > SHARE_NAME_COURSE_MAX) break;
		course = next;
	}
	const pad = (n: number) => String(n).padStart(2, "0");
	const date = `${startedAt.getFullYear()}-${pad(startedAt.getMonth() + 1)}-${pad(startedAt.getDate())}`;
	return `${["Fairway", course, date].filter(Boolean).join("-")}.png`;
}

export function shareMessage({
	courseName,
	detail,
	tiles,
	ninesText,
	marks,
	copy,
}: {
	courseName: string;
	detail: string;
	tiles: RoundTiles;
	ninesText: string | null;
	marks: RoundRecap["marks"];
	copy: RoundsCopy;
}): string {
	return [
		`⛳ ${courseName}`,
		detail,
		"",
		[tiles.score, tiles.toPar, ...tiles.stats.slice(0, SHARE_HEADLINE_STATS)]
			.map((tile) =>
				[tile.label, tile.value, tile.sub && `(${tile.sub})`]
					.filter(Boolean)
					.join(" "),
			)
			.join(" · "),
		ninesText,
		markCounts(marks, copy.markShort)
			.map(({ label, count }) => `${label} ${count}`)
			.join(" · "),
		tiles.stats
			.slice(SHARE_HEADLINE_STATS)
			.map((tile) => `${tile.label} ${tile.value}`)
			.join(" · ") || null,
		"",
		copy.shareFooter,
	]
		.filter((line) => line !== null)
		.join("\n");
}

/** The results a round has, in order, as they appear on a recap. */
export function markCounts(
	marks: RoundRecap["marks"],
	labels: Messages["rounds"]["markShort"],
) {
	return SCORE_MARKS.filter((m) => marks[m] > 0).map((m) => ({
		label: labels[m],
		count: marks[m],
	}));
}
