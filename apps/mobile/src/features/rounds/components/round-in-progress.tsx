import { useRouter } from "expo-router";
import { fmt, useI18n } from "../../../i18n";
import { EmptyState } from "../../../ui/empty-state";
import { useSimulationMode } from "../../simulation/mode/use-simulation-mode";

/**
 * Stands in for the course picker and round setup while a real round is in
 * progress: the server allows one at a time, so offer the way back to it
 * instead of a "Tee off" that can only fail.
 */
export function RoundInProgress({ courseName }: { courseName: string }) {
	const { t } = useI18n();
	const router = useRouter();
	const { setSimulating } = useSimulationMode();
	return (
		<EmptyState
			title={t.home.inProgressTitle}
			body={fmt(t.home.inProgressBody, { course: courseName })}
			action={{
				label: t.home.resumeRound,
				onPress: () => {
					setSimulating(false);
					router.dismissAll();
					router.push("/play");
				},
			}}
		/>
	);
}
