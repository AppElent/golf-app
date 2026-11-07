import { useAuth } from "@clerk/react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { env } from "../../env";
import { instrumentConvexClient } from "../../lib/observability/convex";

const convexClient = instrumentConvexClient(
	new ConvexReactClient(env.VITE_CONVEX_URL),
);

export default function AppConvexProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
			{children}
		</ConvexProviderWithClerk>
	);
}
