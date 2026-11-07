import { useRouter } from "expo-router";
import { useI18n } from "../../../i18n";
import { EmptyState } from "../../../ui/empty-state";

export function NoActiveRound({
	title,
	closeLabel,
}: {
	title: string;
	closeLabel: string;
}) {
	const { t } = useI18n();
	const router = useRouter();
	return (
		<EmptyState
			title={title}
			body={t.play.noRoundHint}
			action={{ label: closeLabel, onPress: () => router.back() }}
		/>
	);
}
