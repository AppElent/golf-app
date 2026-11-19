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
			<Stack.Screen name="simulator" options={small} />
			<Stack.Screen name="name" options={small} />
			<Stack.Screen name="emails" options={small} />
			<Stack.Screen name="add-email" options={small} />
			<Stack.Screen name="verify-email" options={small} />
			<Stack.Screen name="password" options={small} />
		</Stack>
	);
}
