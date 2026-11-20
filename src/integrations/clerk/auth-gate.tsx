import { Show, SignIn, useAuth } from "@clerk/react";
import { useConvexAuth } from "convex/react";

/** Navigation follows Clerk (signed out → sign-in card); protected data
 *  follows Convex (children mount only once Convex has the token). While
 *  Clerk loads (server render, first paint, the reload after sign-out or
 *  account deletion) neither `Show` renders, so a themed placeholder fills
 *  the gap instead of an empty page. */
export function AuthGate({ children }: { children: React.ReactNode }) {
	const { isLoaded } = useAuth();
	if (!isLoaded) return <Connecting />;
	return (
		<>
			<Show when="signed-out">
				<div className="flex min-h-dvh items-center justify-center p-4">
					<SignIn routing="hash" />
				</div>
			</Show>
			<Show when="signed-in">
				<ConvexReady>{children}</ConvexReady>
			</Show>
		</>
	);
}

function ConvexReady({ children }: { children: React.ReactNode }) {
	const { isAuthenticated } = useConvexAuth();
	if (!isAuthenticated) return <Connecting />;
	return children;
}

function Connecting() {
	return (
		<div
			role="status"
			className="flex min-h-dvh items-center justify-center bg-canvas text-sm text-stone"
		>
			Connecting…
		</div>
	);
}
