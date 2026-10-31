import { Platform } from "react-native";

/**
 * iOS 26 is where Liquid Glass starts: the tab bar grows a bottom accessory,
 * and headers get their material from the system — an explicit
 * `headerBlurEffect` there is drawn *over* the large title and smears it out.
 */
export function isIOS26OrLater(): boolean {
	return (
		Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) >= 26
	);
}
