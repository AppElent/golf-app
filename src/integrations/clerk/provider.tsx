import { ClerkProvider } from "@clerk/react";
import { env } from "../../env";
import { SentryUser } from "../../lib/observability/user";
import { DARK_APPEARANCE, usePrefersDark } from "./appearance";

export default function AppClerkProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const dark = usePrefersDark();
	return (
		<ClerkProvider
			publishableKey={env.VITE_CLERK_PUBLISHABLE_KEY}
			afterSignOutUrl="/"
			appearance={dark ? DARK_APPEARANCE : undefined}
		>
			<SentryUser />
			{children}
		</ClerkProvider>
	);
}
