/**
 * An EAS update that has downloaded but not run yet, and the restart that
 * applies it. expo-updates applies a download only on the next cold start,
 * which on a phone that is never force-quit can be weeks; this lets Home
 * offer the restart instead. It never restarts on its own: a reload during
 * a round would drop the player off the hole they are on.
 *
 * Inert in development and in builds without expo-updates enabled.
 */
import * as Updates from "expo-updates";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { reportError } from "../monitoring/report";
import { shouldCheckOnResume } from "./check-policy";

const enabled = !__DEV__ && Updates.isEnabled;

export function useAppUpdate(): { ready: boolean; restart: () => void } {
	const { isUpdatePending } = Updates.useUpdates();
	const lastCheckedAt = useRef<number | null>(Date.now());

	useEffect(() => {
		if (!enabled) return;
		const subscription = AppState.addEventListener("change", (state) => {
			const now = Date.now();
			if (
				state !== "active" ||
				!shouldCheckOnResume(lastCheckedAt.current, now)
			)
				return;
			lastCheckedAt.current = now;
			Updates.checkForUpdateAsync()
				.then((result) =>
					result.isAvailable ? Updates.fetchUpdateAsync() : undefined,
				)
				// Offline on the course is normal; the next resume tries again.
				.catch(() => {});
		});
		return () => subscription.remove();
	}, []);

	return {
		ready: enabled && isUpdatePending,
		restart: () => {
			Updates.reloadAsync().catch(reportError);
		},
	};
}
