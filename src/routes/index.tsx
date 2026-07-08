import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: HomeScreen });

function HomeScreen() {
	return (
		<main className="px-5 pt-16 pb-[110px]">
			<div className="mb-6 flex items-center justify-between">
				<div>
					<p className="text-[13px] font-medium text-moss">Welcome to</p>
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

			<section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-pine-light to-pine p-6 text-[#eaf2e9] shadow-[0_18px_40px_-22px_rgba(15,61,42,0.9)]">
				<div className="pointer-events-none absolute -top-8 -right-8 h-36 w-36 rounded-full bg-live/15" />
				<p className="text-[12.5px] font-semibold tracking-[0.14em] uppercase opacity-70">
					Handicap Index
				</p>
				<p className="mt-1 font-display text-[56px] leading-none font-bold tracking-tight">
					—
				</p>
				<p className="mt-2 text-[12.5px] opacity-65">
					Play your first round to start the trend
				</p>
			</section>

			<Link
				to="/play"
				className="mt-4 flex items-center justify-between rounded-[22px] bg-flag px-6 py-4 shadow-[0_14px_30px_-16px_rgba(224,83,47,0.9)]"
			>
				<span>
					<span className="block font-display text-lg font-bold text-white">
						Start a round
					</span>
					<span className="block text-[13px] text-white/80">
						Course setup coming soon
					</span>
				</span>
				<span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/18 text-white">
					→
				</span>
			</Link>
		</main>
	);
}
