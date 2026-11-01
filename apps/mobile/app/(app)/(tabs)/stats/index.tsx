import { Stack } from "expo-router";
import { StatsScreen } from "../../../../src/features/stats/overview/stats-screen";
import { useI18n } from "../../../../src/i18n";

export default function StatsRoute() {
	const { t } = useI18n();
	return (
		<>
			<Stack.Screen options={{ title: t.stats.title }} />
			<StatsScreen />
		</>
	);
}
