/**
 * iOS has no live regions: `accessibilityLiveRegion` is Android only, so a
 * status that changes on screen is silent in VoiceOver unless it is announced.
 */
import { useIsFocused } from "expo-router";
import { useEffect, useRef } from "react";
import { AccessibilityInfo, Platform } from "react-native";

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
		if (focused && Platform.OS === "ios" && text) {
			AccessibilityInfo.announceForAccessibility(text);
		}
	}, [text, focused]);
}
