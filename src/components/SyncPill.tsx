/** Compact status pill for the scorecard: offline / syncing / hidden. */
export function SyncPill({
	online,
	pendingCount,
	syncing,
}: {
	online: boolean;
	pendingCount: number;
	syncing: boolean;
}) {
	if (online && pendingCount === 0) return null;
	const label = !online
		? `Offline · ${pendingCount} queued`
		: syncing
			? `Syncing ${pendingCount}…`
			: `${pendingCount} to sync`;
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-display text-[11px] font-semibold ${
				online ? "bg-live/15 text-live" : "bg-flag/15 text-flag"
			}`}
		>
			<span
				className={`size-1.5 rounded-full ${online ? "bg-live" : "bg-flag"}`}
			/>
			{label}
		</span>
	);
}
