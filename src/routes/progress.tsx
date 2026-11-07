import { DEFAULT_UNITS, formatDistance } from "@fairway/core/format";
import {
	formatHandicapIndex,
	wouldBeFromHistory,
} from "@fairway/core/handicap";
import { formatVsPar } from "@fairway/core/scoring";
import { aggregateStats } from "@fairway/core/stats";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SURFACE } from "../components/classes";
import { Page, PageTitle, Section } from "../components/Page";
import { Sparkline } from "../components/Sparkline";
import { StatCard } from "../components/StatCard";

export const Route = createFileRoute("/progress")({
	component: ProgressScreen,
});

function ProgressScreen() {
	const history = useQuery(api.rounds.history, {});
	const clubs = useQuery(api.clubs.list);

	const units = useQuery(api.settings.get)?.units ?? DEFAULT_UNITS;
	const rounds = history ?? [];

	const { index, trend } = wouldBeFromHistory(rounds);
	const stats = aggregateStats(rounds);

	const pct = (v: number | null) =>
		v !== null ? `${Math.round(v * 100)}%` : "—";
	const num = (v: number | null) => (v !== null ? String(v) : "—");

	return (
		<Page>
			<PageTitle>Progress</PageTitle>
			<p className="mt-1 text-[13px] text-moss">
				Would-be index from your last {rounds.length} rounds.
			</p>

			<section className={`mt-5 rounded-[22px] border ${SURFACE} p-5`}>
				<div className="flex items-end justify-between">
					<div>
						<p className="text-[11px] font-semibold uppercase tracking-wide text-stone">
							Would-be index
						</p>
						<p className="mt-1 font-display text-[44px] leading-none font-bold text-ink">
							{index !== null ? formatHandicapIndex(index) : "—"}
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

			<section className="mt-4 grid grid-cols-2 gap-3">
				<StatCard label="Avg score" value={num(stats.avgScore)} />
				<StatCard
					label="Avg vs par"
					value={stats.avgVsPar !== null ? formatVsPar(stats.avgVsPar) : "—"}
				/>
				<StatCard label="Putts / 18" value={num(stats.puttsPer18)} />
				<StatCard label="Rounds" value={String(stats.rounds)} />
				<StatCard label="Fairways" value={pct(stats.firPct)} />
				<StatCard label="Greens" value={pct(stats.girPct)} />
			</section>

			{clubs && clubs.length > 0 ? (
				<Section title="Club distances">
					<div
						className={`divide-y divide-card-line rounded-2xl border ${SURFACE}`}
					>
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
				</Section>
			) : null}
		</Page>
	);
}
