import { Stack } from "expo-router";
import { useLargeTitleOptions } from "../../../../src/ui/large-title-options";

const small = { headerLargeTitle: false } as const;

export default function ProfileStack() {
	const options = useLargeTitleOptions();
	return (
		<Stack screenOptions={options}>
			<Stack.Screen name="handicap" options={small} />
			<Stack.Screen name="home-course" options={small} />
			<Stack.Screen name="club" options={small} />
		</Stack>
	);
}
