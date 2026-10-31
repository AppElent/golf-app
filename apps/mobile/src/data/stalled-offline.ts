/**
 * "This is not going to arrive", as distinct from "this has not arrived yet".
 *
 * Convex's socket is disconnected for the first moments of every cold start,
 * while the day's query is also still loading. Reading those two conditions
 * together with no patience would flash "you are offline" at someone who is
 * merely starting the app on a good connection — which is worse than the
 * infinite skeleton it was meant to replace, because it is a claim rather than
 * an absence.
 *
 * So the offline notice waits. The skeleton shows first, and only if the query
 * is *still* loading and the socket is *still* down after the grace period
 * does the screen change its story. Reconnecting at any point cancels it.
 */
import { useEffect, useState } from "react";

/**
 * Long enough to cover a normal handshake, short enough that someone genuinely
 * offline is not left watching placeholder boxes.
 */
export const OFFLINE_GRACE_MS = 2000;

export function useStalledOffline(
	loading: boolean,
	connected: boolean,
	graceMs: number = OFFLINE_GRACE_MS,
): boolean {
	const [stalled, setStalled] = useState(false);

	useEffect(() => {
		if (!loading || connected) {
			setStalled(false);
			return;
		}
		const timer = setTimeout(() => setStalled(true), graceMs);
		return () => clearTimeout(timer);
	}, [loading, connected, graceMs]);

	return stalled;
}
