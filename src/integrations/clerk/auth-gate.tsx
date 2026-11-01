import { Show, SignIn } from "@clerk/react";
import { useConvexAuth } from "convex/react";

/** Navigation follows Clerk (signed out → sign-in card); protected data
 *  follows Convex (children mount only once Convex has the token). */
export function AuthGate({ children }: { children: React.ReactNode }) {
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
	if (!isAuthenticated) {
		return (
			<div className="flex min-h-dvh items-center justify-center text-sm text-muted">
				Connecting…
			</div>
		);
	}
	return children;
}
