import { Stack } from "expo-router";
import { HomeSummaryScreen } from "../../../../src/features/home/summary/home-summary-screen";
import { useI18n } from "../../../../src/i18n";

export default function HomeRoute() {
	const { t } = useI18n();
	return (
		<>
			<Stack.Screen options={{ title: t.home.title }} />
			<HomeSummaryScreen />
		</>
	);
}
