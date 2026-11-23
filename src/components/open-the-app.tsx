import { Link } from "@tanstack/react-router";
import { ChevronRight, CircleUserRound, LandPlot } from "lucide-react";
import { APP_STORE_URL, TESTFLIGHT_URL } from "./app-links";
import { CONTROL, CTA, SURFACE } from "./classes";

/**
 * "Open the Fairway app" (features.ts `open-the-app`), the web's public `/`.
 * The phone plays and reviews rounds; the web only authors courses (ADR 0001).
 * It reads no user data, and the retired round paths land here.
 *
 * `storeLive` is `APP_STORE_LIVE`: before the first App Store release the
 * TestFlight beta is the way in, so it leads and the store button is hidden.
 */
export function OpenTheApp({ storeLive }: { storeLive: boolean }) {
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

			{storeLive ? (
				<>
					<a href={APP_STORE_URL} className={`${CTA} mt-6 block text-center`}>
						Get Fairway on the App Store
					</a>
					<p className="mt-3 text-center text-label text-moss">
						Trying the preview?{" "}
						<a href={TESTFLIGHT_URL} className="font-semibold underline">
							Join the TestFlight beta
						</a>
					</p>
				</>
			) : (
				<>
					<a href={TESTFLIGHT_URL} className={`${CTA} mt-6 block text-center`}>
						Join the Fairway beta on TestFlight
					</a>
					<p className="mt-3 text-center text-label text-moss">
						Fairway is in beta on iPhone. Install TestFlight from the App Store,
						then open this link on your phone.
					</p>
				</>
			)}

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
