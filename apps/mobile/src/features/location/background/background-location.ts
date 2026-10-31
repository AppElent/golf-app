/**
 * Opt-in "GPS while locked": during a round, keep location updates running
 * with the phone locked so the fix is already warm when the screen comes back
 * (no ten-second wait for the blue dot on every glance). Off by default; the
 * switch lives in Profile and needs the Always permission.
 *
 * The task itself stores nothing: the positions only keep the receiver awake.
 * The Play screen's own foreground watch draws everything. Updates stop when
 * Play unmounts, so nothing runs outside a round.
 */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { useEffect } from "react";
import {
	PREFERENCE_KEYS,
	readPreference,
	writePreference,
} from "../../../prefs/local-preference";

const TASK = "fairway-background-location";

// Must run at module scope (app entry imports this file) so the OS can wake
// the JS runtime into a defined task.
if (!TaskManager.isTaskDefined(TASK)) {
	TaskManager.defineTask(TASK, async () => {
		// Intentionally empty: see the module comment.
	});
}

export function backgroundLocationPreferred(): boolean {
	return readPreference(PREFERENCE_KEYS.backgroundLocation) === "on";
}

/**
 * Turn the preference on (asking for Always first) or off. Resolves to the
 * stored state, plus whether iOS would no longer show its prompt (the user has
 * to go to Settings).
 */
export async function setBackgroundLocationPreferred(
	on: boolean,
): Promise<{ on: boolean; needsSettings: boolean }> {
	if (!on) {
		writePreference(PREFERENCE_KEYS.backgroundLocation, "off");
		return { on: false, needsSettings: false };
	}
	try {
		const fg = await Location.requestForegroundPermissionsAsync();
		if (!fg.granted) return { on: false, needsSettings: !fg.canAskAgain };
		const before = await Location.getBackgroundPermissionsAsync();
		let bg = await Location.requestBackgroundPermissionsAsync();
		// iOS resolves at once with "when in use" while its "Change to Always"
		// prompt is still up, and sends no event when it closes: re-read for a
		// while.
		for (
			let i = 0;
			!bg.granted && before.canAskAgain && i < PROMPT_POLLS;
			i++
		) {
			await new Promise((r) => setTimeout(r, 500));
			bg = await Location.getBackgroundPermissionsAsync();
		}
		if (!bg.granted) return { on: false, needsSettings: !before.canAskAgain };
	} catch {
		return { on: false, needsSettings: false };
	}
	return {
		on: writePreference(PREFERENCE_KEYS.backgroundLocation, "on"),
		needsSettings: false,
	};
}

/** Half-second reads while the iOS prompt may be up (15 s). */
const PROMPT_POLLS = 30;

/** Runs background updates while the calling screen (Play) is mounted. */
export function useBackgroundLocationWhilePlaying(notification: {
	title: string;
	body: string;
}) {
	const { title, body } = notification;
	useEffect(() => {
		if (!backgroundLocationPreferred()) return;
		let started = false;
		let cancelled = false;
		(async () => {
			try {
				const { granted } = await Location.getBackgroundPermissionsAsync();
				if (!granted || cancelled) return;
				await Location.startLocationUpdatesAsync(TASK, {
					accuracy: Location.Accuracy.High,
					distanceInterval: 5,
					pausesUpdatesAutomatically: false,
					activityType: Location.ActivityType.Fitness,
					showsBackgroundLocationIndicator: true,
					foregroundService: {
						notificationTitle: title,
						notificationBody: body,
					},
				});
				started = true;
				if (cancelled) await stop();
			} catch {
				// Best effort: the foreground watch still works.
			}
		})();
		return () => {
			cancelled = true;
			if (started) void stop();
		};
	}, [title, body]);
}

async function stop() {
	try {
		if (await Location.hasStartedLocationUpdatesAsync(TASK)) {
			await Location.stopLocationUpdatesAsync(TASK);
		}
	} catch {
		// Already stopped.
	}
}
