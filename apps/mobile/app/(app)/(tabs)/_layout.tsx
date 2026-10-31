/**
 * The tab bar: real UITabBar (Liquid Glass on iOS 26) / BottomNavigationView.
 * Play is not a tab — it is a full-screen route over the tabs, reached from
 * Home or from the resume accessory while a round is active.
 *
 * Colours are `chrome` (UIKit-resolved dynamic colours) on iOS: the glass
 * picks its own trait from the content under it, so a static colour can end
 * up on the wrong background.
 */
import { NativeTabs } from "expo-router/native-tabs";
import { Platform } from "react-native";
import { useI18n } from "../../../src/i18n";
import { chrome, useTokens } from "../../../src/theme";

export default function TabsLayout() {
	const colors = useTokens();
	const tabColors = Platform.OS === "ios" ? chrome : colors;
	const { t } = useI18n();

	return (
		<NativeTabs
			backgroundColor={Platform.OS === "ios" ? undefined : colors.surface}
			minimizeBehavior="onScrollDown"
			tintColor={tabColors.accentInk}
			iconColor={{
				default: tabColors.textMuted,
				selected: tabColors.accentInk,
			}}
			labelStyle={{
				default: { color: tabColors.textMuted },
				selected: { color: tabColors.accentInk },
			}}
		>
			<NativeTabs.Trigger name="(home)">
				<NativeTabs.Trigger.Label>{t.tabs.home}</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="flag.fill" md="golf_course" />
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="rounds">
				<NativeTabs.Trigger.Label>{t.tabs.rounds}</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="list.bullet.rectangle" md="list_alt" />
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="stats">
				<NativeTabs.Trigger.Label>{t.tabs.stats}</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="chart.xyaxis.line" md="insights" />
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="profile">
				<NativeTabs.Trigger.Label>{t.tabs.profile}</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="person.crop.circle" md="person" />
			</NativeTabs.Trigger>
		</NativeTabs>
	);
}
