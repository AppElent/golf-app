/**
 * iOS has no live regions: `accessibilityLiveRegion` is Android only, so a
 * status that changes on screen is silent in VoiceOver unless it is announced.
 */
import { useEffect, useRef } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/** Speaks `text` in VoiceOver when it changes; not on first show. */
export function useAnnounceChange(text: string) {
	const last = useRef(text);
	useEffect(() => {
		if (text === last.current) return;
		last.current = text;
		if (Platform.OS === "ios" && text) {
			AccessibilityInfo.announceForAccessibility(text);
		}
	}, [text]);
}
