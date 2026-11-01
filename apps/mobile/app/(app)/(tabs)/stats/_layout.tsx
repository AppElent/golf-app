import { Stack } from "expo-router";
import { useLargeTitleOptions } from "../../../../src/ui/large-title-options";

export default function StatsStack() {
	const options = useLargeTitleOptions();
	return <Stack screenOptions={options} />;
}
