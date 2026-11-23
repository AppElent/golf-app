import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRoute,
	HeadContent,
	Scripts,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import BottomNav from "../components/BottomNav";
import { isPublicPath } from "../components/LegalPage";
import { useLargeScreenRoute } from "../components/large-screen";
import { ServiceWorker } from "../components/ServiceWorker";
import { AuthGate } from "../integrations/clerk/auth-gate";
import ClerkProvider from "../integrations/clerk/provider";
import ConvexProvider from "../integrations/convex/provider";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover",
			},
			{
				name: "theme-color",
				content: "#0F3D2A",
				media: "(prefers-color-scheme: light)",
			},
			// The dark app column's canvas (styles.css --color-canvas).
			{
				name: "theme-color",
				content: "#08130d",
				media: "(prefers-color-scheme: dark)",
			},
			{ title: "Fairway · Golf Companion" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "manifest", href: "/manifest.json" },
			{ rel: "apple-touch-icon", href: "/logo192.png" },
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const isPublic = useRouterState({
		select: (state) => isPublicPath(state.location.pathname),
	});
	// Large-screen features (features.ts) use the window's width; every other
	// page stays in the 430px phone column.
	const largeScreen = useLargeScreenRoute();
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<ClerkProvider>
					<ConvexProvider>
						<div
							className={
								largeScreen
									? "relative min-h-dvh w-full bg-canvas"
									: "relative mx-auto min-h-dvh w-full max-w-[430px] bg-canvas shadow-2xl"
							}
						>
							{isPublic ? children : <AuthGate>{children}</AuthGate>}
						</div>
						{isPublic ? null : <BottomNav wide={largeScreen} />}
						<ServiceWorker />
						<TanStackDevtools
							config={{ position: "bottom-right" }}
							plugins={[
								{
									name: "Tanstack Router",
									render: <TanStackRouterDevtoolsPanel />,
								},
							]}
						/>
					</ConvexProvider>
				</ClerkProvider>
				<Scripts />
			</body>
		</html>
	);
}
