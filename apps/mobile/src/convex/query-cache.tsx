/**
 * The app query module (`retention` flavor of the Convex query caching
 * standard). Screens import query hooks from here, never from `convex/react`.
 */

import { usePaginatedQuery } from "convex/react";
import {
	ConvexQueryCacheProvider,
	useQueries,
	useQuery,
} from "convex-helpers/react/cache";
import { type ReactNode, useEffect, useState } from "react";
import { AppState } from "react-native";

// Paginated queries pass through: the helper's page ids change on every
// mount, so retaining them never produces a hit.
export { usePaginatedQuery, useQueries, useQuery };

const EXPIRATION_MS = 5 * 60_000;
const MAX_IDLE_ENTRIES = 20;

/** Retain recently left subscriptions within one account; release idle ones in background. */
export function AppQueryCacheProvider({
	scope,
	children,
}: {
	scope: string;
	children: ReactNode;
}) {
	const [foreground, setForeground] = useState(
		() => AppState.currentState === "active",
	);
	useEffect(() => {
		const listener = AppState.addEventListener("change", (state) =>
			setForeground(state === "active"),
		);
		return () => listener.remove();
	}, []);
	return (
		<ConvexQueryCacheProvider
			key={scope}
			expiration={foreground ? EXPIRATION_MS : 0}
			maxIdleEntries={foreground ? MAX_IDLE_ENTRIES : 0}
		>
			{children}
		</ConvexQueryCacheProvider>
	);
}
