import { useUser } from "@clerk/expo";
import {
	parseHandicapIndex,
	playingHandicapPreview,
} from "@fairway/core/handicap";
import { detectLoops, selectLoops } from "@fairway/core/loops";
import type { RoundFormat } from "@fairway/core/round";
import { useMutation } from "convex/react";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { api, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { useSubmit } from "../../../convex/use-submit";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { EmptyState } from "../../../ui/empty-state";
import {
	AddRow,
	FormChoiceRow,
	FormScreen,
	FormSection,
	FormSegmentedRow,
	FormTextField,
	InlineNumberFieldRow,
	TextAction,
} from "../../../ui/form";
import { SkeletonList } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import type { CourseDetail } from "../../courses/course-detail";
import { useSimulationMode } from "../../simulation/mode/use-simulation-mode";
import { toggleLoopPick } from "./round-setup-model";

interface GuestDraft {
	key: number;
	name: string;
	index: string;
}

export function RoundSetupScreen({
	courseId,
	simulate,
}: {
	courseId: Id<"courses">;
	simulate: boolean;
}) {
	const { t } = useI18n();
	const detail = useQuery(api.courses.get, { courseId });
	const settings = useQuery(api.settings.get);

	if (detail === undefined) {
		return (
			<FormScreen>
				<SkeletonList rows={5} />
			</FormScreen>
		);
	}
	if (detail === null) {
		return <EmptyState body={t.setup.notFound} />;
	}
	return (
		<RoundSetupForm
			courseId={courseId}
			simulate={simulate}
			detail={detail}
			settings={settings}
		/>
	);
}

function RoundSetupForm({
	courseId,
	simulate,
	detail,
	settings,
}: {
	courseId: Id<"courses">;
	simulate: boolean;
	detail: CourseDetail;
	settings: ReturnType<typeof useQuery<typeof api.settings.get>>;
}) {
	const router = useRouter();
	const { t, numbers } = useI18n();
	const colors = useTokens();
	const { user } = useUser();
	const start = useMutation(api.rounds.start);
	const { setSimulating } = useSimulationMode();

	const loops = useMemo(() => detectLoops(detail.holes), [detail]);
	const [picks, setPicks] = useState<number[]>([]);
	const [teeId, setTeeId] = useState<Id<"tees"> | null>(null);
	const [format, setFormat] = useState<RoundFormat>("stableford");
	const [ownerIndex, setOwnerIndex] = useState<string | null>(null);
	const [guests, setGuests] = useState<GuestDraft[]>([]);
	const submit = useSubmit();

	// Seeded during render, so the form never paints unseeded; the query results
	// can still fill in later, and an edit is never overwritten.
	if (loops.length > 0 && picks.length === 0) {
		setPicks(loops.length >= 2 ? [0, 1] : [0]);
	}
	if (teeId === null && detail.tees[0]) setTeeId(detail.tees[0]._id);
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
	const invalidIndex = players.some((p) => !parseHandicapIndex(p.index).valid);
	const canStart =
		!!tee &&
		holeRefs.length > 0 &&
		incomplete.length === 0 &&
		!invalidIndex &&
		!submit.pending;

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

	const phLabel = (raw: string) => {
		const ph = playingHandicapPreview(raw, tee, par, holeRefs.length);
		return ph === undefined ? "" : fmt(t.setup.playingHandicap, { value: ph });
	};

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

			<FormSection
				title={t.setup.holes}
				footer={
					incomplete.length > 0
						? fmt(t.setup.incomplete, { holes: incomplete.join(", ") })
						: holeRefs.length > 0
							? `${label} · ${fmt(t.setup.holeCount, { count: holeRefs.length, par })}`
							: t.setup.holesHint
				}
			>
				{loops.map((loop, i) => {
					const count = picks.filter((p) => p === i).length;
					return (
						<FormChoiceRow
							key={loop.label}
							label={count === 2 ? `${loop.label}  ×2` : loop.label}
							secondary={fmt(t.setup.holeCount, {
								count: loop.refs.length,
								par: selectLoops(detail.holes, loops, [i]).par,
							})}
							selected={count > 0}
							onPress={() => {
								haptics.selectionChanged();
								setPicks((prev) => toggleLoopPick(prev, i));
							}}
						/>
					);
				})}
			</FormSection>

			<FormSection title={t.setup.tee}>
				{detail.tees.length === 0 ? (
					<AppText variant="footnote" style={styles.inset}>
						{t.setup.noTees}
					</AppText>
				) : (
					detail.tees.map((x) => (
						<FormChoiceRow
							key={x._id}
							role="radio"
							label={x.name}
							leading={
								x.color ? (
									<View style={[styles.teeDot, { backgroundColor: x.color }]} />
								) : undefined
							}
							secondary={fmt(t.setup.teeDetail, {
								cr: numbers.decimal(x.courseRating),
								slope: x.slopeRating,
							})}
							selected={x._id === teeId}
							onPress={() => {
								haptics.selectionChanged();
								setTeeId(x._id);
							}}
						/>
					))
				)}
			</FormSection>

			<FormSection title={t.setup.format}>
				<FormSegmentedRow
					options={[
						{ value: "stableford", label: t.setup.stableford },
						{ value: "stroke", label: t.setup.stroke },
					]}
					value={format}
					onChange={setFormat}
				/>
			</FormSection>

			<FormSection title={t.setup.players}>
				<InlineNumberFieldRow
					label={ownerName}
					suffix={phLabel(ownerIndex ?? "")}
					value={ownerIndex ?? ""}
					onChangeText={setOwnerIndex}
					placeholder={t.setup.handicapIndex}
					keyboardType="numbers-and-punctuation"
					accessibilityLabel={`${ownerName}, ${t.setup.handicapIndex}`}
				/>
				{guests.map((g, i) => {
					const name = fmt(t.setup.guest, { n: i + 1 });
					return (
						<View key={g.key} style={styles.guest}>
							<View style={styles.guestFields}>
								<FormTextField
									label={t.setup.guestName}
									appearance="plain"
									placeholder={name}
									value={g.name}
									onChangeText={(text) =>
										setGuests((prev) =>
											prev.map((x) =>
												x.key === g.key ? { ...x, name: text } : x,
											),
										)
									}
								/>
								<InlineNumberFieldRow
									label={t.setup.handicapIndex}
									suffix={phLabel(g.index)}
									value={g.index}
									keyboardType="numbers-and-punctuation"
									onChangeText={(text) =>
										setGuests((prev) =>
											prev.map((x) =>
												x.key === g.key ? { ...x, index: text } : x,
											),
										)
									}
								/>
							</View>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={fmt(t.setup.removeGuest, {
									name: g.name || name,
								})}
								hitSlop={spacing.sm}
								onPress={() =>
									setGuests((prev) => prev.filter((x) => x.key !== g.key))
								}
								style={styles.remove}
							>
								<AppText variant="heading" style={{ color: colors.danger }}>
									−
								</AppText>
							</Pressable>
						</View>
					);
				})}
				{guests.length < 3 ? (
					<AddRow
						label={t.setup.addGuest}
						onPress={() =>
							setGuests((prev) => [
								...prev,
								{ key: Date.now(), name: "", index: "" },
							])
						}
					/>
				) : null}
			</FormSection>

			{invalidIndex || submit.error ? (
				<AppText
					variant="footnote"
					style={[styles.inset, { color: colors.danger }]}
				>
					{invalidIndex ? t.profile.handicapInvalid : submit.error}
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
	teeDot: { width: 14, height: 14, borderRadius: 7 },
	guest: { flexDirection: "row", alignItems: "center" },
	guestFields: { flex: 1 },
	remove: { paddingHorizontal: spacing.md },
});
