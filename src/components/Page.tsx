export function Page({ children }: { children: React.ReactNode }) {
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
			<p className="text-[13px] text-stone">{children}</p>
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
			{hint ? <p className="mt-0.5 text-[12px] text-stone">{hint}</p> : null}
			<div className="mt-3">{children}</div>
		</section>
	);
}
