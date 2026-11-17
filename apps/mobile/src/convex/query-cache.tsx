/**
 * The app query module: the `last-known` flavor of the Convex query caching
 * standard (`docs/standards/convex-query-caching.md`). Screens import query
 * hooks from here, never from `convex/react`.
 *
 * **Layer 1, retention.** After the last screen reading a query unmounts, its
 * subscription stays open for `EXPIRATION_MS`, at most `MAX_IDLE_ENTRIES` of
 * them; backgrounding releases them. The provider is keyed by account.
 *
 * **Layer 2, last-known copy.** For the functions in `PERSISTED`, `useQuery`
 * also keeps a disposable copy on disk (`last-known.ts`) and shows it while
 * Convex is authenticated and connected, until the live answer replaces it.
 * Reads that seed a form or decide a write use `useLiveQuery`, which never
 * reads disk.
 *
 * **Offline-readable copy.** `OFFLINE_READABLE` names the modules whose copy
 * the session gate's offline fallback may draw, without Convex, for the
 * account Convex last confirmed on this phone: the active round on the course
 * (`features/play/offline`, APP-146). Display only.
 *
 * Values and allowlists are recorded in `CODING_STANDARDS.md`.
 */

import {
	type OptionalRestArgsOrSkip,
	useConvexAuth,
	useConvexConnectionState,
	useQueries as useConvexQueries,
} from "convex/react";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { getFunctionName } from "convex/server";
import type { Value } from "convex/values";
import {
	ConvexQueryCacheProvider,
	useQuery as useRetainedQuery,
} from "convex-helpers/react/cache";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useState,
} from "react";
import { AppState } from "react-native";
import { api } from "./api";
import {
	confirmAccount,
	diskScope,
	entryKey,
	readEntry,
	writeEntryOnce,
} from "./last-known";
import { PERSISTED } from "./persisted";

const EXPIRATION_MS = 5 * 60_000;
const MAX_IDLE_ENTRIES = 20;

/** The disk scope of the confirmed account while the socket is connected. */
const DiskScopeContext = createContext<string | undefined>(undefined);

function cacheKey(
	scope: string | undefined,
	query: FunctionReference<"query">,
	args: unknown,
) {
	if (!scope || args === "skip") return undefined;
	try {
		const name = getFunctionName(query);
		if (!PERSISTED.has(name)) return undefined;
		return entryKey(scope, name, args as Value);
	} catch {
		return undefined;
	}
}

/** Live-only: retained subscriptions, never disk values. For forms, and for
 *  state that must be current before a write. */
export function useLiveQuery<Q extends FunctionReference<"query">>(
	query: Q,
	...args: OptionalRestArgsOrSkip<Q>
) {
	return useRetainedQuery(query, ...args) as FunctionReturnType<Q> | undefined;
}

/** Display reads: the live value, or the last-known copy until it arrives. */
export function useQuery<Q extends FunctionReference<"query">>(
	query: Q,
	...args: OptionalRestArgsOrSkip<Q>
) {
	const live = useLiveQuery(query, ...args);
	const { isAuthenticated } = useConvexAuth();
	const scope = useContext(DiskScopeContext);
	const key = cacheKey(
		isAuthenticated ? scope : undefined,
		query,
		args[0] ?? {},
	);
	const cached = useMemo(() => (key ? readEntry(key) : undefined), [key]);
	useEffect(() => {
		if (key && live !== undefined) writeEntryOnce(key, live as Value);
	}, [key, live]);
	return (live === undefined ? cached : live) as
		| FunctionReturnType<Q>
		| undefined;
}

/** The disk scope, only while the socket is connected. Only this component
 *  re-renders on connection changes; readers see a string flip. */
function DiskScope({
	account,
	children,
}: {
	account: string | undefined;
	children: ReactNode;
}) {
	const { isWebSocketConnected } = useConvexConnectionState();
	return (
		<DiskScopeContext.Provider
			value={isWebSocketConnected && account ? diskScope(account) : undefined}
		>
			{children}
		</DiskScopeContext.Provider>
	);
}

/**
 * Mount below the session gate, keyed by nothing: it keys the retention
 * subtree by `account` itself. Until the live backend names the same account
 * Clerk selected, it draws `fallback` and no protected query runs.
 */
export function AppQueryCacheProvider({
	account,
	fallback,
	children,
}: {
	account: string;
	fallback: ReactNode;
	children: ReactNode;
}) {
	const { isAuthenticated } = useConvexAuth();
	// The live backend identity, never a cached or local one.
	// Read as a batch so an error (a backend without `account.viewer`) comes
	// back as a value instead of throwing: the app then runs as before, with
	// retention only and no disk copy, rather than failing at launch.
	const viewer = useConvexQueries(
		isAuthenticated ? { viewer: { query: api.account.viewer, args: {} } } : {},
	).viewer;
	const viewerFailed = viewer instanceof Error;
	const confirmed = isAuthenticated && !viewerFailed && viewer === account;
	const ready = confirmed || (isAuthenticated && viewerFailed);
	const [foreground, setForeground] = useState(
		() => AppState.currentState === "active",
	);
	useEffect(() => {
		const listener = AppState.addEventListener("change", (state) =>
			setForeground(state === "active"),
		);
		return () => listener.remove();
	}, []);
	// Before any child's effect can write: remember the confirmed account for
	// the offline fallback, and drop every other account's or bundle's copy.
	useLayoutEffect(() => {
		if (confirmed) confirmAccount(account);
	}, [confirmed, account]);
	if (!ready) return fallback;
	return (
		<DiskScope account={confirmed ? account : undefined}>
			<ConvexQueryCacheProvider
				key={account}
				expiration={foreground ? EXPIRATION_MS : 0}
				maxIdleEntries={foreground ? MAX_IDLE_ENTRIES : 0}
			>
				{children}
			</ConvexQueryCacheProvider>
		</DiskScope>
	);
}
