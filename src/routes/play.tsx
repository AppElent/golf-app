import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { HoleMap, type MapVariant } from "../components/hole-map/HoleMap";
import type { HoleShapes } from "../components/hole-map/projection";
import { DEFAULT_BAG, suggestClub } from "../domain/club-suggest";
import { distancesToGreen, type LatLng } from "../domain/geo";
import { useGeolocation } from "../hooks/useGeolocation";

export const Route = createFileRoute("/play")({ component: PlayScreen });

const centroid = (ring: ReadonlyArray<LatLng>): LatLng => {
	const n = ring.length || 1;
	return {
		lat: ring.reduce((t, p) => t + p.lat, 0) / n,
		lng: ring.reduce((t, p) => t + p.lng, 0) / n,
	};
};

function PlayScreen() {
	const active = useQuery(api.rounds.active);
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
	bag: ReadonlyArray<{ name: string; carryMeters: number }>;
	onSetHole: (holeIndex: number) => void;
}) {
	const navigate = useNavigate();
	const { position: gps, accuracyM } = useGeolocation(true);
	const [variant, setVariant] = useState<MapVariant>("map");

	const idx = active.round.currentHoleIndex ?? 0;
	const ref = active.round.holeRefs[idx];
	const holeMeta = active.holes[idx];
	const geo = geometry?.geometry.find((g) => g.ref === ref);

	const shapes: HoleShapes | null = geo
		? {
				holeLine: geo.holeLine ?? [],
				fairways: geo.fairways,
				greens: geo.greens,
				bunkers: geo.bunkers,
				water: geo.water,
				tees: geo.tees,
			}
		: null;

	const teePos: LatLng | null = shapes
		? shapes.tees[0]
			? centroid(shapes.tees[0])
			: (shapes.holeLine[0] ?? null)
		: null;
	const position = gps ?? teePos;
	const greenCenter = shapes?.greens[0] ? centroid(shapes.greens[0]) : null;

	const [aim, setAim] = useState<LatLng | null>(null);
	// Reset aim to green center when the hole changes, or once geometry finishes
	// loading and a green center first becomes available (courses.get resolves
	// after this component mounts, so ref alone doesn't cover that transition).
	// biome-ignore lint/correctness/useExhaustiveDependencies: only re-run on hole change or green center arriving
	useEffect(() => {
		if (greenCenter) setAim(greenCenter);
	}, [ref, greenCenter?.lat, greenCenter?.lng]);

	const distances =
		position && shapes && shapes.greens[0]
			? distancesToGreen(position, shapes.greens[0])
			: null;

	return (
		<main className="min-h-dvh bg-pine px-4 pt-14 pb-[110px]">
			{/* Header */}
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

			{/* Variant toggle */}
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

			{/* Map */}
			<div className="mt-3">
				{shapes && position && greenCenter && aim ? (
					<HoleMap
						shapes={shapes}
						position={position}
						aim={aim}
						onAimChange={setAim}
						clubFor={(d) => suggestClub(bag, d)?.name ?? null}
						variant={variant}
						accuracyM={accuracyM}
					/>
				) : (
					<SchematicFallback
						par={holeMeta?.par}
						lengthMeters={holeMeta?.lengthMeters}
					/>
				)}
			</div>

			{/* F/C/B chips */}
			{distances ? (
				<div className="mt-3 grid grid-cols-3 gap-2">
					<Chip label="Front" value={Math.round(distances.front)} />
					<Chip label="Center" value={Math.round(distances.center)} accent />
					<Chip label="Back" value={Math.round(distances.back)} />
				</div>
			) : null}

			{/* GPS status */}
			<p className="mt-2 text-center text-[11px] text-mint-soft">
				{gps
					? accuracyM && accuracyM > 15
						? `GPS ±${Math.round(accuracyM)} m`
						: "GPS locked"
					: "No GPS — distances from the tee"}
			</p>

			{/* Enter score CTA */}
			<button
				type="button"
				onClick={() => navigate({ to: "/card" })}
				className="mt-5 w-full rounded-full bg-flag px-6 py-4 font-display text-[15px] font-bold text-white shadow-lg shadow-flag/25"
			>
				Enter score for hole {idx + 1}
			</button>
		</main>
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
