import { parseHandicapIndex } from "@fairway/core/handicap";
import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { useSubmit } from "../../../convex/use-submit";
import { useI18n } from "../../../i18n";
import { FormScreen, FormSection, FormTextField } from "../../../ui/form";
import { NavHeader } from "../../../ui/nav-header";
import { SkeletonList } from "../../../ui/skeleton";

export function HandicapScreen() {
	const settings = useQuery(api.settings.get);
	if (settings === undefined) return <SkeletonList rows={1} />;
	return <HandicapForm initial={settings.handicapIndex} />;
}

function HandicapForm({ initial }: { initial: number | null }) {
	const { t, numbers } = useI18n();
	const router = useRouter();
	const update = useMutation(api.settings.update);
	const [text, setText] = useState(() =>
		initial === null ? "" : numbers.handicap(initial),
	);
	const submit = useSubmit();

	async function onSave() {
		const parsed = parseHandicapIndex(text);
		if (!parsed.valid) {
			submit.setError(t.profile.handicapInvalid);
			return;
		}
		await submit.run(() => update({ handicapIndex: parsed.value }), {
			errorFallback: t.profile.saveError,
			onSuccess: () => router.back(),
		});
	}

	return (
		<>
			<NavHeader
				title={t.profile.handicap}
				right={{
					label: t.common.save,
					onPress: () => void onSave(),
					disabled: submit.pending,
				}}
			/>
			<FormScreen>
				<FormSection footer={t.profile.handicapHint}>
					<FormTextField
						label={t.profile.handicap}
						value={text}
						onChangeText={(next) => {
							setText(next);
							submit.setError(null);
						}}
						placeholder={t.profile.handicapPlaceholder}
						keyboardType="numbers-and-punctuation"
						returnKeyType="done"
						onSubmitEditing={() => void onSave()}
						autoFocus
						error={submit.error ?? undefined}
					/>
				</FormSection>
			</FormScreen>
		</>
	);
}
