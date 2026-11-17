/**
 * Holds the signed-in subtree until the Convex websocket is actually
 * authenticated.
 *
 * Clerk and Convex answer "is this user signed in?" at different moments.
 * Clerk's `isSignedIn` flips as soon as the session token is readable from
 * SecureStore; Convex only counts as authenticated once that token has been
 * minted for the Convex template, pushed over the websocket and accepted by
 * the backend. Between those two instants every `useQuery` in the subtree is
 * live and unauthenticated, and each one throws `Unauthenticated` out of
 * render — the red box the user sees on a cold start or when a stale session
 * is being refreshed.
 *
 * `(app)/_layout` keeps guarding *navigation* on Clerk's `isSignedIn` (see the
 * comment there: guarding the redirect on Convex bounces forever). This gate
 * is the other half of that split — navigation follows Clerk, data follows
 * Convex — and it sits below the redirect so the two never fight.
 *
 * It renders a bare themed surface rather than a spinner: on the common path
 * the handshake is a few hundred milliseconds behind a splash screen that is
 * still up, and a spinner that flashes for one frame reads as a glitch.
 *
 * **Offline fallback (APP-146).** When the socket cannot connect, Convex never
 * authenticates. If this phone holds a saved copy of the active round for the
 * account Clerk restored, and Convex last confirmed that account here, the
 * gate draws the play screen from it, display only (`features/play/offline`).
 * It stays up until Convex authenticates; then the real screens mount and
 * open the live play screen (on the hole the server has).
 */
import { useAuth } from "@clerk/expo";
import { useConvexAuth } from "convex/react";
import { usePathname, useRouter } from "expo-router";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { StyleSheet, View } from "react-native";
import { OfflineBanner, useStalledOffline } from "../convex/offline-banner";
import { OfflinePlay } from "../features/play/offline/offline-play";
import {
	type OfflineRound,
	offlineRound,
} from "../features/play/offline/offline-round";
import { type Tokens, useThemedStyles } from "../theme";

const ResumePlayContext = createContext<{
	resume: boolean;
	done: () => void;
}>({ resume: false, done: () => {} });

export function ConvexSessionGate({ children }: { children: ReactNode }) {
	const { isAuthenticated } = useConvexAuth();
	const { userId } = useAuth();
	const stalled = useStalledOffline();
	const styles = useThemedStyles(createStyles);
	const [held, setHeld] = useState<OfflineRound | null>(null);
	const [resume, setResume] = useState(false);

	// Read once per offline spell, not on every render.
	const copy = useMemo(
		() => (!isAuthenticated && stalled ? offlineRound(userId) : null),
		[isAuthenticated, stalled, userId],
	);
	// Hold the copy through a reconnect until Convex authenticates, so the
	// screen does not blank while the handshake runs; drop it if the account
	// changed.
	if (copy && !held) setHeld(copy);
	if (held && held.account !== userId) setHeld(null);
	if (isAuthenticated && held) {
		setHeld(null);
		setResume(true);
	}

	const resumeValue = useMemo(
		() => ({ resume, done: () => setResume(false) }),
		[resume],
	);

	if (isAuthenticated) {
		return (
			<ResumePlayContext.Provider value={resumeValue}>
				{children}
			</ResumePlayContext.Provider>
		);
	}
	const blank = (
		<View style={styles.root}>{stalled ? <OfflineBanner /> : null}</View>
	);
	if (held) return <OfflinePlay round={held} fallback={blank} />;
	return blank;
}

/**
 * Mount beside the signed-in Stack: after the offline fallback was shown,
 * open the live play screen once, so reconnecting does not drop the golfer on
 * Home.
 */
export function ResumePlayAfterOffline() {
	const { resume, done } = useContext(ResumePlayContext);
	const router = useRouter();
	const pathname = usePathname();
	useEffect(() => {
		if (!resume) return;
		const frame = requestAnimationFrame(() => {
			done();
			// Already there (a notification opened it): no second copy.
			if (pathname !== "/play") router.push("/play");
		});
		return () => cancelAnimationFrame(frame);
	}, [resume, done, router, pathname]);
	return null;
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
	});
