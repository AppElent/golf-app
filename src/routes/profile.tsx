import { formatDistance, type Units } from "@fairway/core/format";
import { GPS_WEAK_ACCURACY_M } from "@fairway/core/geo";
import {
	formatHandicapIndex,
	parseHandicapIndex,
} from "@fairway/core/handicap";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { FIELD, SURFACE } from "../components/classes";
import { INVALID_INDEX_MESSAGE } from "../components/copy";
import { Page, PageNote, PageTitle, Section } from "../components/Page";
import { PillToggle } from "../components/PillToggle";
import { StatCard } from "../components/StatCard";

export const Route = createFileRoute("/profile")({ component: ProfileScreen });

function ProfileScreen() {
	const settings = useQuery(api.settings.get);
	const courses = useQuery(api.courses.list);
	const history = useQuery(api.rounds.history, {});
	const clubs = useQuery(api.clubs.list);
	const updateSettings = useMutation(api.settings.update);

	if (settings === undefined) {
		return <PageNote>Loading…</PageNote>;
	}

	const units = settings.units;
	const rounds = history ?? [];
	const roundsCount = rounds.length;
	const bestScore = rounds
		.filter((r) => r.holeCount === 18 && r.owner.strokes > 0)
		.reduce<number | null>(
			(best, r) =>
				best === null ? r.owner.strokes : Math.min(best, r.owner.strokes),
			null,
		);

	return (
		<Page>
			<PageTitle>Profile</PageTitle>

			<section className="mt-4 grid grid-cols-3 gap-3">
				<StatCard
					compact
					label="Handicap"
					value={
						settings.handicapIndex !== null
							? formatHandicapIndex(settings.handicapIndex)
							: "—"
					}
				/>
				<StatCard compact label="Rounds" value={String(roundsCount)} />
				<StatCard
					compact
					label="Best"
					value={bestScore !== null ? String(bestScore) : "—"}
				/>
			</section>

			<Section title="Handicap index">
				<HandicapEditor
					value={settings.handicapIndex}
					onSave={(handicapIndex) => updateSettings({ handicapIndex })}
				/>
			</Section>

			<Section title="Units">
				<div className="flex gap-2">
					{(["m", "yd"] as const).map((u) => (
						<PillToggle
							key={u}
							selected={units === u}
							onClick={() => updateSettings({ units: u })}
						>
							{u === "m" ? "Meters" : "Yards"}
						</PillToggle>
					))}
				</div>
			</Section>

			<Section title="Home course">
				<div className="flex flex-col gap-2">
					{(courses ?? []).map((c) => (
						<button
							type="button"
							key={c._id}
							onClick={() =>
								updateSettings({
									homeCourseId: settings.homeCourseId === c._id ? null : c._id,
								})
							}
							className={`rounded-xl border px-4 py-2.5 text-left font-display text-[14px] font-semibold ${
								settings.homeCourseId === c._id
									? "border-live bg-live/10 text-ink"
									: `${SURFACE} text-ink`
							}`}
						>
							{c.name}
						</button>
					))}
				</div>
			</Section>

			<Section title="GPS accuracy">
				<p
					className={`rounded-xl border ${SURFACE} px-4 py-3 text-[12.5px] text-moss`}
				>
					On the Play screen your position shows a live dot. When accuracy is
					worse than {GPS_WEAK_ACCURACY_M} m a soft halo appears around it — the
					distance number is always shown.
				</p>
			</Section>

			<Section title="Club bag">
				<ClubBag clubs={clubs ?? []} units={units} />
			</Section>
		</Page>
	);
}

function HandicapEditor({
	value,
	onSave,
}: {
	value: number | null;
	onSave: (v: number | null) => void;
}) {
	const [draft, setDraft] = useState(
		value !== null ? formatHandicapIndex(value) : "",
	);
	const [invalid, setInvalid] = useState(false);

	function save() {
		const parsed = parseHandicapIndex(draft);
		setInvalid(!parsed.valid);
		if (parsed.valid) onSave(parsed.value);
	}

	return (
		<div>
			<div className="flex items-center gap-2">
				<input
					value={draft}
					placeholder="e.g. 18.4"
					inputMode="decimal"
					onChange={(e) => setDraft(e.target.value)}
					className={`${FIELD} w-28 px-3 py-2 text-center text-[15px]`}
				/>
				<button
					type="button"
					onClick={save}
					className="rounded-full bg-pine px-5 py-2 font-display text-[13px] font-semibold text-cream"
				>
					Save
				</button>
			</div>
			{invalid ? (
				<p className="mt-2 text-[13px] font-semibold text-flag">
					{INVALID_INDEX_MESSAGE}
				</p>
			) : null}
		</div>
	);
}

function ClubBag({
	clubs,
	units,
}: {
	clubs: ReadonlyArray<{ _id: Id<"clubs">; name: string; carryMeters: number }>;
	units: Units;
}) {
	const create = useMutation(api.clubs.create);
	const update = useMutation(api.clubs.update);
	const remove = useMutation(api.clubs.remove);
	const reorder = useMutation(api.clubs.reorder);

	const [name, setName] = useState("");
	const [carry, setCarry] = useState("");

	const move = (index: number, dir: -1 | 1) => {
		const next = [...clubs];
		const target = index + dir;
		if (target < 0 || target >= next.length) return;
		[next[index], next[target]] = [next[target], next[index]];
		reorder({ orderedIds: next.map((c) => c._id) });
	};

	return (
		<div>
			<div
				className={`divide-y divide-card-line rounded-2xl border ${SURFACE}`}
			>
				{clubs.map((club, i) => (
					<div key={club._id} className="flex items-center gap-2 px-3 py-2">
						<div className="flex flex-col">
							<button
								type="button"
								aria-label="Move up"
								disabled={i === 0}
								onClick={() => move(i, -1)}
								className="text-moss disabled:opacity-25"
							>
								<ChevronUp className="size-4" />
							</button>
							<button
								type="button"
								aria-label="Move down"
								disabled={i === clubs.length - 1}
								onClick={() => move(i, 1)}
								className="text-moss disabled:opacity-25"
							>
								<ChevronDown className="size-4" />
							</button>
						</div>
						<input
							defaultValue={club.name}
							onBlur={(e) => {
								const v = e.target.value.trim();
								if (v && v !== club.name) update({ clubId: club._id, name: v });
							}}
							className={`${FIELD} w-16 px-2 py-1.5 font-display text-[14px] font-semibold`}
						/>
						<input
							defaultValue={String(club.carryMeters)}
							inputMode="numeric"
							onBlur={(e) => {
								const n = Number.parseInt(e.target.value, 10);
								if (!Number.isNaN(n) && n !== club.carryMeters)
									update({ clubId: club._id, carryMeters: n });
							}}
							className={`${FIELD} w-16 px-2 py-1.5 text-center text-[14px]`}
						/>
						<span className="min-w-[52px] text-[12px] text-moss">
							{formatDistance(club.carryMeters, units)}
						</span>
						<button
							type="button"
							aria-label={`Delete ${club.name}`}
							onClick={() => remove({ clubId: club._id })}
							className="ml-auto text-flag"
						>
							<Trash2 className="size-4" />
						</button>
					</div>
				))}
				{clubs.length === 0 ? (
					<p className="px-4 py-3 text-[12.5px] text-stone">
						No clubs yet — add your bag below.
					</p>
				) : null}
			</div>

			<div className="mt-3 flex items-center gap-2">
				<input
					value={name}
					placeholder="Club (7i)"
					onChange={(e) => setName(e.target.value)}
					className={`${FIELD} w-24 px-3 py-2 text-[14px]`}
				/>
				<input
					value={carry}
					placeholder="Carry m"
					inputMode="numeric"
					onChange={(e) => setCarry(e.target.value)}
					className={`${FIELD} w-24 px-3 py-2 text-center text-[14px]`}
				/>
				<button
					type="button"
					disabled={
						name.trim() === "" || Number.isNaN(Number.parseInt(carry, 10))
					}
					onClick={() => {
						create({
							name: name.trim(),
							carryMeters: Number.parseInt(carry, 10),
						});
						setName("");
						setCarry("");
					}}
					className="flex items-center gap-1 rounded-full bg-flag px-4 py-2 font-display text-[13px] font-semibold text-white disabled:opacity-40"
				>
					<Plus className="size-4" /> Add
				</button>
			</div>
		</div>
	);
}
