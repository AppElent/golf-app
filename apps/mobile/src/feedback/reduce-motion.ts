/**
 * Whether the person has asked the system to reduce motion.
 *
 * Spec #68 requires the interface to respect the setting, and the honest way
 * to do that is to ask the platform rather than to guess. Two rules follow
 * from having this hook:
 *
 * 1. **Prefer not animating at all.** `ui/skeleton.tsx` is the model: it has no
 *    shimmer, so there is nothing for this hook to switch off. Reach for this
 *    only where the motion carries meaning — a sheet rising from the bottom
 *    edge says where it came from and where dismissing it will send it.
 * 2. **Reduce motion, never function.** Every branch that consults this must
 *    still present the same thing in the same place; only the transition
 *    between states changes. A sheet that does not slide is still a sheet.
 *
 * The setting can be turned on while the app is open — Control Centre, or a
 * Settings trip mid-task — so this subscribes rather than reading once. It
 * starts at `false` and corrects itself on the first resolved read; that
 * ordering matters, because the alternative (start at `true`) would make every
 * first paint jump-cut for everyone.
 */
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReduceMotion(): boolean {
	const [reduceMotion, setReduceMotion] = useState(false);

	useEffect(() => {
		let active = true;
		AccessibilityInfo.isReduceMotionEnabled()
			.then((enabled) => {
				if (active) setReduceMotion(enabled);
			})
			.catch(() => {
				// A platform that cannot answer is treated as "no preference
				// expressed", which is the same as the initial state.
			});
		const subscription = AccessibilityInfo.addEventListener(
			"reduceMotionChanged",
			(enabled) => setReduceMotion(enabled),
		);
		return () => {
			active = false;
			subscription.remove();
		};
	}, []);

	return reduceMotion;
}

/**
 * The `animationType` a React Native `Modal` should use.
 *
 * `"none"` is a cut, not a freeze: the modal still appears and still covers
 * what it covered. Callers pass the motion they would use otherwise.
 */
export function modalAnimation(
	reduceMotion: boolean,
	preferred: "slide" | "fade",
): "slide" | "fade" | "none" {
	return reduceMotion ? "none" : preferred;
}
