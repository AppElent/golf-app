import { Stack } from "expo-router";
import { useLargeTitleOptions } from "../../../../src/ui/large-title-options";

export default function RoundsStack() {
	const options = useLargeTitleOptions();
	return (
		<Stack screenOptions={options}>
			<Stack.Screen name="[roundId]" options={{ headerLargeTitle: false }} />
		</Stack>
	);
}
