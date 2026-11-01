import { ClerkProvider } from "@clerk/react";
import { env } from "#/env";
import { SentryUser } from "#/lib/observability/user";

export default function AppClerkProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ClerkProvider
			publishableKey={env.VITE_CLERK_PUBLISHABLE_KEY}
			afterSignOutUrl="/"
		>
			<SentryUser />
			{children}
		</ClerkProvider>
	);
}
