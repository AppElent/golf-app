import { useAuth } from "@clerk/react";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { env } from "#/env";
import { instrumentConvexClient } from "#/lib/observability/convex";

const convexQueryClient = new ConvexQueryClient(env.VITE_CONVEX_URL);
instrumentConvexClient(convexQueryClient.convexClient);

export default function AppConvexProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ConvexProviderWithClerk
			client={convexQueryClient.convexClient}
			useAuth={useAuth}
		>
			{children}
		</ConvexProviderWithClerk>
	);
}
