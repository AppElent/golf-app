import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/play")({ component: PlayScreen });

function PlayScreen() {
	return (
		<main className="min-h-dvh bg-pine px-5 pt-16 pb-[110px] text-[#eaf2e9]">
			<p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
				Play
			</p>
			<h1 className="mt-1 font-display text-[22px] font-bold">GPS caddie</h1>
			<div className="mt-6 rounded-[22px] bg-white/7 p-6 text-sm text-mint-soft">
				The hole map, distances and club suggestions arrive with the Play plan.
				Until then this screen is a placeholder.
			</div>
		</main>
	);
}
