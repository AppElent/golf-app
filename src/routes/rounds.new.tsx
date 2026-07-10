import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Minus, Plus, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { playingHandicap } from "../domain/handicap";
import { detectLoops } from "../domain/loops";

export const Route = createFileRoute("/rounds/new")({ component: RoundSetup });

interface GuestDraft {
	id: string;
	name: string;
	handicapIndex: string; // raw input, "" = scratch
}

function RoundSetup() {
	const navigate = useNavigate();
	const courses = useQuery(api.courses.list);
	const [courseId, setCourseId] = useState<Id<"courses"> | null>(null);
	const detail = useQuery(api.courses.get, courseId ? { courseId } : "skip");
	const start = useMutation(api.rounds.start);

	const [loopIdxs, setLoopIdxs] = useState<number[]>([]); // 1 or 2 picks, dup ok
	const [ownerHi, setOwnerHi] = useState("");
	const [guests, setGuests] = useState<GuestDraft[]>([]);
	const [format, setFormat] = useState<"stroke" | "stableford">("stableford");
	const [error, setError] = useState<string | null>(null);

	const loops = useMemo(
		() =>
			detail
				? detectLoops(
						detail.holes.flatMap((h) =>
							h.ref !== undefined ? [{ ref: h.ref, number: h.number }] : [],
						),
					)
				: [],
		[detail],
	);

	const holeRefs = loopIdxs.flatMap((i) => loops[i]?.refs ?? []);
	const byRef = new Map((detail?.holes ?? []).map((h) => [h.ref, h]));
	const incomplete = holeRefs.filter((ref) => {
		const h = byRef.get(ref);
		return !h || h.par === undefined || h.strokeIndex === undefined;
	});
	const parTotal = holeRefs.reduce(
		(sum, ref) => sum + (byRef.get(ref)?.par ?? 0),
		0,
	);
	const tee = detail?.tees[0];

	const phFor = (hi: string): number | undefined => {
		const n = Number.parseFloat(hi);
		if (Number.isNaN(n) || !tee || holeRefs.length === 0) return undefined;
		return playingHandicap(n, tee.slopeRating, tee.courseRating, parTotal);
	};

	const canStart =
		courseId && tee && holeRefs.length > 0 && incomplete.length === 0;

	async function onStart() {
		if (!courseId || !tee) return;
		setError(null);
		try {
			await start({
				courseId,
				teeId: tee._id,
				holeRefs,
				loopLabel: loopIdxs.map((i) => loops[i]?.label).join(" + "),
				format,
				players: [
					{
						name: "Eric",
						handicapIndex:
							ownerHi === "" ? undefined : Number.parseFloat(ownerHi),
					},
					...guests.map((g) => ({
						name: g.name || "Guest",
						handicapIndex:
							g.handicapIndex === ""
								? undefined
								: Number.parseFloat(g.handicapIndex),
					})),
				],
			});
			navigate({ to: "/card" });
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not start the round.");
		}
	}

	return (
		<main className="px-5 pt-16 pb-[110px]">
			<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
				New round
			</h1>

			{/* Course */}
			<Section title="Course">
				<div className="flex flex-col gap-2">
					{(courses ?? []).map((c) => (
						<button
							type="button"
							key={c._id}
							onClick={() => {
								setCourseId(c._id);
								setLoopIdxs([]);
							}}
							className={`rounded-xl border px-4 py-3 text-left font-display text-[15px] font-semibold ${
								courseId === c._id
									? "border-live bg-live/10 text-ink"
									: "border-card-line bg-white/60 text-ink"
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

			{/* Loops */}
			{courseId && loops.length > 0 ? (
				<Section
					title="Holes"
					hint="Pick one loop for 9, two for 18 (same loop twice is fine)."
				>
					<div className="flex flex-wrap gap-2">
						{loops.map((loop, i) => {
							const count = loopIdxs.filter((x) => x === i).length;
							return (
								<button
									type="button"
									key={loop.label}
									onClick={() =>
										setLoopIdxs((prev) =>
											count > 0 && prev.length >= 2
												? prev.filter((x) => x !== i)
												: prev.length >= 2
													? prev
													: [...prev, i],
										)
									}
									className={`rounded-full border px-4 py-2 font-display text-[13px] font-semibold ${
										count > 0
											? "border-live bg-live text-white"
											: "border-card-line bg-white/60 text-ink"
									}`}
								>
									{loop.label}
									{count > 1 ? " ×2" : ""}
								</button>
							);
						})}
					</div>
					{holeRefs.length > 0 ? (
						<p className="mt-2 text-[12px] text-moss">
							{holeRefs.length} holes · par {parTotal}
						</p>
					) : null}
					{incomplete.length > 0 && courseId ? (
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

			{/* Players */}
			{holeRefs.length > 0 ? (
				<Section title="Players">
					<PlayerRow
						name="Eric (you)"
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
								className="min-w-0 flex-1 rounded-lg border border-card-line bg-cream px-3 py-2 text-[15px] text-ink"
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

			{/* Format */}
			{holeRefs.length > 0 ? (
				<Section title="Format">
					<div className="flex gap-2">
						{(["stableford", "stroke"] as const).map((f) => (
							<button
								type="button"
								key={f}
								onClick={() => setFormat(f)}
								className={`rounded-full border px-4 py-2 font-display text-[13px] font-semibold ${
									format === f
										? "border-pine bg-pine text-cream"
										: "border-card-line bg-white/60 text-ink"
								}`}
							>
								{f === "stroke" ? "Stroke play" : "Stableford"}
							</button>
						))}
					</div>
				</Section>
			) : null}

			{error ? (
				<p className="mt-4 text-[13px] font-semibold text-flag">{error}</p>
			) : null}

			<button
				type="button"
				disabled={!canStart}
				onClick={onStart}
				className="mt-8 w-full rounded-full bg-flag px-6 py-4 font-display text-[16px] font-bold text-white shadow-lg shadow-flag/25 disabled:opacity-40"
			>
				Start round
			</button>
		</main>
	);
}

function Section({
	title,
	hint,
	children,
}: {
	title: string;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<section className="mt-6">
			<h2 className="font-display text-sm font-semibold uppercase tracking-wide text-moss">
				{title}
			</h2>
			{hint ? <p className="mt-0.5 text-[12px] text-stone">{hint}</p> : null}
			<div className="mt-3">{children}</div>
		</section>
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
			<span className="min-w-0 flex-1 rounded-lg border border-card-line bg-white/60 px-3 py-2 font-display text-[15px] font-semibold text-ink">
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
				className="w-16 rounded-lg border border-card-line bg-cream px-2 py-2 text-center text-[15px] text-ink"
			/>
			<span className="w-10 text-center font-display text-[13px] font-semibold text-live">
				{ph !== undefined ? `PH ${ph}` : "—"}
			</span>
		</span>
	);
}
