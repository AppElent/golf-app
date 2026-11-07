import type { ComponentRef, RefObject } from "react";
import { Share, type View } from "react-native";
import { captureRef } from "react-native-view-shot";

/** Sends the card image with the text, the text alone if the capture fails. */
export async function shareRound(
	cardRef: RefObject<ComponentRef<typeof View> | null>,
	message: string,
) {
	let url: string | undefined;
	try {
		if (cardRef.current) {
			url = await captureRef(cardRef, { format: "png", result: "tmpfile" });
		}
	} catch {
		// Capture failed: the text still goes out below.
	}
	Share.share(url ? { url, message } : { message }).catch(() => {});
}
