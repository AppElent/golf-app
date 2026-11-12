import { type Club, DEFAULT_BAG } from "@fairway/core/club-suggest";
import { GPS_WEAK_ACCURACY_M, type LatLng } from "@fairway/core/geo";
import {
	greenNumbers,
	type HazardInPlay,
	hazardsInPlay,
	holeAnchors,
} from "@fairway/core/hole-view";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { CTA } from "../components/classes";
import { HoleMap, type MapVariant } from "../play/HoleMap";
import {
	useActiveRound,
	useSimulatedPosition,
	useSimulationMode,
} from "../play/simulation";
import { useGeolocation } from "../play/useGeolocation";

export const Route = createFileRoute("/play")({ component: PlayScreen });

function PlayScreen() {
	const active = useActiveRound();
	const geometry = useQuery(
		api.courses.get,
		active ? { courseId: active.round.courseId } : "skip",
	);
	const clubs = useQuery(api.clubs.list);
	const setCurrentHole = useMutation(api.rounds.setCurrentHole);

	if (active === undefined) {
		return <Centered>Loading round…</Centered>;
	}
	if (active === null) {
		return (
			<Centered>
				No active round.{" "}
				<Link to="/rounds/new" className="text-live underline">
					Start one
				</Link>
			</Centered>
		);
	}
	return (
		<PlayInner
			active={active}
			geometry={geometry ?? null}
			bag={clubs && clubs.length > 0 ? clubs : DEFAULT_BAG}
			onSetHole={(holeIndex) =>
				setCurrentHole({ roundId: active.round._id, holeIndex })
			}
		/>
	);
}

function PlayInner({
	active,
	geometry,
	bag,
	onSetHole,
}: {
	active: NonNullable<ReturnType<typeof useQuery<typeof api.rounds.active>>>;
	geometry: ReturnType<typeof useQuery<typeof api.courses.get>> | null;
	bag: ReadonlyArray<Club>;
	onSetHole: (holeIndex: number) => void;
}) {
	const navigate = useNavigate();
	const simulated = active.round.simulated === true;
	const { position: watched, accuracyM: watchedAccuracy } = useGeolocation(
		!simulated,
	);
	const { setSimulating } = useSimulationMode();
	const markShot = useMutation(api.shots.mark);
	const [aimed, setAimed] = useState<{ ref: string; at: LatLng } | null>(null);
	const [variant, setVariant] = useState<MapVariant>("map");
	const [hitting, setHitting] = useState(false);
	const [hitFailed, setHitFailed] = useState(false);

	const idx = active.round.currentHoleIndex;
	const ref = active.round.holeRefs[idx];
	if (aimed && aimed.ref !== ref) setAimed(null);
	const holeMeta = active.holes[idx];
	const geo = geometry?.geometry.find((g) => g.ref === ref);

	// A hole with only a hole line has anchors too, but no green polygon to map.
	const anchors = geo ? holeAnchors(geo, active.tee.marker) : null;
	const mapAnchors = anchors?.greenRing ? anchors : null;
	const aim = aimed?.ref === ref ? aimed.at : anchors?.green;
	const sim = useSimulatedPosition(ref, anchors, geo?.holeLine);
	const gps = simulated ? sim.position : watched;
	const accuracyM = simulated ? null : watchedAccuracy;
	const position = gps ?? mapAnchors?.tee ?? null;
	const numbers =
		position && mapAnchors ? greenNumbers(position, mapAnchors) : null;

	/** The shot goes exactly where it was aimed (the green by default). */
	async function hitShot() {
		if (!position || !aim || hitting) return;
		sim.setWalking(false);
		setHitting(true);
		setHitFailed(false);
		try {
			await markShot({
				roundId: active.round._id,
				holeIndex: idx,
				position,
			});
			sim.moveTo(aim);
			setAimed(null);
		} catch {
			setHitFailed(true);
		} finally {
			setHitting(false);
		}
	}

	return (
		<main className="min-h-dvh bg-pine px-4 pt-14 pb-[110px]">
			{simulated ? (
				<div className="mb-3 flex items-center justify-between rounded-full bg-flag/90 py-1.5 pr-1.5 pl-4 text-[13px] font-semibold text-white">
					<span>Simulation — not saved</span>
					<button
						type="button"
						onClick={() => {
							setSimulating(false);
							navigate({ to: "/" });
						}}
						className="rounded-full bg-white/20 px-3 py-1"
					>
						Exit
					</button>
				</div>
			) : null}
			<header className="flex items-center justify-between">
				<button
					type="button"
					aria-label="Previous hole"
					disabled={idx === 0}
					onClick={() => onSetHole(idx - 1)}
					className="rounded-full bg-pine-light p-2 text-cream disabled:opacity-30"
				>
					<ChevronLeft className="size-5" />
				</button>
				<div className="text-center text-cream">
					<p className="font-display text-3xl font-bold leading-none">
						Hole {idx + 1}
					</p>
					<p className="text-[12px] text-mint-soft">
						Par {holeMeta?.par ?? "—"} · SI {holeMeta?.strokeIndex ?? "—"}
						{holeMeta?.lengthMeters
							? ` · ${Math.round(holeMeta.lengthMeters)} m`
							: ""}
					</p>
				</div>
				<button
					type="button"
					aria-label="Next hole"
					disabled={idx >= active.round.holeRefs.length - 1}
					onClick={() => onSetHole(idx + 1)}
					className="rounded-full bg-pine-light p-2 text-cream disabled:opacity-30"
				>
					<ChevronRight className="size-5" />
				</button>
			</header>

			<div className="mt-3 flex justify-center gap-1.5">
				{(["map", "rings", "bignumbers"] as const).map((v) => (
					<button
						type="button"
						key={v}
						onClick={() => setVariant(v)}
						className={`rounded-full px-3 py-1 font-display text-[11px] font-semibold uppercase tracking-wide ${
							variant === v
								? "bg-live text-white"
								: "bg-pine-light text-mint-soft"
						}`}
					>
						{v === "bignumbers" ? "Big" : v}
					</button>
				))}
			</div>

			<div className="mt-3">
				{geo && mapAnchors && numbers && position && aim ? (
					<HoleMap
						key={ref}
						geometry={geo}
						anchors={mapAnchors}
						numbers={numbers}
						position={position}
						aim={aim}
						bag={bag}
						variant={variant}
						accuracyM={accuracyM}
						onStandAt={simulated && sim.moving ? sim.moveTo : undefined}
						onAimChange={(at) => setAimed({ ref, at })}
					/>
				) : (
					<SchematicFallback
						par={holeMeta?.par}
						lengthMeters={holeMeta?.lengthMeters}
					/>
				)}
				{geo ? (
					// The hole layouts come from OpenStreetMap; its licence requires
					// this credit wherever the data is shown.
					<p className="mt-1 text-right text-[11px] text-stone">
						© OpenStreetMap contributors
					</p>
				) : null}
			</div>

			{numbers ? (
				<div className="mt-3 grid grid-cols-3 gap-2">
					<Chip label="Front" value={Math.round(numbers.front)} />
					<Chip label="Center" value={Math.round(numbers.center)} accent />
					<Chip label="Back" value={Math.round(numbers.back)} />
				</div>
			) : null}

			{simulated ? (
				<div className="mt-3 grid grid-cols-3 gap-1.5">
					<SimButton onClick={() => sim.jump("tee")}>Tee</SimButton>
					<SimButton onClick={() => sim.jump("approach")}>100 m</SimButton>
					<SimButton onClick={() => sim.jump("green")}>Green</SimButton>
					<SimButton
						active={sim.moving}
						onClick={() => sim.setMoving(!sim.moving)}
					>
						Tap to move
					</SimButton>
					<SimButton
						active={sim.walking}
						onClick={() => sim.setWalking(!sim.walking)}
					>
						{sim.walking ? "Stop" : "Walk"}
					</SimButton>
					<SimButton disabled={hitting} onClick={() => void hitShot()}>
						Hit shot
					</SimButton>
				</div>
			) : null}
			{hitFailed ? (
				<p className="mt-2 text-center text-[13px] font-semibold text-flag">
					Could not mark the shot.
				</p>
			) : null}

			{geo && position && anchors ? (
				<HazardList
					hazards={hazardsInPlay(position, anchors.green, geo, {
						maxMeters: 650,
						limit: Number.POSITIVE_INFINITY,
					})}
				/>
			) : null}

			<p className="mt-2 text-center text-[11px] text-mint-soft">
				{simulated
					? "Simulated position"
					: gps
						? accuracyM && accuracyM > GPS_WEAK_ACCURACY_M
							? `GPS ±${Math.round(accuracyM)} m`
							: "GPS locked"
						: "No GPS — distances from the tee"}
			</p>

			<button
				type="button"
				onClick={() => navigate({ to: "/card" })}
				className={`mt-5 ${CTA} text-[15px]`}
			>
				Enter score for hole {idx + 1}
			</button>
		</main>
	);
}

function SimButton({
	children,
	onClick,
	active,
	disabled,
}: {
	children: React.ReactNode;
	onClick: () => void;
	active?: boolean;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			disabled={disabled}
			className={`rounded-xl px-2 py-2.5 font-display text-[13px] font-semibold disabled:opacity-40 ${
				active ? "bg-live text-white" : "bg-pine-light text-cream"
			}`}
		>
			{children}
		</button>
	);
}

const SIDE_LABEL: Record<HazardInPlay["side"], string> = {
	left: "left",
	right: "right",
	center: "across",
};

/** Every hazard left on the hole: what to reach, what to carry. */
function HazardList({ hazards }: { hazards: HazardInPlay[] }) {
	if (hazards.length === 0) return null;
	return (
		<section className="mt-3 rounded-2xl bg-pine-light px-3 py-2 text-cream">
			<h2 className="text-[10px] uppercase tracking-wide opacity-70">
				Hazards
			</h2>
			<ul className="mt-1 flex flex-col gap-1 text-[13px]">
				{hazards.map((h) => (
					<li
						key={`${h.kind}-${h.at.lat},${h.at.lng}`}
						className="flex items-center justify-between"
					>
						<span className="flex items-center gap-2">
							<span
								aria-hidden
								className={`size-2 rounded-full ${h.kind === "water" ? "bg-sky-400" : "bg-sand"}`}
							/>
							{h.kind === "water" ? "Water" : "Bunker"}
							<span className="opacity-70">{SIDE_LABEL[h.side]}</span>
						</span>
						<span className="font-display font-semibold tabular-nums">
							{Math.round(h.reach)}–{Math.round(h.carry)} m
						</span>
					</li>
				))}
			</ul>
		</section>
	);
}

function Centered({ children }: { children: React.ReactNode }) {
	return (
		<main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center text-[14px] text-mint-soft">
			{children}
		</main>
	);
}

function Chip({
	label,
	value,
	accent,
}: {
	label: string;
	value: number;
	accent?: boolean;
}) {
	return (
		<div
			className={`rounded-2xl px-3 py-2 text-center ${accent ? "bg-live text-white" : "bg-pine-light text-cream"}`}
		>
			<p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p>
			<p className="font-display text-2xl font-bold">
				{value}
				<span className="text-[11px] opacity-70"> m</span>
			</p>
		</div>
	);
}

function SchematicFallback({
	par,
	lengthMeters,
}: {
	par?: number;
	lengthMeters?: number;
}) {
	return (
		<div className="flex h-[320px] flex-col items-center justify-center rounded-[22px] bg-pine-light text-center text-mint-soft">
			<p className="font-display text-lg font-bold text-cream">
				No map for this hole
			</p>
			<p className="mt-1 text-[12px]">
				Par {par ?? "—"}
				{lengthMeters ? ` · ${Math.round(lengthMeters)} m` : ""}
			</p>
			<p className="mt-1 text-[11px] opacity-70">Geometry incomplete in OSM.</p>
		</div>
	);
}
