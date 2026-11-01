import { useLocalSearchParams } from "expo-router";
import type { Id } from "../../../src/convex/api";
import { SuggestCorrectionScreen } from "../../../src/features/courses/suggest/suggest-correction-screen";

export default function SuggestCorrectionRoute() {
	const { courseId } = useLocalSearchParams<{ courseId: Id<"courses"> }>();
	return <SuggestCorrectionScreen courseId={courseId} />;
}
