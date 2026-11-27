/**
 * iOS has no live regions: `accessibilityLiveRegion` is Android only, so a
 * status that changes on screen is silent in VoiceOver unless it is announced.
 */
import { useIsFocused } from "expo-router";
import { useEffect, useRef } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * Long enough for a sheet that closes on the same save (the score sheet's
 * `router.back()`) to finish closing, so VoiceOver has started reading the
 * screen it lands on.
 */
export const ANNOUNCE_DELAY_MS = 700;

let pending: ReturnType<typeof setTimeout> | undefined;

/**
 * Speaks `text` once the screen has settled, queued behind what VoiceOver is
 * already saying, so a dismiss on the same save neither cuts it off nor is cut
 * off by it. The timer outlives the screen that asked; a newer standing
 * replaces one not yet spoken.
 */
function announceSettled(text: string) {
	clearTimeout(pending);
	pending = setTimeout(() => {
		pending = undefined;
		AccessibilityInfo.announceForAccessibilityWithOptions(text, {
			queue: true,
		});
	}, ANNOUNCE_DELAY_MS);
}

/**
 * Speaks `text` in VoiceOver when it changes; not on first show. Screens lower
 * in the stack stay mounted, so only the focused screen speaks: one change
 * shown on several open screens is announced once, not cut off by a second.
 */
export function useAnnounceChange(text: string) {
	const focused = useIsFocused();
	const last = useRef(text);
	useEffect(() => {
		if (text === last.current) return;
		last.current = text;
		if (focused && Platform.OS === "ios" && text) announceSettled(text);
	}, [text, focused]);
}
