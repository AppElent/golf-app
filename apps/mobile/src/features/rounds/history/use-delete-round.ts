import { useMutation } from "convex/react";
import { api, type Id } from "../../../convex/api";
import { useSubmit } from "../../../convex/use-submit";
import { useI18n } from "../../../i18n";
import { useConfirm } from "../../../ui/confirm-dialog";

/** Asks first; a kept round changes nothing. */
export function useConfirmDeleteRound() {
	const { t } = useI18n();
	const confirm = useConfirm();
	return () =>
		confirm({
			title: t.rounds.deleteTitle,
			message: t.rounds.deleteMessage,
			confirmLabel: t.rounds.delete,
			destructive: true,
		});
}

/** Deletes the round a screen shows, then leaves through `onDeleted`. */
export function useDeleteRound({ onDeleted }: { onDeleted: () => void }) {
	const { t } = useI18n();
	const confirmDelete = useConfirmDeleteRound();
	const remove = useMutation(api.rounds.remove);
	const submit = useSubmit();

	async function deleteRound(roundId: Id<"rounds">) {
		if (!(await confirmDelete())) return;
		await submit.run(() => remove({ roundId }), {
			errorFallback: t.rounds.deleteError,
			onSuccess: onDeleted,
		});
	}

	return { deleteRound, pending: submit.pending, error: submit.error };
}
