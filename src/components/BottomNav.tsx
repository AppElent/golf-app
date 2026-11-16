import { Link } from "@tanstack/react-router";
import {
	ChartLine,
	CircleUserRound,
	ClipboardList,
	House,
	LandPlot,
} from "lucide-react";

const tabs = [
	{ to: "/", label: "Home", icon: House },
	{ to: "/play", label: "Play", icon: LandPlot },
	{ to: "/card", label: "Card", icon: ClipboardList },
	{ to: "/progress", label: "Progress", icon: ChartLine },
	{ to: "/profile", label: "Profile", icon: CircleUserRound },
] as const;

/** `wide`: the bar spans the window (large-screen pages); the tabs stay 430px. */
export default function BottomNav({ wide = false }: { wide?: boolean }) {
	return (
		<nav
			className={`fixed inset-x-0 bottom-0 z-30 mx-auto min-h-[86px] w-full border-t border-card-line bg-white/90 px-2 pt-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-md ${wide ? "" : "max-w-[430px]"}`}
		>
			<div className="mx-auto flex w-full max-w-[430px] items-start">
				{tabs.map(({ to, label, icon: Icon }) => (
					<Link
						key={to}
						to={to}
						activeOptions={{ exact: to === "/" }}
						className="flex flex-1 flex-col items-center gap-1"
						activeProps={{ className: "text-pine" }}
						inactiveProps={{ className: "text-stone" }}
					>
						<Icon size={23} strokeWidth={1.9} />
						<span className="text-caption font-semibold">{label}</span>
					</Link>
				))}
			</div>
		</nav>
	);
}
