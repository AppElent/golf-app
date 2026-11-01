import { Stack } from "expo-router";
import { RoundsHistoryScreen } from "../../../../src/features/rounds/history/rounds-history-screen";
import { useI18n } from "../../../../src/i18n";

export default function RoundsRoute() {
	const { t } = useI18n();
	return (
		<>
			<Stack.Screen options={{ title: t.rounds.title }} />
			<RoundsHistoryScreen />
		</>
	);
}
