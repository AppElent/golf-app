import { OWNER_INDEX, type RoundFormat } from "@fairway/core/round";
import {
	hasFormatOptions,
	isNet,
	sideHandicaps,
} from "@fairway/core/round-formats";
import { teamHandicaps } from "@fairway/core/scramble";
import { type ReactElement, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, plural, useI18n } from "../../../i18n";
import { metrics, radius, spacing, useTokens } from "../../../theme";
import {
	FormSection,
	FormSegmentedRow,
	FormSwitchRow,
	GroupedSurface,
} from "../../../ui/form";
import { AppText } from "../../../ui/text";
import {
	nextPartner,
	playingHandicapText,
	scrambleTeams,
	TWO_TEAM_PLAYERS,
} from "./round-setup-model";
import { SetupSection } from "./setup-section";

/** WHS shares of the playing handicaps per team size, as shown. */
const TEAM_SHARES: Record<number, string> = {
	3: "30 · 20 · 10%",
	4: "25 · 20 · 15 · 10%",
};

/** What the owner picked for the games; kept while they try other formats. */
export function useFormatOptions() {
	const [scoring, setScoring] = useState<"net" | "gross">("net");
	const [carryOver, setCarryOver] = useState(true);
	const [teamCount, setTeamCount] = useState<1 | 2>(1);
	const [partner, setPartner] = useState(OWNER_INDEX + 1);
	return {
		scoring,
		setScoring,
		carryOver,
		setCarryOver,
		teamCount,
		setTeamCount,
		partner,
		setPartner,
	};
}

type Options = ReturnType<typeof useFormatOptions>;

/** The game's part of `rounds.start`: only what its format has. */
export function gameArgs(
	format: RoundFormat,
	playerCount: number,
	options: Pick<Options, "scoring" | "carryOver" | "teamCount" | "partner">,
) {
	const { scoring, carryOver } = options;
	return {
		formatOptions: hasFormatOptions(format)
			? format === "skins"
				? { scoring, carryOver }
				: { scoring }
			: undefined,
		teams:
			format === "scramble"
				? scrambleTeams(playerCount, options.teamCount, options.partner)
				: undefined,
	};
}

export function FormatOptions({
	format,
	players,
	strokeIndexes,
	options,
}: {
	format: RoundFormat;
	players: readonly { name: string; playingHandicap?: number }[];
	/** Of the holes picked, one per hole. */
	strokeIndexes: readonly (number | undefined)[];
	options: Options;
}) {
	const { t, locale } = useI18n();
	if (!hasFormatOptions(format)) return null;
	const { scoring, setScoring } = options;

	const scoringRow = (
		<FormSegmentedRow
			label={t.setup.scoring}
			options={[
				{ value: "net", label: t.formats.net },
				{ value: "gross", label: t.formats.gross },
			]}
			value={scoring}
			onChange={setScoring}
		/>
	);

	if (format === "scramble") {
		return (
			<ScrambleOptions
				players={players}
				options={options}
				scoringRow={scoringRow}
			/>
		);
	}

	const matchFooter = () => {
		if (!isNet({ scoring })) return t.setup.noStrokes;
		const strokes = sideHandicaps({ format, players: [...players] });
		const count = Math.max(...strokes);
		if (count <= 0) return t.setup.matchLevel;
		// "HCP 1 to n" is only true on a round with every stroke index once.
		const all18 =
			strokeIndexes.length === 18 && new Set(strokeIndexes).size === 18;
		const forms =
			all18 && count <= 18 ? t.setup.matchStrokesOn : t.setup.matchStrokes;
		return `${fmt(plural(locale, count, forms), {
			name: players[strokes.indexOf(count)].name,
		})} ${t.setup.matchCounts}`;
	};

	return (
		<SetupSection
			title={t.setup.formats[format].title}
			footer={
				format === "match"
					? matchFooter()
					: format === "skins"
						? t.setup.carryOverFooter
						: t.setup.sixesFooter
			}
		>
			<FormSection>
				{scoringRow}
				{format === "skins" ? (
					<FormSwitchRow
						label={t.setup.carryOver}
						value={options.carryOver}
						onValueChange={options.setCarryOver}
					/>
				) : null}
			</FormSection>
		</SetupSection>
	);
}

function ScrambleOptions({
	players,
	options,
	scoringRow,
}: {
	players: readonly { name: string; playingHandicap?: number }[];
	options: Options;
	scoringRow: ReactElement;
}) {
	const { t, locale } = useI18n();
	const canSplit = players.length >= TWO_TEAM_PLAYERS;
	const teams = scrambleTeams(
		players.length,
		options.teamCount,
		options.partner,
	);
	const split = teams.length > 1;
	const net = isNet(options);
	const handicaps = teamHandicaps(
		teams,
		players.map((p) => p.playingHandicap ?? 0),
	);
	const teamName = (i: number) =>
		split ? fmt(t.formats.teamN, { n: i + 1 }) : t.formats.team;
	const share = TEAM_SHARES[teams[0].playerIndexes.length];
	const footer = [
		split ? t.setup.teamTap : canSplit ? null : t.setup.twoTeamsNeed,
		net
			? share
				? fmt(t.setup.teamHandicap, { share })
				: t.setup.teamHandicapTwo
			: t.setup.noStrokes,
		t.setup.scrambleCounts,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<SetupSection title={t.setup.teams} footer={footer}>
			<FormSection>
				{canSplit ? (
					<FormSegmentedRow
						label={t.setup.teams}
						options={([1, 2] as const).map((n) => ({
							value: String(n),
							label: plural(locale, n, t.setup.teamChoice),
						}))}
						value={String(teams.length)}
						onChange={(value) => options.setTeamCount(value === "2" ? 2 : 1)}
					/>
				) : null}
				{scoringRow}
			</FormSection>
			{teams.map(({ playerIndexes }, team) => (
				<GroupedSurface key={teamName(team)} style={styles.team}>
					<View style={styles.teamHeader}>
						<AppText variant="control">{teamName(team)}</AppText>
						{net ? (
							<AppText variant="footnote">
								{fmt(t.setup.plays, {
									value: playingHandicapText(handicaps[team]),
								})}
							</AppText>
						) : null}
					</View>
					<View style={styles.chips}>
						{playerIndexes.map((player) => {
							const { name, playingHandicap } = players[player];
							const detail =
								playingHandicap === undefined
									? undefined
									: playingHandicapText(playingHandicap);
							const movable = split && player !== OWNER_INDEX;
							return (
								<PlayerChip
									key={player}
									name={name}
									detail={detail}
									hint={fmt(t.setup.moveTo, { team: teamName(1 - team) })}
									onPress={
										movable
											? () => {
													haptics.selectionChanged();
													options.setPartner(
														nextPartner(teams, options.partner, player),
													);
												}
											: undefined
									}
								/>
							);
						})}
					</View>
				</GroupedSurface>
			))}
		</SetupSection>
	);
}

/** A player in their team; without `onPress` they stay where they are. */
function PlayerChip({
	name,
	detail,
	hint,
	onPress,
}: {
	name: string;
	detail?: string;
	hint: string;
	onPress?: () => void;
}) {
	const colors = useTokens();
	const ground = {
		backgroundColor: colors.surface,
		borderColor: colors.borderStrong,
	};
	const content = (
		<>
			<AppText variant="control">{name}</AppText>
			{detail ? <AppText variant="footnote">{detail}</AppText> : null}
		</>
	);
	if (!onPress) {
		return (
			<View accessible style={[styles.chip, ground]}>
				{content}
			</View>
		);
	}
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityHint={hint}
			style={({ pressed }) => [
				styles.chip,
				ground,
				pressed && { backgroundColor: colors.surface2 },
			]}
		>
			{content}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	team: { gap: spacing.sm },
	teamHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	chip: {
		minHeight: metrics.hitTarget,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		paddingHorizontal: 14,
		borderRadius: radius.pill,
		borderWidth: 1.5,
	},
	chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
