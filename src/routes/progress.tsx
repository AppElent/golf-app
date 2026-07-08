import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/progress")({
	component: ProgressScreen,
});

function ProgressScreen() {
	return (
		<main className="px-5 pt-16 pb-[110px]">
			<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
				Progress
			</h1>
			<p className="mt-1 text-[13px] text-moss">
				Handicap trend and stats arrive once rounds are stored.
			</p>
		</main>
	);
}
