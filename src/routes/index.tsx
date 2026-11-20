import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, CircleUserRound, LandPlot } from "lucide-react";
import { APP_STORE_URL, TESTFLIGHT_URL } from "../components/app-links";
import { CONTROL, CTA, SURFACE } from "../components/classes";

export const Route = createFileRoute("/")({ component: OpenTheApp });

/**
 * "Open the Fairway app" (features.ts `open-the-app`). The phone plays and
 * reviews rounds; the web only authors courses (ADR 0001). Public, like
 * /privacy: it reads no user data, and the retired round paths land here.
 */
function OpenTheApp() {
	return (
		<main className="px-5 pt-16 pb-16">
			<p className="font-display text-label font-semibold tracking-[0.14em] text-moss uppercase">
				Fairway
			</p>
			<h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">
				Open the Fairway app
			</h1>
			<p className="mt-2 text-body leading-7 text-moss">
				Rounds, scores, GPS distances, stats, your handicap and your clubs live
				in the Fairway app on your phone. The website is for editing courses.
			</p>

			<a href={APP_STORE_URL} className={`${CTA} mt-6 block text-center`}>
				Get Fairway on the App Store
			</a>
			<p className="mt-3 text-center text-label text-moss">
				Trying the preview?{" "}
				<a href={TESTFLIGHT_URL} className="font-semibold underline">
					Join the TestFlight beta
				</a>
			</p>

			<nav
				aria-label="On the website"
				className={`mt-8 divide-y divide-card-line rounded-2xl border ${SURFACE}`}
			>
				<WebLink to="/courses" icon={LandPlot} title="Edit courses">
					Make your own copy of a course and fix its tees and holes.
				</WebLink>
				<WebLink to="/profile" icon={CircleUserRound} title="Account">
					Export your data, sign out or delete your account.
				</WebLink>
			</nav>
		</main>
	);
}

function WebLink({
	to,
	icon: Icon,
	title,
	children,
}: {
	to: "/courses" | "/profile";
	icon: typeof LandPlot;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<Link to={to} className="flex items-center gap-3 px-4 py-3.5">
			<span
				className={`flex size-10 shrink-0 items-center justify-center rounded-full border ${CONTROL} text-pine-ink`}
			>
				<Icon aria-hidden className="size-5" />
			</span>
			<span className="min-w-0 flex-1">
				<span className="block font-display text-callout font-semibold text-ink">
					{title}
				</span>
				<span className="block text-footnote text-moss">{children}</span>
			</span>
			<ChevronRight aria-hidden className="size-4 shrink-0 text-moss" />
		</Link>
	);
}
