import {
	countedStrokes,
	hasFairway,
	OWNER_INDEX,
	type ScoreUpdate,
} from "@fairway/core/round";
import {
	formatVsPar,
	nineRanges,
	nineTotals,
	type ScoreMark,
	scoreMark,
	stablefordTotal,
	totalStrokes,
	vsPar,
} from "@fairway/core/scoring";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { CTA, SURFACE } from "../components/classes";
import { Page, PageNote, PageTitle } from "../components/Page";
import { SyncPill } from "../offline/SyncPill";
import { useScoreSync } from "../offline/useScoreSync";
import { useActiveRound, useSimulationMode } from "../play/simulation";

export const Route = createFileRoute("/card")({ component: CardScreen });

function CardScreen() {
	const data = useActiveRound();
	const { setSimulating } = useSimulationMode();
	const navigate = useNavigate();
	const { submit, scoreOf, pendingCount, syncing, online } = useScoreSync();
	const finish = useMutation(api.rounds.finish);
	const abandon = useMutation(api.rounds.abandon);
	const [selected, setSelected] = useState(0);
	const [playerIndex, setPlayerIndex] = useState(OWNER_INDEX);
	const [confirmFinish, setConfirmFinish] = useState(false);

	if (data === undefined) {
		return <PageNote>Loading…</PageNote>;
	}
	if (data === null) {
		return (
			<Page>
				<PageTitle>Scorecard</PageTitle>
				<p className="mt-1 text-[13px] text-moss">No active round.</p>
				<Link
					to="/rounds/new"
					className={`mt-6 block ${CTA} text-center text-[16px]`}
				>
					Start a round
				</Link>
			</Page>
		);
	}

	const { round, course, holes, scores } = data;
	const player = round.players[playerIndex];

	// Player names can repeat (two guests) and have no ids.
	const seen = new Map<string, number>();
	const playerRows = round.players.map((p, index) => {
		const n = seen.get(p.name) ?? 0;
		seen.set(p.name, n + 1);
		return { player: p, index, key: `${p.name}#${n}` };
	});

	const shownScore = (holeIndex: number) =>
		scoreOf(round._id, scores, holeIndex, playerIndex);

	const playerStrokes = holes.map((_, i) => countedStrokes(shownScore(i)));
	const total = totalStrokes(playerStrokes);
	const diff = vsPar(holes, playerStrokes);
	const points = stablefordTotal(
		holes,
		playerStrokes,
		player.playingHandicap ?? 0,
	);
	const nines = nineTotals(playerStrokes);

	const selHole = holes[selected];
	const selScore = shownScore(selected);

	const patch = (fields: ScoreUpdate) =>
		submit({
			roundId: round._id,
			holeIndex: selected,
			playerIndex,
			fields,
		});

	async function onFinish() {
		await finish({ roundId: round._id });
		if (round.simulated) setSimulating(false);
		setConfirmFinish(false);
		navigate({ to: "/" });
	}

	return (
		<Page>
			<header className="flex items-baseline justify-between">
				<PageTitle>{course.name}</PageTitle>
				<div className="flex flex-col items-end gap-1">
					<span className="text-[12px] text-moss">{round.loopLabel}</span>
					<SyncPill
						online={online}
						pendingCount={pendingCount}
						syncing={syncing}
					/>
				</div>
			</header>
			{round.simulated ? (
				<p className="mt-1 text-[12px] font-semibold text-flag">
					Simulation — not saved
				</p>
			) : null}

			{round.players.length > 1 ? (
				<div className="mt-3 flex flex-wrap gap-2">
					{playerRows.map(({ player: p, index: i, key }) => (
						<button
							type="button"
							key={key}
							onClick={() => setPlayerIndex(i)}
							className={`rounded-full border px-3 py-1.5 font-display text-[12px] font-semibold ${
								playerIndex === i
									? "border-pine bg-pine text-cream"
									: `${SURFACE} text-ink`
							}`}
						>
							{p.name}
							{p.playingHandicap !== undefined
								? ` · ${p.playingHandicap}`
								: " · —"}
						</button>
					))}
				</div>
			) : null}

			{nineRanges(holes.length).map(({ from, to }) => (
				<div key={from} className="mt-4 grid grid-cols-9 gap-1">
					{holes.slice(from, to).map((hole, i) => {
						const holeIndex = from + i;
						const s = shownScore(holeIndex);
						const strokes = countedStrokes(s);
						return (
							<button
								type="button"
								key={hole.ref}
								onClick={() => setSelected(holeIndex)}
								className={`flex flex-col items-center rounded-lg py-1.5 ${
									selected === holeIndex ? "bg-pine/10 ring-1 ring-pine" : ""
								}`}
							>
								<span className="text-[10px] font-semibold text-stone">
									{holeIndex + 1}
								</span>
								<MarkCell
									mark={scoreMark(hole.par, strokes)}
									strokes={s?.nr ? "NR" : (strokes ?? "·")}
								/>
								<span className="text-[9px] text-stone">{hole.par}</span>
							</button>
						);
					})}
				</div>
			))}

			<div
				className={`mt-4 flex items-center justify-between rounded-2xl border ${SURFACE} px-4 py-3`}
			>
				<Total label="Out" value={nines[0] || "—"} />
				{nines.length > 1 ? <Total label="In" value={nines[1] || "—"} /> : null}
				<Total label="Total" value={total || "—"} />
				<Total label="vs par" value={total ? formatVsPar(diff) : "—"} accent />
				{round.format === "stableford" ? (
					<Total label="Pts" value={points} accent />
				) : null}
			</div>

			<section className={`mt-5 rounded-2xl border ${SURFACE} p-4`}>
				<div className="flex items-baseline justify-between">
					<h2 className="font-display text-lg font-bold text-ink">
						Hole {selected + 1}
						<span className="ml-2 text-[12px] font-semibold text-moss">
							par {selHole.par} · SI {selHole.strokeIndex}
						</span>
					</h2>
					<span className="text-[11px] uppercase tracking-wide text-stone">
						{player.name}
					</span>
				</div>

				<Stepper
					label="Strokes"
					value={countedStrokes(selScore)}
					min={1}
					onChange={(n2) => patch({ strokes: n2, nr: false })}
				/>
				{playerIndex === OWNER_INDEX ? (
					<>
						<Stepper
							label="Putts"
							value={selScore?.putts ?? null}
							min={0}
							onChange={(n2) => patch({ putts: n2 })}
						/>
						<div className="mt-3 flex gap-2">
							{hasFairway(selHole.par) ? (
								<Toggle
									label="FIR"
									on={selScore?.fir ?? false}
									onToggle={() => patch({ fir: !(selScore?.fir ?? false) })}
								/>
							) : null}
							<Toggle
								label="GIR"
								on={selScore?.gir ?? false}
								onToggle={() => patch({ gir: !(selScore?.gir ?? false) })}
							/>
							<Toggle
								label="NR"
								flag
								on={selScore?.nr ?? false}
								onToggle={() => patch({ nr: !(selScore?.nr ?? false) })}
							/>
						</div>
					</>
				) : null}

				<div className="mt-4 flex justify-between">
					<button
						type="button"
						disabled={selected === 0}
						onClick={() => setSelected((s) => s - 1)}
						className="rounded-full border border-card-line px-4 py-2 font-display text-[13px] font-semibold text-ink disabled:opacity-40"
					>
						← Prev
					</button>
					<button
						type="button"
						disabled={selected === holes.length - 1}
						onClick={() => setSelected((s) => s + 1)}
						className="rounded-full border border-card-line px-4 py-2 font-display text-[13px] font-semibold text-ink disabled:opacity-40"
					>
						Next →
					</button>
				</div>
			</section>

			{confirmFinish ? (
				<div className="mt-6 rounded-2xl border border-flag/40 bg-flag/5 p-4">
					<p className="text-[13px] font-semibold text-ink">
						{round.simulated
							? "End this simulation? It is deleted: nothing counts for your history or handicap."
							: "Finish this round? Your differential is saved if the card is complete and you have a handicap."}
					</p>
					<div className="mt-3 flex gap-2">
						<button
							type="button"
							onClick={onFinish}
							className="flex-1 rounded-full bg-flag px-4 py-3 font-display text-[14px] font-bold text-white"
						>
							Finish round
						</button>
						<button
							type="button"
							onClick={() => setConfirmFinish(false)}
							className="rounded-full border border-card-line px-4 py-3 font-display text-[14px] font-semibold text-ink"
						>
							Cancel
						</button>
					</div>
				</div>
			) : (
				<div className="mt-6 flex gap-2">
					<button
						type="button"
						onClick={() => setConfirmFinish(true)}
						className="flex-1 rounded-full bg-pine px-4 py-3 font-display text-[14px] font-bold text-cream"
					>
						Finish round
					</button>
					<button
						type="button"
						onClick={async () => {
							await abandon({ roundId: round._id });
							if (round.simulated) setSimulating(false);
						}}
						className="rounded-full border border-card-line px-4 py-3 font-display text-[13px] font-semibold text-moss"
					>
						Abandon
					</button>
				</div>
			)}
		</Page>
	);
}

/** Classic golf notation: circle = under par, square = over par. */
function MarkCell({
	mark,
	strokes,
}: {
	mark: ScoreMark | null;
	strokes: number | string;
}) {
	const base =
		"flex size-7 items-center justify-center font-display text-[13px] font-bold";
	switch (mark) {
		case "eagle":
			return (
				<span className={`${base} rounded-full bg-flag text-white`}>
					{strokes}
				</span>
			);
		case "birdie":
			return (
				<span className={`${base} rounded-full border-2 border-flag text-ink`}>
					{strokes}
				</span>
			);
		case "bogey":
			return (
				<span className={`${base} rounded-md border-2 border-stone text-ink`}>
					{strokes}
				</span>
			);
		case "double":
			return (
				<span className={`${base} rounded-md bg-stone text-white`}>
					{strokes}
				</span>
			);
		default:
			return <span className={`${base} text-ink`}>{strokes}</span>;
	}
}

function Total({
	label,
	value,
	accent,
}: {
	label: string;
	value: number | string;
	accent?: boolean;
}) {
	return (
		<span className="flex flex-col items-center">
			<span className="text-[10px] uppercase tracking-wide text-stone">
				{label}
			</span>
			<span
				className={`font-display text-[17px] font-bold ${accent ? "text-live" : "text-ink"}`}
			>
				{value}
			</span>
		</span>
	);
}

function Stepper({
	label,
	value,
	min,
	onChange,
}: {
	label: string;
	value: number | null;
	min: number;
	onChange: (n: number) => void;
}) {
	return (
		<div className="mt-3 flex items-center justify-between">
			<span className="text-[13px] font-semibold text-moss">{label}</span>
			<span className="flex items-center gap-3">
				<button
					type="button"
					aria-label={`decrease ${label}`}
					disabled={value === null || value <= min}
					onClick={() => value !== null && onChange(value - 1)}
					className="rounded-full border border-card-line p-2 text-ink disabled:opacity-30"
				>
					<Minus className="size-4" />
				</button>
				<span className="w-8 text-center font-display text-xl font-bold text-ink">
					{value ?? "·"}
				</span>
				<button
					type="button"
					aria-label={`increase ${label}`}
					onClick={() => onChange((value ?? 0) + 1)}
					className="rounded-full border border-card-line p-2 text-ink"
				>
					<Plus className="size-4" />
				</button>
			</span>
		</div>
	);
}

function Toggle({
	label,
	on,
	onToggle,
	flag,
}: {
	label: string;
	on: boolean;
	onToggle: () => void;
	flag?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onToggle}
			className={`rounded-full border px-4 py-2 font-display text-[12px] font-bold ${
				on
					? flag
						? "border-flag bg-flag text-white"
						: "border-live bg-live text-white"
					: `${SURFACE} text-moss`
			}`}
		>
			{label}
		</button>
	);
}
