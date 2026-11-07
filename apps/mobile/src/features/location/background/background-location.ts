/**
 * Opt-in "GPS while locked". The task's positions keep the receiver awake (so
 * the fix is warm when the screen comes back) and feed the Lock Screen's Live
 * Activity. If the app was killed with Play open, the first update after the OS
 * relaunches it finds no Play mounted and stops them.
 */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { useEffect } from "react";
import { liveHolePosition } from "../../live/hole/live-hole";
import { fixReading } from "../location-fix";
import { backgroundLocationPreferred } from "./background-location-preference";

const TASK = "fairway-background-location";

/** Whether a Play screen is mounted in this JS runtime. */
let playing = false;

// Must run at module scope (app entry imports this file) so the OS can wake
// the JS runtime into a defined task.
if (!TaskManager.isTaskDefined(TASK)) {
	TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(
		TASK,
		async ({ data }) => {
			if (!playing) {
				await stop();
				return;
			}
			const last = data?.locations?.at(-1);
			if (last) {
				liveHolePosition(fixReading(last).position, "background");
			}
		},
	);
}

/** Runs background updates while the calling screen (Play) is mounted. */
export function useBackgroundLocationWhilePlaying(
	notification: { title: string; body: string },
	enabled: boolean,
) {
	const { title, body } = notification;
	useEffect(() => {
		if (!enabled) return;
		playing = true;
		if (!backgroundLocationPreferred()) {
			return () => {
				playing = false;
			};
		}
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
			playing = false;
			cancelled = true;
			if (started) void stop();
		};
	}, [title, body, enabled]);
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
