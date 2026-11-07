import { useLocalSearchParams } from "expo-router";
import type { Id } from "../../../../../src/convex/api";
import { RoundSetupScreen } from "../../../../../src/features/rounds/setup/round-setup-screen";

export default function RoundSetupRoute() {
	const { courseId, simulate } = useLocalSearchParams<{
		courseId: Id<"courses">;
		simulate?: string;
	}>();
	return <RoundSetupScreen courseId={courseId} simulate={simulate === "1"} />;
}
