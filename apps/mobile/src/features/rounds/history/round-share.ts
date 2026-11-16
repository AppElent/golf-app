import { Directory, File, Paths } from "expo-file-system";
import type { ComponentRef, RefObject } from "react";
import { Share, type View } from "react-native";
import { captureRef } from "react-native-view-shot";

/**
 * Sends the card image with the text, the text alone if the capture fails.
 * `fileName` names the image the share sheet shows (see `shareFileName`).
 */
export async function shareRound(
	cardRef: RefObject<ComponentRef<typeof View> | null>,
	message: string,
	fileName: string,
) {
	let url: string | undefined;
	try {
		if (cardRef.current) {
			url = await captureRef(cardRef, { format: "png", result: "tmpfile" });
		}
	} catch {
		// Capture failed: the text still goes out below.
	}
	if (url) url = await named(url, fileName);
	Share.share(url ? { url, message } : { message }).catch(() => {});
}

/**
 * view-shot names its capture with a UUID (iOS) or random digits (Android), and
 * the share sheet shows that name. Moves the capture into a folder of its own
 * under the right name. The folder is emptied on the next share rather than
 * after this one: `Share.share` resolves before some targets have read the file.
 * Keeps the capture as is when the move fails.
 */
async function named(capture: string, fileName: string): Promise<string> {
	try {
		const dir = new Directory(Paths.cache, "round-share");
		if (dir.exists) dir.delete();
		dir.create();
		const file = new File(capture);
		await file.move(new File(dir, fileName));
		return file.uri;
	} catch {
		return capture;
	}
}
