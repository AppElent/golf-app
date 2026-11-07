/**
 * Whether the person has asked the system to reduce motion. The setting can
 * change while the app is open (Control Centre), so this subscribes.
 *
 * Every branch on it must still present the same thing in the same place; only
 * the transition changes.
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

export function modalAnimation(reduceMotion: boolean): "fade" | "none" {
	return reduceMotion ? "none" : "fade";
}
