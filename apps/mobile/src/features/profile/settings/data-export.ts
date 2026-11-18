import {
	collectExport,
	type ExportPage,
	type ExportStep,
	exportFileName,
	serializeExport,
} from "@fairway/core/data-export";
import { Directory, File, Paths } from "expo-file-system";
import { Platform, Share } from "react-native";

/**
 * "Export my data" (features.ts `data-export`): builds the JSON file from
 * Convex's pages and opens the share sheet on it, so the user can save it to
 * Files or send it on. The folder is emptied on the next export rather than
 * after this one: `Share.share` resolves before some targets have read the file.
 */
export async function shareDataExport(
	fetchPage: (step: ExportStep | undefined) => Promise<ExportPage>,
) {
	const now = new Date();
	const text = serializeExport(await collectExport(fetchPage, now));
	// React Native's Android share takes text only, not a file.
	if (Platform.OS === "android") {
		await Share.share({ message: text });
		return;
	}
	const dir = new Directory(Paths.cache, "data-export");
	if (dir.exists) dir.delete();
	dir.create();
	const file = new File(dir, exportFileName(now));
	file.create();
	file.write(text);
	await Share.share({ url: file.uri });
}
