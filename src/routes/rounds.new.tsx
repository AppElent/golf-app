import { useUser } from "@clerk/react";
import {
	parseHandicapIndex,
	playingHandicapPreview,
} from "@fairway/core/handicap";
import { detectLoops, selectLoops } from "@fairway/core/loops";
import type { RoundFormat } from "@fairway/core/round";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Minus, Plus, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { CTA, FIELD, SURFACE } from "../components/classes";
import { INVALID_INDEX_MESSAGE } from "../components/copy";
import { Page, PageTitle, Section } from "../components/Page";
import { PillToggle } from "../components/PillToggle";
import { useSimulationMode } from "../play/simulation";

export const Route = createFileRoute("/rounds/new")({
	component: RoundSetup,
	validateSearch: (search: Record<string, unknown>): { simulate?: true } =>
		search.simulate ? { simulate: true } : {},
});

interface GuestDraft {
	id: string;
	name: string;
	handicapIndex: string;
}

function RoundSetup() {
	const courses = useQuery(api.courses.list);
	const [courseId, setCourseId] = useState<Id<"courses"> | null>(null);
	const { simulate } = Route.useSearch();

	return (
		<Page>
			<PageTitle>{simulate ? "Course simulator" : "New round"}</PageTitle>
			{simulate ? (
				<p className="mt-2 text-[13px] text-moss">
					Practice the course from your couch: you set where you stand. Nothing
					counts for your history or handicap.
				</p>
			) : null}

			<Section title="Course">
				<div className="flex flex-col gap-2">
					{(courses ?? []).map((c) => (
						<button
							type="button"
							key={c._id}
							onClick={() => setCourseId(c._id)}
							className={`rounded-xl border px-4 py-3 text-left font-display text-[15px] font-semibold ${
								courseId === c._id
									? "border-live bg-live/10 text-ink"
									: `${SURFACE} text-ink`
							}`}
						>
							{c.name}
							{c.city ? (
								<span className="block text-[12px] font-normal text-moss">
									{c.city}
								</span>
							) : null}
						</button>
					))}
				</div>
			</Section>

			{courseId ? <CourseConfig key={courseId} courseId={courseId} /> : null}
		</Page>
	);
}

function CourseConfig({ courseId }: { courseId: Id<"courses"> }) {
	const navigate = useNavigate();
	const detail = useQuery(api.courses.get, { courseId });
	const start = useMutation(api.rounds.start);
	const { simulate } = Route.useSearch();
	const { setSimulating } = useSimulationMode();
	const { user } = useUser();
	const ownerName = user?.firstName || user?.username || "You";

	const [loopIdxs, setLoopIdxs] = useState<number[]>([]);
	const [ownerHi, setOwnerHi] = useState("");
	const [guests, setGuests] = useState<GuestDraft[]>([]);
	const [format, setFormat] = useState<RoundFormat>("stableford");
	const [teeId, setTeeId] = useState<Id<"tees"> | null>(null);
	const [error, setError] = useState<string | null>(null);

	if (detail === undefined) {
		return <p className="mt-6 text-[13px] text-stone">Loading course…</p>;
	}
	if (detail === null) {
		return <p className="mt-6 text-[13px] text-flag">Course not found.</p>;
	}

	const loops = detectLoops(detail.holes);
	const {
		holeRefs,
		incomplete,
		par: parTotal,
		label: loopLabel,
	} = selectLoops(detail.holes, loops, loopIdxs);
	const tee = detail.tees.find((t) => t._id === teeId) ?? detail.tees[0];

	const phFor = (hi: string) =>
		playingHandicapPreview(hi, tee, parTotal, holeRefs.length);

	const invalidIndex = [ownerHi, ...guests.map((g) => g.handicapIndex)].some(
		(text) => !parseHandicapIndex(text).valid,
	);
	const canStart =
		tee && holeRefs.length > 0 && incomplete.length === 0 && !invalidIndex;

	async function onStart() {
		if (!tee) return;
		setError(null);
		try {
			await start({
				courseId,
				teeId: tee._id,
				holeRefs,
				loopLabel,
				format,
				simulated: simulate,
				players: [
					{
						name: ownerName,
						handicapIndex: parseHandicapIndex(ownerHi).value ?? undefined,
					},
					...guests.map((g) => ({
						name: g.name || "Guest",
						handicapIndex:
							parseHandicapIndex(g.handicapIndex).value ?? undefined,
					})),
				],
			});
			setSimulating(simulate === true);
			navigate({ to: simulate ? "/play" : "/card" });
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not start the round.");
		}
	}

	return (
		<>
			{loops.length > 0 ? (
				<Section
					title="Holes"
					hint="Pick one loop for 9, two for 18 (same loop twice is fine)."
				>
					<div className="flex flex-wrap gap-2">
						{loops.map((loop, i) => {
							const count = loopIdxs.filter((x) => x === i).length;
							return (
								<PillToggle
									key={loop.label}
									selected={count > 0}
									tone="live"
									onClick={() =>
										setLoopIdxs((prev) =>
											count > 0 && prev.length >= 2
												? prev.filter((x) => x !== i)
												: prev.length >= 2
													? prev
													: [...prev, i],
										)
									}
								>
									{loop.label}
									{count > 1 ? " ×2" : ""}
								</PillToggle>
							);
						})}
					</div>
					{holeRefs.length > 0 ? (
						<p className="mt-2 text-[12px] text-moss">
							{holeRefs.length} holes · par {parTotal}
						</p>
					) : null}
					{incomplete.length > 0 ? (
						<p className="mt-2 flex items-start gap-1.5 text-[12px] text-flag">
							<TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
							<span>
								{incomplete.length} holes missing par/stroke index.{" "}
								<Link
									to="/courses/$courseId/edit"
									params={{ courseId }}
									className="underline"
								>
									Complete them in the editor
								</Link>{" "}
								before starting.
							</span>
						</p>
					) : null}
				</Section>
			) : null}

			{holeRefs.length > 0 ? (
				<Section title="Players">
					<PlayerRow
						name={ownerName}
						hi={ownerHi}
						onHi={setOwnerHi}
						ph={phFor(ownerHi)}
					/>
					{guests.map((g, i) => (
						<div key={g.id} className="mt-2 flex items-center gap-2">
							<input
								value={g.name}
								placeholder="Guest name"
								onChange={(e) =>
									setGuests((prev) =>
										prev.map((x, j) =>
											j === i ? { ...x, name: e.target.value } : x,
										),
									)
								}
								className={`${FIELD} min-w-0 flex-1 px-3 py-2 text-[15px]`}
							/>
							<HiInput
								value={g.handicapIndex}
								onChange={(v2) =>
									setGuests((prev) =>
										prev.map((x, j) =>
											j === i ? { ...x, handicapIndex: v2 } : x,
										),
									)
								}
								ph={phFor(g.handicapIndex)}
							/>
							<button
								type="button"
								aria-label="Remove guest"
								onClick={() =>
									setGuests((prev) => prev.filter((_, j) => j !== i))
								}
								className="rounded-full border border-card-line p-2 text-moss"
							>
								<Minus className="size-4" />
							</button>
						</div>
					))}
					<button
						type="button"
						onClick={() =>
							setGuests((prev) => [
								...prev,
								{ id: crypto.randomUUID(), name: "", handicapIndex: "" },
							])
						}
						className="mt-3 flex items-center gap-1.5 rounded-full border border-card-line px-4 py-2 font-display text-[13px] font-semibold text-ink"
					>
						<Plus className="size-4" /> Add guest
					</button>
				</Section>
			) : null}

			{detail.tees.length > 1 ? (
				<Section title="Tee">
					<select
						value={tee?._id ?? ""}
						onChange={(e) => setTeeId(e.target.value as Id<"tees">)}
						className={`${FIELD} w-full px-3 py-2 font-sans text-[15px]`}
					>
						{detail.tees.map((t) => (
							<option key={t._id} value={t._id}>
								{t.name} · CR {t.courseRating.toFixed(1)} / {t.slopeRating}
							</option>
						))}
					</select>
				</Section>
			) : null}

			{holeRefs.length > 0 ? (
				<Section title="Format">
					<div className="flex gap-2">
						{(["stableford", "stroke"] as const).map((f) => (
							<PillToggle
								key={f}
								selected={format === f}
								onClick={() => setFormat(f)}
							>
								{f === "stroke" ? "Stroke play" : "Stableford"}
							</PillToggle>
						))}
					</div>
				</Section>
			) : null}

			{invalidIndex || error ? (
				<p className="mt-4 text-[13px] font-semibold text-flag">
					{invalidIndex ? INVALID_INDEX_MESSAGE : error}
				</p>
			) : null}

			<button
				type="button"
				disabled={!canStart}
				onClick={onStart}
				className={`mt-8 ${CTA} text-[16px] disabled:opacity-40`}
			>
				{simulate ? "Start simulation" : "Start round"}
			</button>
		</>
	);
}

function PlayerRow({
	name,
	hi,
	onHi,
	ph,
}: {
	name: string;
	hi: string;
	onHi: (v: string) => void;
	ph: number | undefined;
}) {
	return (
		<div className="flex items-center gap-2">
			<span
				className={`min-w-0 flex-1 rounded-lg border ${SURFACE} px-3 py-2 font-display text-[15px] font-semibold text-ink`}
			>
				{name}
			</span>
			<HiInput value={hi} onChange={onHi} ph={ph} />
		</div>
	);
}

function HiInput({
	value,
	onChange,
	ph,
}: {
	value: string;
	onChange: (v: string) => void;
	ph: number | undefined;
}) {
	return (
		<span className="flex items-center gap-1.5">
			<input
				value={value}
				placeholder="HI"
				inputMode="decimal"
				onChange={(e) => onChange(e.target.value)}
				className={`${FIELD} w-16 px-2 py-2 text-center text-[15px]`}
			/>
			<span className="w-10 text-center font-display text-[13px] font-semibold text-live">
				{ph !== undefined ? `PH ${ph}` : "—"}
			</span>
		</span>
	);
}
