import { Link } from "@tanstack/react-router";
import { CircleUserRound, LandPlot } from "lucide-react";

// The web authors courses; rounds are in the phone app (ADR 0001, APP-235).
const tabs = [
	{ to: "/courses", label: "Courses", icon: LandPlot },
	{ to: "/profile", label: "Account", icon: CircleUserRound },
] as const;

/** `wide`: the bar spans the window (large-screen pages); the tabs stay 430px. */
export default function BottomNav({ wide = false }: { wide?: boolean }) {
	return (
		<nav
			className={`fixed inset-x-0 bottom-0 z-30 mx-auto min-h-[86px] w-full border-t border-card-line bg-bar px-2 pt-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-md ${wide ? "" : "max-w-[430px]"}`}
		>
			<div className="mx-auto flex w-full max-w-[430px] items-start">
				{tabs.map(({ to, label, icon: Icon }) => (
					<Link
						key={to}
						to={to}
						className="flex flex-1 flex-col items-center gap-1"
						activeProps={{ className: "text-pine-ink" }}
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
