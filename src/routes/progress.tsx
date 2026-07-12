import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Sparkline } from "../components/Sparkline";
import { formatDistance } from "../domain/format";
import { wouldBeIndex, wouldBeIndexHistory } from "../domain/handicap";
import { aggregateStats, type RoundStatInput } from "../domain/stats";

export const Route = createFileRoute("/progress")({
	component: ProgressScreen,
});

function ProgressScreen() {
	const settings = useQuery(api.settings.get);
	const history = useQuery(api.rounds.history, { limit: 20 });
	const clubs = useQuery(api.clubs.list);

	const units = settings?.units ?? "m";
	const rounds = history ?? [];

	const differentials = [...rounds]
		.reverse()
		.map((r) => r.differential)
		.filter((d): d is number => d !== null);
	const trend = wouldBeIndexHistory(differentials);
	const index = wouldBeIndex(differentials);

	const statInputs: RoundStatInput[] = rounds.map((r) => ({
		holeCount: r.holeCount,
		strokes: r.owner.strokes,
		vsPar: r.owner.vsPar,
		putts: r.owner.putts,
		holesWithPutts: r.owner.holesWithPutts,
		firMade: r.owner.firMade,
		firEligible: r.owner.firEligible,
		girMade: r.owner.girMade,
		girHoles: r.owner.girHoles,
	}));
	const stats = aggregateStats(statInputs);

	const pct = (v: number | null) =>
		v !== null ? `${Math.round(v * 100)}%` : "—";
	const num = (v: number | null) => (v !== null ? String(v) : "—");

	return (
		<main className="px-5 pt-16 pb-[110px]">
			<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
				Progress
			</h1>
			<p className="mt-1 text-[13px] text-moss">
				Would-be index from your last {Math.min(rounds.length, 20)} rounds.
			</p>

			{/* Would-be index headline */}
			<section className="mt-5 rounded-[22px] border border-card-line bg-white/60 p-5">
				<div className="flex items-end justify-between">
					<div>
						<p className="text-[11px] font-semibold uppercase tracking-wide text-stone">
							Would-be index
						</p>
						<p className="mt-1 font-display text-[44px] leading-none font-bold text-ink">
							{index !== null ? index.toFixed(1) : "—"}
						</p>
					</div>
					<Sparkline values={trend} stroke="var(--color-live)" />
				</div>
				{index === null ? (
					<p className="mt-2 text-[12px] text-stone">
						Finish three counting rounds to compute a would-be index.
					</p>
				) : null}
			</section>

			{/* Stats grid */}
			<section className="mt-4 grid grid-cols-2 gap-3">
				<StatCard label="Avg score" value={num(stats.avgScore)} />
				<StatCard
					label="Avg vs par"
					value={
						stats.avgVsPar !== null
							? stats.avgVsPar > 0
								? `+${stats.avgVsPar}`
								: String(stats.avgVsPar)
							: "—"
					}
				/>
				<StatCard label="Putts / 18" value={num(stats.puttsPer18)} />
				<StatCard label="Rounds" value={String(stats.rounds)} />
				<StatCard label="Fairways" value={pct(stats.firPct)} />
				<StatCard label="Greens" value={pct(stats.girPct)} />
			</section>

			{/* Club distances */}
			{clubs && clubs.length > 0 ? (
				<section className="mt-6">
					<h2 className="font-display text-sm font-semibold uppercase tracking-wide text-moss">
						Club distances
					</h2>
					<div className="mt-3 divide-y divide-card-line rounded-2xl border border-card-line bg-white/60">
						{clubs.map((club) => (
							<div
								key={club._id}
								className="flex items-center justify-between px-4 py-2.5"
							>
								<span className="font-display text-[14px] font-semibold text-ink">
									{club.name}
								</span>
								<span className="text-[13px] font-semibold text-moss">
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

function StatCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-card-line bg-white/60 px-4 py-3">
			<p className="text-[11px] font-semibold uppercase tracking-wide text-stone">
				{label}
			</p>
			<p className="mt-1 font-display text-2xl font-bold text-ink">{value}</p>
		</div>
	);
}
