/**
 * Keeps the offline copy of the active round complete from any screen
 * (APP-146): the real active round, its course with geometry, and the units
 * and clubs the play screen draws with. The display reads write the
 * last-known copy as their live answers arrive (`convex/query-cache.tsx`), so
 * a round finished elsewhere replaces the copy with "no round".
 *
 * Mounted once inside the signed-in shell. These subscriptions are the ones
 * Home and the play screen already hold, so they add nothing on the wire.
 */
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";

export function KeepOfflineRound() {
	const active = useQuery(api.rounds.active);
	useQuery(
		api.courses.get,
		active ? { courseId: active.round.courseId } : "skip",
	);
	useQuery(api.settings.get, active ? {} : "skip");
	useQuery(api.clubs.list, active ? {} : "skip");
	return null;
}
