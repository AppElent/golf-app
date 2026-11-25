import { openBrowserAsync } from "expo-web-browser";
import { showAlert } from "../../monitoring/native-presentation";

/**
 * Opens a page in the in-app browser, and says so when it cannot instead of
 * doing nothing: Android rejects when no browser can open the link, iOS when
 * another browser sheet is still open.
 */
export async function openInBrowser(
	url: string,
	failure: { title: string; message: string },
) {
	try {
		await openBrowserAsync(url);
	} catch {
		showAlert(failure.title, failure.message);
	}
}
