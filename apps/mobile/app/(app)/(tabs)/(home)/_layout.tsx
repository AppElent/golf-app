import { Stack } from "expo-router";
import { useLargeTitleOptions } from "../../../../src/ui/large-title-options";

export default function HomeStack() {
	const options = useLargeTitleOptions();
	return (
		<Stack screenOptions={options}>
			<Stack.Screen
				name="setup/[courseId]"
				options={{ headerLargeTitle: false }}
			/>
		</Stack>
	);
}
