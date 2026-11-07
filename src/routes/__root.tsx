import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import BottomNav from "../components/BottomNav";
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
			{ name: "theme-color", content: "#0F3D2A" },
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
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<ClerkProvider>
					<ConvexProvider>
						<div className="relative mx-auto min-h-dvh w-full max-w-[430px] bg-cream shadow-2xl">
							<AuthGate>{children}</AuthGate>
						</div>
						<BottomNav />
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
