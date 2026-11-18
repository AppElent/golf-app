/**
 * A claimed link opened while signed out. The signed-in guard redirects to
 * sign-in and the link's path is gone, so the guard remembers the route here
 * and the auth guard sends the newly signed-in user back to it.
 *
 * Contract: copy next to `app-links.ts`, then
 * - `(app)/_layout.tsx` (signed-in guard), on every render before it
 *   redirects: `rememberPendingLink(appLinks.routeFromPathname(usePathname(), useGlobalSearchParams()))`.
 *   Any other route stores `null`, so the latest link wins and a stale one
 *   is forgotten without an explicit clear.
 * - `(auth)/_layout.tsx`, once signed in:
 *   `<Redirect href={pendingLink() ?? "/"} />`.
 *
 * Memory only: if the app is killed during sign-in, the user opens the link
 * again. Never persist it: a link from yesterday must not fire on next launch.
 */
let pending: string | null = null;

export function rememberPendingLink(route: string | null): void {
	pending = route;
}

export function pendingLink(): string | null {
	return pending;
}
