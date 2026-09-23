import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const Route = createFileRoute("/courses/$courseId/edit")({
	component: CourseEditor,
});

function CourseEditor() {
	const { courseId } = Route.useParams();
	const data = useQuery(api.courses.get, {
		courseId: courseId as Id<"courses">,
	});
	const updateMeta = useMutation(api.courses.updateMeta);
	const upsertTee = useMutation(api.courses.upsertTee);
	const upsertHole = useMutation(api.courses.upsertHole);

	if (data === undefined) {
		return (
			<main className="px-5 pt-16 pb-[110px]">
				<p className="text-[13px] text-stone">Loading…</p>
			</main>
		);
	}
	if (data === null) {
		return (
			<main className="px-5 pt-16 pb-[110px]">
				<p className="text-[13px] text-stone">Course not found.</p>
			</main>
		);
	}

	const { course, tees, holes, geometry } = data;
	const refsWithGeometry = new Set(geometry.map((g) => g.ref));
	const tee = tees[0];

	return (
		<main className="px-5 pt-16 pb-[110px]">
			<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
				Edit course
			</h1>
			<p className="mt-1 text-[13px] text-moss">
				{course.importStatus === "partial"
					? "Imported from OSM — fill in the missing par and stroke index below."
					: "Course details."}
			</p>

			<MetaSection
				name={course.name}
				city={course.city ?? ""}
				onSave={(name, city) =>
					updateMeta({ courseId: course._id, name, city })
				}
			/>

			<TeeSection
				tee={tee}
				onSave={(name, courseRating, slopeRating) =>
					upsertTee({
						teeId: tee?._id,
						courseId: course._id,
						name,
						courseRating,
						slopeRating,
					})
				}
			/>

			<section className="mt-8">
				<h2 className="font-display text-sm font-semibold uppercase tracking-wide text-moss">
					Holes
				</h2>
				<ul className="mt-3 flex flex-col gap-2">
					{holes.map((hole) => (
						<HoleRow
							key={hole._id}
							number={hole.number}
							refLabel={hole.ref}
							par={hole.par}
							strokeIndex={hole.strokeIndex}
							hasGeometry={
								hole.ref !== undefined && refsWithGeometry.has(hole.ref)
							}
							onSave={(par, strokeIndex) =>
								upsertHole({ holeId: hole._id, par, strokeIndex })
							}
						/>
					))}
				</ul>
			</section>
		</main>
	);
}

function MetaSection({
	name,
	city,
	onSave,
}: {
	name: string;
	city: string;
	onSave: (name: string, city: string) => void;
}) {
	const [n, setN] = useState(name);
	const [c, setC] = useState(city);
	return (
		<section className="mt-6 rounded-2xl border border-card-line bg-white/60 p-4">
			<label className="block text-[11px] font-semibold uppercase tracking-wide text-moss">
				Name
				<input
					value={n}
					onChange={(e) => setN(e.target.value)}
					className="mt-1 w-full rounded-lg border border-card-line bg-cream px-3 py-2 font-sans text-[15px] text-ink"
				/>
			</label>
			<label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-moss">
				City
				<input
					value={c}
					onChange={(e) => setC(e.target.value)}
					className="mt-1 w-full rounded-lg border border-card-line bg-cream px-3 py-2 font-sans text-[15px] text-ink"
				/>
			</label>
			<button
				type="button"
				onClick={() => onSave(n, c)}
				className="mt-4 rounded-full bg-pine px-5 py-2 font-display text-[13px] font-semibold text-cream"
			>
				Save details
			</button>
		</section>
	);
}

function TeeSection({
	tee,
	onSave,
}: {
	tee: { name: string; courseRating: number; slopeRating: number } | undefined;
	onSave: (name: string, courseRating: number, slopeRating: number) => void;
}) {
	const [name, setName] = useState(tee?.name ?? "White");
	const [cr, setCr] = useState(String(tee?.courseRating ?? 72));
	const [slope, setSlope] = useState(String(tee?.slopeRating ?? 113));
	return (
		<section className="mt-4 rounded-2xl border border-card-line bg-white/60 p-4">
			<h2 className="font-display text-sm font-semibold uppercase tracking-wide text-moss">
				Tee
			</h2>
			<div className="mt-3 grid grid-cols-3 gap-3">
				<Field label="Name" value={name} onChange={setName} />
				<Field label="CR" value={cr} onChange={setCr} inputMode="decimal" />
				<Field
					label="Slope"
					value={slope}
					onChange={setSlope}
					inputMode="numeric"
				/>
			</div>
			<button
				type="button"
				onClick={() => onSave(name, Number(cr), Number(slope))}
				className="mt-4 rounded-full bg-pine px-5 py-2 font-display text-[13px] font-semibold text-cream"
			>
				Save tee
			</button>
		</section>
	);
}

function Field({
	label,
	value,
	onChange,
	inputMode,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	inputMode?: "numeric" | "decimal";
}) {
	return (
		<label className="block text-[11px] font-semibold uppercase tracking-wide text-moss">
			{label}
			<input
				value={value}
				inputMode={inputMode}
				onChange={(e) => onChange(e.target.value)}
				className="mt-1 w-full rounded-lg border border-card-line bg-cream px-3 py-2 font-sans text-[15px] text-ink"
			/>
		</label>
	);
}

function HoleRow({
	number,
	refLabel,
	par,
	strokeIndex,
	hasGeometry,
	onSave,
}: {
	number: number;
	refLabel?: string;
	par?: number;
	strokeIndex?: number;
	hasGeometry: boolean;
	onSave: (par: number | undefined, strokeIndex: number | undefined) => void;
}) {
	const [p, setP] = useState(par?.toString() ?? "");
	const [si, setSi] = useState(strokeIndex?.toString() ?? "");
	// Keep local inputs in sync if the server value changes under us.
	useEffect(() => setP(par?.toString() ?? ""), [par]);
	useEffect(() => setSi(strokeIndex?.toString() ?? ""), [strokeIndex]);

	const dirty =
		p !== (par?.toString() ?? "") || si !== (strokeIndex?.toString() ?? "");

	return (
		<li className="flex items-center gap-3 rounded-xl border border-card-line bg-white/60 px-3 py-2">
			<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pine font-display text-[13px] font-semibold text-cream">
				{refLabel || number}
			</span>
			<label className="text-[11px] font-semibold uppercase tracking-wide text-moss">
				Par
				<input
					value={p}
					inputMode="numeric"
					onChange={(e) => setP(e.target.value)}
					className="mt-0.5 w-14 rounded-lg border border-card-line bg-cream px-2 py-1.5 font-sans text-[15px] text-ink"
				/>
			</label>
			<label className="text-[11px] font-semibold uppercase tracking-wide text-moss">
				SI
				<input
					value={si}
					inputMode="numeric"
					onChange={(e) => setSi(e.target.value)}
					className="mt-0.5 w-14 rounded-lg border border-card-line bg-cream px-2 py-1.5 font-sans text-[15px] text-ink"
				/>
			</label>
			{!hasGeometry ? (
				<span className="ml-auto rounded-full bg-flag/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-flag">
					No map
				</span>
			) : null}
			<button
				type="button"
				disabled={!dirty}
				onClick={() =>
					onSave(
						p === "" ? undefined : Number(p),
						si === "" ? undefined : Number(si),
					)
				}
				className="ml-auto rounded-full bg-live px-3 py-1.5 font-display text-[12px] font-semibold text-white disabled:opacity-40"
			>
				Save
			</button>
		</li>
	);
}
