import { CONTROL } from "./classes";

const SELECTED = {
	pine: "border-pine-fill bg-pine-fill text-cream",
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
			className={`rounded-full border px-4 py-2 font-display text-label font-semibold ${
				selected ? SELECTED[tone] : `${CONTROL} text-ink`
			}`}
		>
			{children}
		</button>
	);
}
