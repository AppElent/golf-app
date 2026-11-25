/**
 * The words of a game: its standing on the score sheet, the Play capsule, the
 * scorecard, the round detail and the share card. Everything is derived from
 * the scores, so a correction changes it everywhere.
 */
import { holeLabel } from "@fairway/core/format";
import { type HoleScore, holeNets, netRank } from "@fairway/core/round";
import {
	carriesOver,
	type FormatStanding,
	formatStanding,
	hasFormatOptions,
	isNet,
	type ScoredFormatRound,
	sideStrokes,
} from "@fairway/core/round-formats";
import { skinValue } from "@fairway/core/skins";
import { fmt, plural } from "../../../i18n/core";
import type { Messages } from "../../../i18n/messages/en";
import { playerInitial } from "../setup/round-setup-model";

export interface GameRound extends ScoredFormatRound {
	players: ReadonlyArray<{ name: string; playingHandicap?: number }>;
	holes: ReadonlyArray<{ ref: string; par: number; strokeIndex: number }>;
}

export interface GameCopy {
	t: Pick<Messages, "formats" | "setup" | "score">;
	locale: string;
	vsPar: (n: number) => string;
}

export interface GameBox {
	title: string;
	sub: string;
}

/** How a chip in the scorecard's game row is drawn; shape, not only colour. */
export type ChipTone = "accent" | "ink" | "outline" | "dashed" | "plain";

export interface GameCell {
	text: string;
	tone: ChipTone;
	spoken: string;
}

export interface GameRow {
	label: string;
	cells: (GameCell | null)[];
}

export interface GameResult extends GameBox {
	kicker: string;
	list: { title: string; rows: { label: string; value: string }[] } | null;
}

const PLAYER_TONES: readonly ChipTone[] = [
	"accent",
	"ink",
	"outline",
	"dashed",
];
const SEPARATOR = " · ";

/** The only side with the lowest net; null when they tie. */
function lowest(nets: readonly (number | null)[]): number | null {
	const best = Math.min(...nets.map(netRank));
	const sides = nets.flatMap((net, side) =>
		netRank(net) === best ? [side] : [],
	);
	return sides.length === 1 ? sides[0] : null;
}

type Of<K extends FormatStanding["kind"]> = Extract<
	FormatStanding,
	{ kind: K }
>;

/** A round's scores sit under sides: the players, or a scramble's teams. */
export function gameSides(
	round: GameRound,
	copy: Messages["formats"],
): { name: string; members: string | null }[] {
	if (round.format !== "scramble" || !round.teams) {
		return round.players.map(({ name }) => ({ name, members: null }));
	}
	const { teams, players } = round;
	return teams.map((team, i) => ({
		name: teams.length === 1 ? copy.team : fmt(copy.teamN, { n: i + 1 }),
		members: team.playerIndexes
			.map((player) => players[player]?.name ?? "")
			.join(", "),
	}));
}

/** "Stableford", "Match play net". */
export function formatName(
	round: Pick<GameRound, "format" | "formatOptions">,
	t: Pick<Messages, "formats" | "setup">,
): string {
	// A newer app can store a format this build doesn't know.
	const format = t.setup.formats[round.format]?.title ?? "";
	return hasFormatOptions(round.format)
		? fmt(t.formats.withScoring, {
				format,
				scoring: isNet(round.formatOptions)
					? t.formats.netLower
					: t.formats.grossLower,
			})
		: format;
}

/** The scores with one hole replaced, as the sheet's entry would save it. */
export function withHole(
	scores: readonly HoleScore[],
	holeIndex: number,
	entries: readonly { strokes: number | null; nr: boolean }[],
): HoleScore[] {
	return [
		...scores.filter((s) => s.holeIndex !== holeIndex),
		...entries.flatMap(({ strokes, nr }, playerIndex) =>
			strokes === null && !nr
				? []
				: [{ holeIndex, playerIndex, strokes: strokes ?? undefined, nr }],
		),
	];
}

export function gameText(round: GameRound, { t, locale, vsPar }: GameCopy) {
	const copy = t.formats;
	const { holes, scores } = round;
	const net = isNet(round.formatOptions);
	const scoring = net ? copy.net : copy.gross;
	const received = sideStrokes(round, holes);
	const sides = gameSides(round, copy);
	const names = sides.map((side) => side.name);
	const standing = formatStanding(round);

	const hole = (i: number) => holeLabel(holes[i].ref);
	const count = (n: number, forms: { one: string; other: string }) =>
		plural(locale, n, forms);
	const afterHoles = (n: number) => (n > 0 ? count(n, copy.afterHoles) : null);
	const toPlay = (n: number) => count(n, copy.toPlay);
	const list = (parts: readonly (string | number)[]) =>
		parts.length < 2
			? parts.join("")
			: `${parts.slice(0, -1).join(", ")} ${copy.and} ${parts.at(-1)}`;
	const listNames = (indexes: readonly number[]) =>
		list(indexes.map((i) => names[i]));
	const listHoles = (indexes: readonly number[]) => list(indexes.map(hole));
	const score = (value: number | null) =>
		value === null
			? copy.pickedUp
			: `${net ? copy.netLower : copy.grossLower} ${value}`;
	const withScore = (value: number | null) =>
		value === null
			? copy.pickedUp
			: fmt(copy.withScore, { score: score(value) });

	const against = (nets: readonly (number | null)[]) => {
		const [a, b] = [...nets]
			.sort((x, y) => (x ?? Infinity) - (y ?? Infinity))
			.map((value) => value ?? t.score.pickedUp.toLowerCase());
		return fmt(copy.against, { scoring, a, b });
	};

	const matchResult = ({ up, left }: { up: number; left: number }) =>
		left === 0 ? `${up} UP` : `${up}&${left}`;
	const matchLead = (lead: number) =>
		lead === 0
			? copy.allSquare
			: fmt(copy.up, { name: names[lead > 0 ? 0 : 1], n: Math.abs(lead) });
	const matchWon = (result: NonNullable<Of<"match">["result"]>) =>
		fmt(copy.wins, {
			name: names[result.winner],
			result: matchResult(result),
		});
	const matchTitle = (match: Of<"match">) =>
		match.result
			? matchWon(match.result)
			: match.halved
				? copy.halved
				: matchLead(match.lead);

	const byValue = (values: readonly number[]) =>
		values
			.map((value, side) => ({ value, side }))
			.sort((a, b) => b.value - a.value || a.side - b.side);
	const ranking = (values: readonly number[]) =>
		byValue(values)
			.map(({ value, side }) => `${names[side]} ${value}`)
			.join(SEPARATOR);
	const leaders = (values: readonly number[]) => {
		const best = Math.max(...values);
		return values.flatMap((value, side) => (value === best ? [side] : []));
	};

	const teamTotals = ({ teams }: Of<"scramble">) =>
		teams
			.map(
				(team, i) =>
					`${names[i]} ${vsPar(net ? team.netVsPar : team.vsPar)}${
						team.pickedUp > 0 && teams.length > 1 ? ` ${copy.pickedUp}` : ""
					}`,
			)
			.join(SEPARATOR);
	const holesWon = ({ teams }: Of<"scramble">) =>
		teams.length > 1 && teams.some((team) => team.holesWon > 0)
			? fmt(copy.holesWon, { list: teams.map((x) => x.holesWon).join("–") })
			: null;

	const strokesOn = (holeIndex: number): string | null => {
		const gets = received.flatMap((strokes, side) =>
			strokes[holeIndex] ? [{ side, n: strokes[holeIndex] }] : [],
		);
		if (gets.length === 0) return null;
		if (gets.every(({ n }) => n === 1)) {
			return fmt(
				gets.length === 1 ? copy.strokeHere.one : copy.strokeHere.other,
				{
					names: listNames(gets.map(({ side }) => side)),
				},
			);
		}
		return fmt(copy.strokesHere, {
			list: gets
				.map(
					({ side, n }) => `${names[side]} ${n < 0 ? "−" : "+"}${Math.abs(n)}`,
				)
				.join(", "),
		});
	};
	const join = (...parts: (string | null)[]) =>
		parts.filter(Boolean).join(SEPARATOR);
	const capital = (text: string) =>
		text.charAt(0).toUpperCase() + text.slice(1);

	/** Above the score entry of a hole: the saved standing. */
	function sheetStanding(holeIndex: number): GameBox | null {
		if (!standing) return null;
		const strokes = strokesOn(holeIndex);
		switch (standing.kind) {
			case "match":
				return {
					title: matchTitle(standing),
					sub: standing.result
						? copy.decided
						: join(
								standing.toPlay > 0 ? capital(toPlay(standing.toPlay)) : null,
								strokes &&
									`${strokes} ${fmt(copy.strokeIndex, { si: holes[holeIndex].strokeIndex })}`,
							),
				};
			case "skins": {
				const { value, carriedFrom } = skinOn(holeIndex);
				return {
					title: fmt(copy.skinWorth, { n: hole(holeIndex), value }),
					sub: join(
						carriedFrom.length > 0
							? fmt(copy.carriedFrom, {
									count: carriedFrom.length,
									holes: listHoles(carriedFrom),
								})
							: carriesOver(round.formatOptions)
								? copy.nothingCarried
								: null,
						strokes,
					),
				};
			}
			case "sixes":
				return {
					title: ranking(standing.totals),
					sub: capital(join(afterHoles(standing.played), strokes)),
				};
			case "scramble":
				return {
					title: teamTotals(standing),
					sub: capital(
						join(afterHoles(standing.played), holesWon(standing), strokes),
					),
				};
		}
	}

	const skinOn = (holeIndex: number) =>
		skinValue(
			holeIndex,
			holes.length,
			scores,
			received,
			carriesOver(round.formatOptions),
		);

	/** Below the entry, once every side has a score on the hole. */
	function holeResult(holeIndex: number): GameBox | null {
		if (!standing) return null;
		switch (standing.kind) {
			case "match": {
				const result = standing.holes[holeIndex];
				if (!result) return null;
				const before = formatStanding({
					...round,
					scores: scores.filter((s) => s.holeIndex !== holeIndex),
				}) as Of<"match">;
				const won =
					result.winner === null
						? copy.holeHalved
						: fmt(copy.matchWins, { name: names[result.winner] });
				const played = against(result.nets);
				if (before.result) {
					return { title: won, sub: `${played} ${copy.decided}` };
				}
				return {
					title: join(won, matchTitle(standing)),
					sub: `${played} ${
						standing.result
							? fmt(copy.saveResult, { result: matchWon(standing.result) })
							: standing.halved
								? copy.saveHalved
								: fmt(copy.saveStanding, {
										standing: matchLead(standing.lead),
										left: toPlay(standing.toPlay),
									})
					}`,
				};
			}
			case "skins": {
				const result = standing.holes[holeIndex];
				if (!result) return null;
				if (result.winner !== null) {
					return {
						title: fmt(count(result.value, copy.takesSkins), {
							name: names[result.winner],
						}),
						sub: capital(`${score(result.nets[result.winner])}.`),
					};
				}
				const next = holeIndex + 1;
				return {
					title:
						result.tied.length === 0
							? copy.nobodyScored
							: fmt(copy.tied, {
									names: listNames(result.tied),
									score: score(result.nets[result.tied[0]]),
								}),
					sub: !carriesOver(round.formatOptions)
						? copy.skinGone
						: next < holes.length
							? `${copy.skinCarries} ${fmt(copy.nextWorth, { n: hole(next), value: result.value + 1 })}`
							: copy.skinStays,
				};
			}
			case "sixes": {
				const result = standing.holes[holeIndex];
				if (!result) return null;
				return {
					title: ranking(result.points),
					sub: `${sixesSentence(result.points, result.nets)}.`,
				};
			}
			case "scramble": {
				if (names.length < 2) return null;
				const nets = holeNets(scores, holeIndex, received);
				if (!nets) return null;
				const winner = lowest(nets);
				return {
					title:
						winner === null
							? copy.holeHalved
							: fmt(copy.matchWins, { name: names[winner] }),
					sub: against(nets),
				};
			}
		}
	}

	function sixesSentence(
		points: readonly number[],
		nets: readonly (number | null)[],
	): string {
		const order = byValue(points).map(({ side }) => side);
		const [first, second, third] = order;
		const top = points[first];
		if (top === 2)
			return fmt(copy.sixesAllTied, { score: withScore(nets[first]) });
		if (top === 3) {
			return fmt(copy.sixesShareFirst, {
				names: listNames([first, second]),
				score: withScore(nets[first]),
			});
		}
		return [
			fmt(copy.sixesWins, { name: names[first], score: score(nets[first]) }),
			points[second] === points[third]
				? fmt(copy.sixesShareSecond, {
						names: listNames([second, third]),
						score: withScore(nets[second]),
					})
				: fmt(copy.sixesSecond, {
						name: names[second],
						score: withScore(nets[second]),
					}),
		].join("; ");
	}

	/** One line on the Play screen. */
	function capsule(holeIndex: number): string | null {
		if (!standing) return null;
		switch (standing.kind) {
			case "match": {
				if (standing.result || standing.halved) return matchTitle(standing);
				const line = join(matchLead(standing.lead), toPlay(standing.toPlay));
				return standing.dormie ? fmt(copy.dormie, { standing: line }) : line;
			}
			case "skins": {
				const best = leaders(standing.won);
				return join(
					fmt(copy.skinValue, { value: skinOn(holeIndex).value }),
					best.length === 1
						? `${names[best[0]]} ${standing.won[best[0]]}`
						: null,
				);
			}
			case "sixes":
				return ranking(standing.totals);
			case "scramble":
				return teamTotals(standing);
		}
	}

	/** Above the scorecard. */
	function cardStanding(): GameBox | null {
		if (!standing) return null;
		switch (standing.kind) {
			case "match":
				return {
					title: matchTitle(standing),
					sub: join(
						scoring,
						standing.toPlay > 0 ? toPlay(standing.toPlay) : null,
					),
				};
			case "skins":
				return {
					title: ranking(standing.won),
					sub: join(
						scoring,
						standing.carried > 0
							? count(standing.carried, copy.onTable)
							: standing.toPlay > 0
								? toPlay(standing.toPlay)
								: null,
					),
				};
			case "sixes":
				return {
					title: ranking(standing.totals),
					sub: join(
						scoring,
						standing.toPlay > 0 ? toPlay(standing.toPlay) : null,
					),
				};
			case "scramble":
				return {
					title: teamTotals(standing),
					sub: join(scoring, holesWon(standing)),
				};
		}
	}

	const chip = (
		side: number,
		text: string,
		spoken: string,
		holeIndex: number,
	): GameCell => ({
		text,
		tone: PLAYER_TONES[side] ?? "plain",
		spoken: fmt(copy.holeSpoken, { n: hole(holeIndex), text: spoken }),
	});
	const plain = (
		text: string,
		spoken: string,
		holeIndex: number,
	): GameCell => ({
		text,
		tone: "plain",
		spoken: fmt(copy.holeSpoken, { n: hole(holeIndex), text: spoken }),
	});

	/** The scorecard's rows under the players. */
	function cardRows(): GameRow[] {
		if (!standing) return [];
		switch (standing.kind) {
			case "match":
				return [
					{
						label: copy.rowMatch,
						cells: standing.holes.map((result, i) => {
							// Holes after the match is decided are only played out.
							if (
								!result ||
								(standing.result && i > standing.result.holeIndex)
							) {
								return null;
							}
							if (result.lead === 0) {
								return plain(copy.chipAllSquare, copy.allSquare, i);
							}
							const side = result.lead > 0 ? 0 : 1;
							return chip(
								side,
								`${playerInitial(names[side])}${Math.abs(result.lead)}`,
								matchLead(result.lead),
								i,
							);
						}),
					},
				];
			case "skins":
				return [
					{
						label: copy.rowSkins,
						cells: standing.holes.map((result, i) => {
							if (!result) return null;
							if (result.winner === null) {
								return carriesOver(round.formatOptions)
									? plain("→", copy.skinTiedSpoken, i)
									: plain("–", copy.skinNoneSpoken, i);
							}
							return chip(
								result.winner,
								`${playerInitial(names[result.winner])}${result.value}`,
								fmt(count(result.value, copy.skinWonSpoken), {
									name: names[result.winner],
								}),
								i,
							);
						}),
					},
				];
			case "sixes": {
				const initials = names.map(playerInitial);
				return names.map((name, side) => ({
					label: fmt(copy.rowPoints, {
						initial:
							initials.filter((x) => x === initials[side]).length > 1
								? `${initials[side]}${side + 1}`
								: initials[side],
					}),
					cells: standing.holes.map((result, i) =>
						result
							? plain(
									String(result.points[side]),
									`${name} ${count(result.points[side], copy.points)}`,
									i,
								)
							: null,
					),
				}));
			}
			case "scramble":
				if (names.length < 2) return [];
				return [
					{
						label: copy.rowHoles,
						cells: holes.map((_, i) => {
							const nets = holeNets(scores, i, received);
							if (!nets) return null;
							const side = lowest(nets);
							return side === null
								? plain("–", copy.holeHalved, i)
								: chip(
										side,
										String(side + 1),
										fmt(copy.matchWins, { name: names[side] }),
										i,
									);
						}),
					},
				];
		}
	}

	/** Skins or points per player, most first. */
	function totals(): GameResult["list"] {
		if (standing?.kind === "skins") {
			return {
				title: copy.perPlayer,
				rows: [
					...byValue(standing.won).map(({ value, side }) => ({
						label: names[side],
						value: count(value, copy.skins),
					})),
					...(standing.carried > 0
						? [
								{
									label: copy.table,
									value: count(standing.carried, copy.skins),
								},
							]
						: []),
				],
			};
		}
		if (standing?.kind === "sixes") {
			return {
				title: copy.pointsPerPlayer,
				rows: byValue(standing.totals).map(({ value, side }) => ({
					label: names[side],
					value: count(value, copy.points),
				})),
			};
		}
		return null;
	}

	/** The outcome card of a round; null without a single settled hole. */
	function result(): GameResult | null {
		if (!standing || standing.played === 0) return null;
		const kicker = t.setup.formats[round.format].title;
		switch (standing.kind) {
			case "match": {
				const { result: outcome } = standing;
				const rest = outcome
					? standing.holes.flatMap((x, i) =>
							x && i > outcome.holeIndex ? [i] : [],
						)
					: [];
				return {
					kicker: fmt(copy.matchAgainst, { name: names[1] }),
					title: matchTitle(standing),
					sub: outcome
						? [
								fmt(copy.decidedOn, { n: hole(outcome.holeIndex) }),
								rest.length > 0
									? fmt(count(rest.length, copy.playedOut), {
											holes: listHoles(rest),
										})
									: null,
							]
								.filter(Boolean)
								.join(" ")
						: standing.halved
							? ""
							: count(standing.played, copy.afterHoles),
					list: null,
				};
			}
			case "skins": {
				const best = leaders(standing.won);
				const value = standing.won[best[0]];
				return {
					kicker,
					title:
						value === 0
							? copy.noSkins
							: best.length === 1
								? fmt(copy.winsWith, { name: names[best[0]], value })
								: fmt(copy.tiedWith, { names: listNames(best), value }),
					sub:
						standing.carried > 0
							? fmt(count(standing.carried, copy.left), {
									holes: listHoles(standing.carriedFrom),
								})
							: "",
					list: totals(),
				};
			}
			case "sixes": {
				const best = leaders(standing.totals);
				const value = count(standing.totals[best[0]], copy.points);
				return {
					kicker,
					title:
						best.length === 1
							? fmt(copy.winsWith, { name: names[best[0]], value })
							: fmt(copy.tiedWith, { names: listNames(best), value }),
					sub:
						standing.toPlay > 0 ? count(standing.played, copy.afterHoles) : "",
					list: totals(),
				};
			}
			case "scramble": {
				const { winner } = standing;
				const single = standing.teams.length < 2;
				return {
					kicker,
					title:
						winner === null
							? teamTotals(standing)
							: winner === "tied"
								? copy.tiedTeams
								: fmt(copy.winsTeam, { name: names[winner] }),
					sub: join(
						single || winner === null ? scoring : teamTotals(standing),
						holesWon(standing),
					),
					list: null,
				};
			}
		}
	}

	/** The share card's headline and the line under it. */
	function share(totalsText: readonly string[]): GameBox | null {
		const outcome = result();
		if (!standing || !outcome) return null;
		let title = outcome.title;
		if (standing.kind === "match" && standing.result) {
			const { winner } = standing.result;
			title = fmt(copy.shareMatch, {
				name: names[winner],
				opponent: names[winner === 0 ? 1 : 0],
				result: matchResult(standing.result),
			});
		} else if (standing.kind === "skins") {
			const best = leaders(standing.won);
			if (best.length === 1 && standing.won[best[0]] > 0) {
				title = fmt(copy.shareSkins, {
					name: names[best[0]],
					value: standing.won[best[0]],
				});
			}
		}
		return {
			title,
			sub: join(
				formatName(round, t),
				...names.map((name, i) => `${name} ${totalsText[i] ?? "–"}`),
			),
		};
	}

	return {
		standing,
		names,
		sides,
		received,
		sheetStanding,
		holeResult,
		capsule,
		cardStanding,
		cardRows,
		totals,
		result,
		share,
	};
}

export type GameText = ReturnType<typeof gameText>;

/**
 * The winner and the holes left, when saving `after` decided the match that
 * `before` had open and there are holes to play out.
 */
export function newlyDecided(
	before: FormatStanding | null,
	after: FormatStanding | null,
): { winner: 0 | 1; left: number } | null {
	if (before?.kind !== "match" || after?.kind !== "match") return null;
	if (before.result || !after.result || after.result.left === 0) return null;
	return { winner: after.result.winner, left: after.result.left };
}
