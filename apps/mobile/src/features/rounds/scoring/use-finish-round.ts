import { type HoleScore, playedHoles } from "@fairway/core/round";
import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { api } from "../../../convex/api";
import { useSubmit } from "../../../convex/use-submit";
import { haptics } from "../../../feedback/haptics";
import { plural, useI18n } from "../../../i18n";
import { useConfirm } from "../../../ui/confirm-dialog";
import { useEndSimulation } from "../../simulation/mode/use-end-simulation";
import type { ActiveRound } from "../use-active-round";

/** Confirm, finish the round, and show it. */
export function useFinishRound() {
	const { t, locale } = useI18n();
	const router = useRouter();
	const confirm = useConfirm();
	const endSimulation = useEndSimulation();
	const finish = useMutation(api.rounds.finish);
	const submit = useSubmit();

	/** False when the player thought better of it. */
	async function finishRound(
		{ round, holes }: Pick<ActiveRound, "round" | "holes">,
		scores: readonly HoleScore[],
	): Promise<boolean> {
		const missing = holes.length - playedHoles(holes.length, scores).length;
		const roundId = round._id;
		const team = round.format === "scramble";
		const ok = await confirm({
			title: t.scorecard.finishTitle,
			message: round.simulated
				? [
						missing > 0
							? plural(locale, missing, t.scorecard.finishSimulationMissing)
							: null,
						t.scorecard.finishSimulationMessage,
					]
						.filter(Boolean)
						.join(" ")
				: missing > 0
					? plural(
							locale,
							missing,
							team ? t.scorecard.finishTeamMissing : t.scorecard.finishMissing,
						)
					: team
						? t.scorecard.finishTeamMessage
						: t.scorecard.finishMessage,
			confirmLabel: t.scorecard.finish,
		});
		if (!ok) return false;
		await submit.run(() => finish({ roundId }), {
			errorFallback: t.scorecard.finishError,
			onSuccess: () => {
				haptics.saveConfirmed();
				if (round.simulated) {
					endSimulation();
					router.dismissAll();
					return;
				}
				router.dismissAll();
				router.push({
					pathname: "/rounds/[roundId]",
					params: { roundId },
				});
			},
		});
		return true;
	}

	return { finishRound, pending: submit.pending, error: submit.error };
}
