import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Sparkline } from "../components/Sparkline";
import { formatDistance } from "../domain/format";
import { wouldBeIndexHistory } from "../domain/handicap";
import { formatVsPar } from "../domain/scoring";

export const Route = createFileRoute("/")({ component: HomeScreen });

function HomeScreen() {
	const settings = useQuery(api.settings.get);
	const history = useQuery(api.rounds.history, { limit: 20 });
	const clubs = useQuery(api.clubs.list);

	const units = settings?.units ?? "m";
	const rounds = history ?? [];
	const last = rounds[0] ?? null;

	// Would-be trend from differentials, chronological (oldest first).
	const differentials = [...rounds]
		.reverse()
		.map((r) => r.differential)
		.filter((d): d is number => d !== null);
	const trend = wouldBeIndexHistory(differentials);
	const delta =
		trend.length >= 2
			? trend[trend.length - 1] - trend[trend.length - 2]
			: null;

	// Most-played course for the CTA subtitle.
	const counts = new Map<string, number>();
	for (const r of rounds)
		counts.set(r.courseName, (counts.get(r.courseName) ?? 0) + 1);
	const mostPlayed =
		[...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

	const heroIndex =
		settings?.handicapIndex ??
		(trend.length > 0 ? trend[trend.length - 1] : null);

	return (
		<main className="px-5 pt-16 pb-[110px]">
			<div className="mb-6 flex items-center justify-between">
				<div>
					<p className="text-[13px] font-medium text-moss">Welcome back</p>
					<h1 className="font-display text-[22px] font-bold tracking-tight text-ink">
						Fairway
					</h1>
				</div>
				<Link
					to="/profile"
					className="flex h-11 w-11 items-center justify-center rounded-full bg-pine font-display text-base font-bold text-cream"
				>
					EJ
				</Link>
			</div>

			{/* Handicap hero */}
			<section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-pine-light to-pine p-6 text-[#eaf2e9] shadow-[0_18px_40px_-22px_rgba(15,61,42,0.9)]">
				<div className="pointer-events-none absolute -top-8 -right-8 h-36 w-36 rounded-full bg-live/15" />
				<div className="flex items-start justify-between">
					<div>
						<p className="text-[12.5px] font-semibold tracking-[0.14em] uppercase opacity-70">
							Handicap Index
						</p>
						<p className="mt-1 font-display text-[56px] leading-none font-bold tracking-tight">
							{heroIndex !== null ? heroIndex.toFixed(1) : "—"}
						</p>
						<p className="mt-2 text-[12.5px] opacity-65">
							{delta !== null
								? `${delta <= 0 ? "▾" : "▴"} ${Math.abs(delta).toFixed(1)} vs last round`
								: "Play three rounds to see your trend"}
						</p>
					</div>
					<div className="pt-2">
						<Sparkline values={trend} />
					</div>
				</div>
			</section>

			{/* Start a round */}
			<Link
				to="/rounds/new"
				className="mt-4 flex items-center justify-between rounded-[22px] bg-flag px-6 py-4 shadow-[0_14px_30px_-16px_rgba(224,83,47,0.9)]"
			>
				<span>
					<span className="block font-display text-lg font-bold text-white">
						Start a round
					</span>
					<span className="block text-[13px] text-white/80">
						{mostPlayed
							? `Back to ${mostPlayed}?`
							: "Pick a course and tee off"}
					</span>
				</span>
				<span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/18 text-white">
					→
				</span>
			</Link>

			{/* Last round */}
			{last ? (
				<section className="mt-6">
					<h2 className="font-display text-sm font-semibold uppercase tracking-wide text-moss">
						Last round
					</h2>
					<div className="mt-3 rounded-2xl border border-card-line bg-white/60 p-4">
						<div className="flex items-baseline justify-between">
							<p className="font-display text-[15px] font-semibold text-ink">
								{last.courseName}
							</p>
							<p className="font-display text-2xl font-bold text-ink">
								{last.owner.strokes || "—"}
								<span className="ml-2 text-[13px] font-semibold text-live">
									{last.owner.strokes ? formatVsPar(last.owner.vsPar) : ""}
								</span>
							</p>
						</div>
						<div className="mt-3 flex gap-4 text-[12px] text-moss">
							<Stat
								label="Putts"
								value={
									last.owner.putts !== null ? String(last.owner.putts) : "—"
								}
							/>
							<Stat
								label="FIR"
								value={
									last.owner.firEligible > 0
										? `${last.owner.firMade}/${last.owner.firEligible}`
										: "—"
								}
							/>
							<Stat
								label="GIR"
								value={
									last.owner.girHoles > 0
										? `${last.owner.girMade}/${last.owner.girHoles}`
										: "—"
								}
							/>
						</div>
					</div>
				</section>
			) : null}

			{/* Club yardages */}
			{clubs && clubs.length > 0 ? (
				<section className="mt-6">
					<h2 className="font-display text-sm font-semibold uppercase tracking-wide text-moss">
						Your clubs
					</h2>
					<div className="mt-3 flex gap-2 overflow-x-auto pb-1">
						{clubs.map((club) => (
							<div
								key={club._id}
								className="flex shrink-0 flex-col items-center rounded-xl border border-card-line bg-white/60 px-3 py-2"
							>
								<span className="font-display text-[13px] font-bold text-ink">
									{club.name}
								</span>
								<span className="text-[11px] text-moss">
									{formatDistance(club.carryMeters, units)}
								</span>
							</div>
						))}
					</div>
				</section>
			) : null}
		</main>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<span>
			<span className="mr-1 uppercase tracking-wide text-stone">{label}</span>
			<span className="font-semibold text-ink">{value}</span>
		</span>
	);
}
