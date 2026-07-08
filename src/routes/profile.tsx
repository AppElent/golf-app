import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profile")({ component: ProfileScreen });

function ProfileScreen() {
	return (
		<main className="px-5 pt-16 pb-[110px]">
			<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
				Profile
			</h1>
			<p className="mt-1 text-[13px] text-moss">
				Settings and club bag management arrive in a later plan.
			</p>
		</main>
	);
}
