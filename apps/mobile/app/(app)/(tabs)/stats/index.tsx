import { Stack } from "expo-router";
import { ScrollView } from "react-native";
import { AppText } from "../../../../src/ui/text";

export default function Placeholder() {
	return (
		<ScrollView contentInsetAdjustmentBehavior="automatic">
			<Stack.Screen options={{ title: "stats" }} />
			<AppText>stats</AppText>
		</ScrollView>
	);
}
