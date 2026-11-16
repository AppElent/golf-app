import { LargeScreenNotice, useLargeScreenRoute } from "./large-screen";

/** A page's frame. On a large-screen route it widens and, at phone width,
 *  starts with the "best on a larger screen" notice. */
export function Page({ children }: { children: React.ReactNode }) {
	const largeScreen = useLargeScreenRoute();
	if (largeScreen) {
		return (
			<main className="mx-auto w-full max-w-6xl px-5 pt-16 pb-[110px] md:px-10">
				<LargeScreenNotice />
				{children}
			</main>
		);
	}
	return <main className="px-5 pt-16 pb-[110px]">{children}</main>;
}

export function PageTitle({ children }: { children: React.ReactNode }) {
	return (
		<h1 className="font-display text-2xl font-bold tracking-tight text-ink">
			{children}
		</h1>
	);
}

/** A whole page holding one line of status, such as loading or not found. */
export function PageNote({ children }: { children: React.ReactNode }) {
	return (
		<Page>
			<p className="text-label text-stone">{children}</p>
		</Page>
	);
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
	return (
		<h2 className="font-display text-sm font-semibold uppercase tracking-wide text-moss">
			{children}
		</h2>
	);
}

export function Section({
	title,
	hint,
	children,
}: {
	title: string;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<section className="mt-6">
			<SectionTitle>{title}</SectionTitle>
			{hint ? <p className="mt-0.5 text-footnote text-stone">{hint}</p> : null}
			<div className="mt-3">{children}</div>
		</section>
	);
}
