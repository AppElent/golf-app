import { SURFACE } from "./classes";

export function StatCard({
	label,
	value,
	compact,
}: {
	label: string;
	value: string;
	compact?: boolean;
}) {
	return (
		<div
			className={`rounded-2xl border ${SURFACE} py-3 ${compact ? "px-3 text-center" : "px-4"}`}
		>
			<p
				className={`${compact ? "text-[10px]" : "text-[11px]"} font-semibold uppercase tracking-wide text-stone`}
			>
				{label}
			</p>
			<p
				className={`mt-1 font-display ${compact ? "text-xl" : "text-2xl"} font-bold text-ink`}
			>
				{value}
			</p>
		</div>
	);
}
