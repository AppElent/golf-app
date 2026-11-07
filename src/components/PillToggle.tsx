import { SURFACE } from "./classes";

const SELECTED = {
	pine: "border-pine bg-pine text-cream",
	live: "border-live bg-live text-white",
};

export function PillToggle({
	selected,
	tone = "pine",
	onClick,
	children,
}: {
	selected: boolean;
	tone?: keyof typeof SELECTED;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`rounded-full border px-4 py-2 font-display text-[13px] font-semibold ${
				selected ? SELECTED[tone] : `${SURFACE} text-ink`
			}`}
		>
			{children}
		</button>
	);
}
