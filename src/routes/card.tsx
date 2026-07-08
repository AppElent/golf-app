import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/card")({ component: CardScreen });

function CardScreen() {
	return (
		<main className="px-5 pt-16 pb-[110px]">
			<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
				Scorecard
			</h1>
			<p className="mt-1 text-[13px] text-moss">
				Hole-by-hole scoring arrives with the rounds plan.
			</p>
		</main>
	);
}
