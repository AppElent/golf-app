import { useUser } from "@clerk/expo";
import { distanceValue } from "@fairway/core/format";
import {
	parseHandicapIndex,
	playingHandicapPreview,
} from "@fairway/core/handicap";
import { detectLoops, selectLoops } from "@fairway/core/loops";
import type { RoundFormat } from "@fairway/core/round";
import { formatFits } from "@fairway/core/round-formats";
import { useMutation } from "convex/react";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	ScrollView,
	type ScrollViewInstance,
	StyleSheet,
	View,
} from "react-native";
import { api, type Id } from "../../../convex/api";
import { useLiveQuery, useQuery } from "../../../convex/query-cache";
import { useSubmit } from "../../../convex/use-submit";
import { haptics } from "../../../feedback/haptics";
import { fmt, plural, useI18n } from "../../../i18n";
import { metrics, spacing, useTokens } from "../../../theme";
import { ChoiceChip, ChoiceGrid, ChoiceTile } from "../../../ui/choice-tile";
import { EmptyState } from "../../../ui/empty-state";
import { FormScreen, FormSection, TextAction } from "../../../ui/form";
import { InsetList, InsetRow } from "../../../ui/inset-list";
import { SkeletonList } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import type { CourseDetail } from "../../courses/course-detail";
import { useUnits } from "../../profile/use-units";
import { useSimulationMode } from "../../simulation/mode/use-simulation-mode";
import { RoundInProgress } from "../components/round-in-progress";
import { setupParam } from "../handicap-table/handicap-table-params";
import { FormatOptions, gameArgs, useFormatOptions } from "./format-options";
import {
	defaultTeeId,
	doubledLoop,
	FORMAT_TILES,
	MAX_PLAYERS,
	playerInitial,
	playingHandicapText,
	teeLengthMeters,
	toggleLoopPick,
	unfitFormats,
} from "./round-setup-model";
import { SetupSection } from "./setup-section";
import { type PlayerDraft, usePlayerEditor } from "./use-player-editor";

interface GuestDraft extends PlayerDraft {
	key: number;
}

export function RoundSetupScreen({
	courseId,
	simulate,
}: {
	courseId: Id<"courses">;
	simulate: boolean;
}) {
	const { t } = useI18n();
	const detail = useLiveQuery(api.courses.get, { courseId });
	const settings = useLiveQuery(api.settings.get);
	// Waited for, so the tee is seeded once, with the right default.
	const lastTeeId = useQuery(api.rounds.lastTee, { courseId });
	// A simulation may run beside a real round; a second real round may not.
	// Waited for too, so Start is never offered before the guard can decide.
	const active = useLiveQuery(api.rounds.active, simulate ? "skip" : {});

	if (
		detail === undefined ||
		lastTeeId === undefined ||
		(!simulate && active === undefined)
	) {
		return (
			<FormScreen>
				<SkeletonList rows={5} />
			</FormScreen>
		);
	}
	if (detail === null) {
		return (
			<FormScreen>
				<EmptyState body={t.setup.notFound} />
			</FormScreen>
		);
	}
	return (
		<RoundSetupForm
			courseId={courseId}
			simulate={simulate}
			detail={detail}
			lastTeeId={lastTeeId}
			active={active ?? null}
			settings={settings}
		/>
	);
}

function RoundSetupForm({
	courseId,
	simulate,
	detail,
	lastTeeId,
	active,
	settings,
}: {
	courseId: Id<"courses">;
	simulate: boolean;
	detail: CourseDetail;
	lastTeeId: Id<"tees"> | null;
	active: { course: { name: string } } | null;
	settings: ReturnType<typeof useQuery<typeof api.settings.get>>;
}) {
	const router = useRouter();
	const { t, locale, numbers } = useI18n();
	const colors = useTokens();
	const { user } = useUser();
	const start = useMutation(api.rounds.start);
	const { setSimulating } = useSimulationMode();

	const loops = useMemo(() => detectLoops(detail.holes), [detail]);
	const [picks, setPicks] = useState<number[]>(() =>
		loops.map((_, i) => i).slice(0, 2),
	);
	const [teeId, setTeeId] = useState<Id<"tees"> | null>(null);
	const units = useUnits();
	const [format, setFormat] = useState<RoundFormat>("stableford");
	const options = useFormatOptions();
	const [ownerIndex, setOwnerIndex] = useState<string | null>(null);
	const [guests, setGuests] = useState<GuestDraft[]>([]);
	const submit = useSubmit();
	const { setEdit } = usePlayerEditor();
	// A later visit to the sheet must not edit players of a closed setup.
	useEffect(() => () => setEdit(null), [setEdit]);
	const teeScroll = useRef<ScrollViewInstance>(null);
	const teeScrolled = useRef(false);

	// Seeded during render, so the form never paints unseeded; the query results
	// can still fill in later, and an edit is never overwritten.
	if (teeId === null && detail.tees[0]) {
		setTeeId(defaultTeeId(detail.tees, lastTeeId));
	}
	if (settings && ownerIndex === null) {
		setOwnerIndex(
			settings.handicapIndex === null
				? ""
				: numbers.handicap(settings.handicapIndex),
		);
	}

	const tee = detail.tees.find((x) => x._id === teeId);
	const { holeRefs, incomplete, par, label } = selectLoops(
		detail.holes,
		loops,
		picks,
	);
	const ownerName = user?.firstName || user?.username || t.setup.you;
	const players = [
		{ name: ownerName, index: ownerIndex ?? "" },
		...guests.map((g, i) => ({
			name: g.name.trim() || fmt(t.setup.guest, { n: i + 1 }),
			index: g.index,
		})),
	];
	// A game that no longer fits the players falls back; the footer says why.
	if (!formatFits(format, players.length)) setFormat("stableford");
	const canStart =
		!!tee && holeRefs.length > 0 && incomplete.length === 0 && !submit.pending;

	async function onStart() {
		if (!tee) return;
		await submit.run(
			() =>
				start({
					courseId,
					teeId: tee._id,
					holeRefs,
					loopLabel: label,
					format,
					...gameArgs(format, players.length, options),
					players: players.map((p) => ({
						name: p.name,
						handicapIndex: parseHandicapIndex(p.index).value ?? undefined,
					})),
					simulated: simulate || undefined,
				}),
			{
				errorFallback: t.setup.startError,
				onSuccess: () => {
					haptics.saveConfirmed();
					setSimulating(simulate);
					router.dismissAll();
					router.push("/play");
				},
			},
		);
	}

	const teeLength = (x: CourseDetail["tees"][number]) => {
		const length = teeLengthMeters(x, detail.holes, holeRefs);
		return length === null
			? undefined
			: `${numbers.whole(Number(distanceValue(length, units)))} ${units}`;
	};
	const teeSpoken = (x: CourseDetail["tees"][number]) =>
		[
			x.name,
			teeLength(x),
			fmt(t.setup.teeDetail, {
				cr: numbers.decimal(x.courseRating),
				slope: x.slopeRating,
			}),
		]
			.filter(Boolean)
			.join(", ");

	const unfit = unfitFormats(players.length);
	const formatFooter =
		unfit.length === 0
			? undefined
			: [
					...unfit.map(({ formats, min, max }) =>
						fmt(min === max ? t.setup.needsExactly : t.setup.needsRange, {
							formats: formats
								.map((x) => t.setup.formats[x].title)
								.join(` ${t.formats.and} `),
							n: min,
							min,
							max,
						}),
					),
					plural(locale, players.length, t.setup.playersNow),
				].join(" ");

	const loopName = (i: number) =>
		fmt(t.setup.loop, { label: loops[i]?.label ?? "" });
	const doubled = doubledLoop(picks);
	const strokeIndexes = holeRefs.map(
		(ref) => detail.holes.find((h) => h.ref === ref)?.strokeIndex,
	);
	const holesFooter =
		incomplete.length > 0
			? fmt(t.setup.incomplete, { holes: incomplete.join(", ") })
			: holeRefs.length === 0
				? t.setup.holesHint
				: doubled !== null
					? `${fmt(t.setup.loopTwice, { loop: loopName(doubled), par })}.`
					: `${fmt(t.setup.holeCount, { count: holeRefs.length, par })}. ${t.setup.holesAgain}`;

	const plays = (index: string) => {
		const value = playingHandicapPreview(index, tee, par, holeRefs.length);
		return value === undefined ? undefined : playingHandicapText(value);
	};
	const playerDetail = (index: string) => {
		const { value } = parseHandicapIndex(index);
		return value === null
			? t.setup.noIndex
			: fmt(t.setup.index, { index: numbers.handicap(value) });
	};
	const playerValue = (index: string) => {
		const value = plays(index);
		return value === undefined ? undefined : fmt(t.setup.plays, { value });
	};
	const playerFooter = (index: string) => {
		const value = plays(index);
		return value === undefined || !tee
			? t.setup.playerBlank
			: `${fmt(t.setup.playerPlays, { value, tee: tee.name })} ${t.setup.playerBlank}`;
	};

	function editOwner() {
		setEdit({
			initial: { name: ownerName, index: ownerIndex ?? "" },
			nameLocked: true,
			namePlaceholder: ownerName,
			footer: playerFooter,
			onSave: (draft) => setOwnerIndex(draft.index),
		});
		router.navigate("/setup-player");
	}

	function removeGuest(key: number) {
		setGuests((prev) => prev.filter((g) => g.key !== key));
	}

	function editGuest(guest: GuestDraft, n: number) {
		setEdit({
			initial: { name: guest.name, index: guest.index },
			nameLocked: false,
			namePlaceholder: fmt(t.setup.guest, { n }),
			footer: playerFooter,
			onSave: (draft) =>
				setGuests((prev) =>
					prev.map((g) => (g.key === guest.key ? { ...g, ...draft } : g)),
				),
			onRemove: () => removeGuest(guest.key),
		});
		router.navigate("/setup-player");
	}

	function addGuest() {
		setEdit({
			initial: { name: "", index: "" },
			nameLocked: false,
			namePlaceholder: fmt(t.setup.guest, { n: guests.length + 1 }),
			footer: playerFooter,
			onSave: (draft) =>
				setGuests((prev) => [...prev, { key: Date.now(), ...draft }]),
		});
		router.navigate("/setup-player");
	}

	function openHandicapTable() {
		if (!tee) return;
		router.push({
			pathname: "/handicap-table",
			params: {
				setup: setupParam({
					courseId,
					teeId: tee._id,
					holeRefs,
					players: players.map((p) => ({
						name: p.name,
						playingHandicap: playingHandicapPreview(
							p.index,
							tee,
							par,
							holeRefs.length,
						),
					})),
				}),
			},
		});
	}

	// `pending` stays true after a successful start, so the round this screen
	// just started never shows up here as the blocking one.
	if (active && !submit.pending) {
		return (
			<FormScreen>
				<Stack.Screen options={{ title: detail.course.name }} />
				<RoundInProgress courseName={active.course.name} />
			</FormScreen>
		);
	}

	return (
		<FormScreen
			primaryAction={{
				label: simulate ? t.setup.startSimulation : t.setup.start,
				onPress: onStart,
				loading: submit.pending,
				disabled: !canStart,
			}}
		>
			<Stack.Screen options={{ title: detail.course.name }} />

			{simulate ? (
				<AppText variant="footnote" style={styles.inset}>
					{t.setup.simulationNote}
				</AppText>
			) : null}

			<SetupSection title={t.setup.holes} footer={holesFooter}>
				<ChoiceGrid label={t.setup.holes}>
					{loops.map((loop, i) => {
						const count = picks.filter((p) => p === i).length;
						return (
							<ChoiceTile
								key={loop.label}
								label={loopName(i)}
								detail={fmt(
									count === 2 ? t.setup.loopParTwice : t.setup.loopPar,
									{ par: selectLoops(detail.holes, loops, [i]).par },
								)}
								selected={count > 0}
								onPress={() => {
									haptics.selectionChanged();
									setPicks((prev) => toggleLoopPick(prev, i));
								}}
							/>
						);
					})}
				</ChoiceGrid>
			</SetupSection>

			<SetupSection title={t.setup.tee}>
				{detail.tees.length === 0 ? (
					<AppText variant="footnote">{t.setup.noTees}</AppText>
				) : (
					<ScrollView
						ref={teeScroll}
						horizontal
						showsHorizontalScrollIndicator={false}
						accessibilityRole="radiogroup"
						accessibilityLabel={t.setup.tee}
						// Full bleed, so a chip cut off at the edge says there are more.
						style={styles.teeRow}
						contentContainerStyle={styles.teeRowContent}
					>
						{detail.tees.map((x) => (
							<View
								key={x._id}
								onLayout={({ nativeEvent }) => {
									// The last played tee may start beyond the edge.
									if (x._id !== teeId || teeScrolled.current) return;
									teeScrolled.current = true;
									const { x: left } = nativeEvent.layout;
									teeScroll.current?.scrollTo({
										x: left - metrics.screenGutter,
										animated: false,
									});
								}}
							>
								<ChoiceChip
									label={x.name}
									detail={teeLength(x)}
									accessibilityLabel={teeSpoken(x)}
									leading={
										x.color ? (
											<View
												style={[
													styles.teeDot,
													{
														backgroundColor: x.color,
														borderColor: colors.borderStrong,
													},
												]}
											/>
										) : undefined
									}
									selected={x._id === teeId}
									onPress={() => {
										haptics.selectionChanged();
										setTeeId(x._id);
									}}
								/>
							</View>
						))}
					</ScrollView>
				)}
			</SetupSection>

			<SetupSection title={t.setup.format} footer={formatFooter}>
				<ChoiceGrid label={t.setup.format}>
					{FORMAT_TILES.map((value) => (
						<ChoiceTile
							key={value}
							label={t.setup.formats[value].title}
							detail={t.setup.formats[value].detail}
							selected={value === format}
							disabled={!formatFits(value, players.length)}
							onPress={() => {
								haptics.selectionChanged();
								setFormat(value);
							}}
						/>
					))}
				</ChoiceGrid>
			</SetupSection>

			<FormatOptions
				format={format}
				players={players.map((p) => ({
					name: p.name,
					playingHandicap: playingHandicapPreview(
						p.index,
						tee,
						par,
						holeRefs.length,
					),
				}))}
				strokeIndexes={strokeIndexes}
				options={options}
			/>

			<SetupSection
				title={t.setup.players}
				footer={
					tee && holeRefs.length > 0
						? fmt(t.setup.playingFrom, {
								tee: tee.name,
								count: holeRefs.length,
							})
						: undefined
				}
				footerLink={{
					label: t.handicapTable.title,
					onPress: openHandicapTable,
				}}
			>
				<InsetList>
					<InsetRow
						leading={{ initial: playerInitial(ownerName) }}
						title={ownerName}
						secondary={fmt(t.setup.ownerDetail, {
							detail: playerDetail(ownerIndex ?? ""),
						})}
						value={playerValue(ownerIndex ?? "")}
						chevron
						onPress={editOwner}
					/>
					{guests.map((guest, i) => {
						const name = players[i + 1].name;
						return (
							<InsetRow
								key={guest.key}
								leading={{ initial: playerInitial(name) }}
								title={name}
								secondary={playerDetail(guest.index)}
								value={playerValue(guest.index)}
								chevron
								onPress={() => editGuest(guest, i + 1)}
								actions={[
									{
										key: "remove",
										label: t.common.delete,
										systemImage: "trash",
										destructive: true,
										onPress: () => removeGuest(guest.key),
									},
								]}
							/>
						);
					})}
					{players.length < MAX_PLAYERS ? (
						<InsetRow
							leading={{ symbol: "plus", circle: true }}
							title={t.setup.addGuest}
							accent
							onPress={addGuest}
						/>
					) : null}
				</InsetList>
			</SetupSection>

			{submit.error ? (
				<AppText
					selectable
					variant="footnote"
					accessibilityRole="alert"
					style={{ color: colors.danger }}
				>
					{submit.error}
				</AppText>
			) : null}

			{detail.course.ownerId === undefined ? (
				<FormSection>
					<TextAction
						label={t.setup.suggest}
						onPress={() => router.push(`/suggest/${courseId}`)}
					/>
				</FormSection>
			) : null}
		</FormScreen>
	);
}

const styles = StyleSheet.create({
	inset: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
	// The outline keeps a white tee visible on a light card.
	teeDot: {
		width: 14,
		height: 14,
		borderRadius: 7,
		borderWidth: StyleSheet.hairlineWidth * 2,
	},
	teeRow: { marginHorizontal: -metrics.screenGutter, flexGrow: 0 },
	teeRowContent: {
		gap: spacing.sm,
		paddingHorizontal: metrics.screenGutter,
	},
});
