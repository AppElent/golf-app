import { SURFACE } from "./classes";

/**
 * Pages anyone can open without signing in: App Store Connect and the phone
 * app link to them, so the root layout skips the sign-in gate and tab bar.
 */
export const PUBLIC_PATHS = ["/privacy", "/support"] as const;

export function isPublicPath(pathname: string): boolean {
	const path = pathname.replace(/\/+$/, "") || "/";
	return (PUBLIC_PATHS as readonly string[]).includes(path);
}

export interface LegalSection {
	heading: string;
	paragraphs: readonly string[];
}

/** A plain text page (privacy policy, support) in the app's card style. */
export function LegalPage({
	title,
	updated,
	intro,
	sections,
}: {
	title: string;
	updated?: string;
	intro: string;
	sections: readonly LegalSection[];
}) {
	return (
		<main className="px-5 pt-16 pb-16">
			<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
				{title}
			</h1>
			{updated ? (
				<p className="mt-1 text-[13px] text-stone">{updated}</p>
			) : null}
			<div className={`mt-5 rounded-[22px] border ${SURFACE} p-5`}>
				<p className="text-[15px] leading-7 text-moss">{intro}</p>
				{sections.map((section) => (
					<section key={section.heading} className="mt-6">
						<h2 className="font-display text-base font-semibold text-ink">
							{section.heading}
						</h2>
						{section.paragraphs.map((text) => (
							<p key={text} className="mt-2 text-[15px] leading-7 text-moss">
								{text}
							</p>
						))}
					</section>
				))}
			</div>
		</main>
	);
}
