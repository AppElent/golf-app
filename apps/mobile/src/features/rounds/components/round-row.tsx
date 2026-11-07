import { useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { InsetRow } from "../../../ui/inset-list";
import { scoreLabel } from "./round-row-model";

export function RoundRow({
	round,
	secondary,
	actions,
}: {
	round: {
		_id: string;
		courseName: string;
		owner: { strokes: number; vsPar: number };
	};
	secondary: string;
	actions?: ComponentProps<typeof InsetRow>["actions"];
}) {
	const router = useRouter();
	return (
		<InsetRow
			title={round.courseName}
			secondary={secondary}
			value={scoreLabel(round.owner)}
			chevron
			onPress={() => router.push(`/rounds/${round._id}`)}
			actions={actions}
		/>
	);
}
