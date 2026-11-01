/**
 * The phone's haptic vocabulary.
 *
 * Adapted from the same module in the sibling `gather` app (spec #68, D24),
 * narrowed to the three events spec #68 actually sanctions plus the two the
 * gestures in `ui/swipeable-row.tsx` and `ui/action-menu.tsx` need to stay
 * legible without watching the screen.
 *
 * **Call sites name events, never intensities.** `haptics.entryLogged()`, not
 * `notificationAsync(Success)` — so "how hard should a logged meal feel" is
 * answered once, here, rather than re-answered by whoever writes the next
 * screen. It is also the only place Android's vocabulary diverges from iOS's,
 * and the only place a future "reduce haptics" preference would go.
 *
 * **Restraint is the point.** Spec #68: haptics are limited to *meaningful
 * selection*, *successful logging*, and *destructive warning* — not routine
 * taps. There is deliberately no `buttonPressed()` here, because adding one is
 * how an app ends up buzzing on every tap. Choosing a serving is meaningful
 * (it changes the numbers you are about to commit); scrolling a list of foods
 * is not.
 *
 * **Nothing here is ever the only signal.** iOS silently plays nothing in Low
 * Power Mode, when the user has turned haptics off, while the camera is open,
 * and during dictation. A confirmation that exists only as a buzz did not
 * happen for those people — so every call site below also draws or says the
 * same thing.
 *
 * Every call is fire-and-forget and swallows its rejection: a haptic that fails
 * is not an error worth surfacing, and it must never take a save down with it.
 */
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Read at call time, not at module scope. `process.env.EXPO_OS` — which the
 * sibling app uses — is substituted by `babel-preset-expo` during the build,
 * which makes it a compile-time constant and therefore invisible to a test
 * that wants to prove both platforms get an equivalent outcome. `Platform.OS`
 * costs a property read and is the thing the rest of the app already uses.
 */
function isAndroid(): boolean {
	return Platform.OS === "android";
}

/** Fire-and-forget. A failed haptic is not a failure the user needs told about. */
function play(run: () => Promise<void>): void {
	try {
		run().catch(() => undefined);
	} catch {
		// A synchronous throw from a missing native module is equally ignorable.
	}
}

export const haptics = {
	/**
	 * A meaningful selection moved: a serving option, a meal slot, a goal
	 * direction. Not every press — only the ones that change what a subsequent
	 * confirm will write.
	 */
	selectionChanged(): void {
		play(() => Haptics.selectionAsync());
	},

	/**
	 * A diary entry was written. The one success haptic in Nutrition, and the
	 * reason it earns one: logging is the module's whole purpose and the screen
	 * leaves immediately afterwards, so the buzz is the receipt for an action
	 * whose result is on the *next* screen.
	 */
	entryLogged(): void {
		play(() =>
			isAndroid()
				? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
				: Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
		);
	},

	/**
	 * A destructive confirmation was raised — the user is one tap from deleting
	 * something. Warning, not error: nothing has gone wrong yet, and that
	 * distinction is exactly what the two iOS notification types encode.
	 */
	destructiveWarning(): void {
		play(() =>
			isAndroid()
				? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject)
				: Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
		);
	},

	/**
	 * A swipe crossed the point where the revealed actions stay open. The one
	 * haptic that genuinely carries information the screen cannot: it is how you
	 * know you have gone far enough while your thumb is over the row.
	 */
	swipeThresholdPassed(): void {
		play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
	},

	/**
	 * A swipe went far enough that letting go runs the row's outermost action
	 * (a full swipe). Stronger than the open threshold: this one commits.
	 */
	swipeCommitArmed(): void {
		play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
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
