/**
 * The phone's haptic vocabulary. Call sites name events, never intensities, and
 * this is the only place Android's vocabulary diverges from iOS's.
 *
 * Nothing here is ever the only signal: iOS silently plays nothing in Low Power
 * Mode, when the user has turned haptics off, while the camera is open, and
 * during dictation. Every call site also draws or says the same thing.
 */
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

function isAndroid(): boolean {
	return Platform.OS === "android";
}

/** Fire-and-forget: a failed haptic must never take a save down with it. */
function play(run: () => Promise<void>): void {
	try {
		run().catch(() => undefined);
	} catch {
		// A synchronous throw from a missing native module is equally ignorable.
	}
}

export const haptics = {
	/** A selection moved that changes what a later confirm writes. Not every press. */
	selectionChanged(): void {
		play(() => Haptics.selectionAsync());
	},

	/** The server acknowledged a write: a score, a shot, a started or finished round. */
	saveConfirmed(): void {
		play(() =>
			isAndroid()
				? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
				: Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
		);
	},

	/** A destructive confirmation was raised: a warning, since nothing went wrong yet. */
	destructiveWarning(): void {
		play(() =>
			isAndroid()
				? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject)
				: Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
		);
	},

	/** A swipe crossed the point where the revealed actions stay open. */
	swipeThresholdPassed(): void {
		play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
	},

	/** A press-and-hold opened an action menu. */
	menuOpened(): void {
		play(() =>
			isAndroid()
				? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press)
				: Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
		);
	},
};
