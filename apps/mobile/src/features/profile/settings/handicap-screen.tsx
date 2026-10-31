/** Edit the WHS handicap index. Empty clears it; saved online-first. */
import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { localizeDecimal, useI18n } from "../../../i18n";
import { convexErrorMessage } from "../../../ui/confirm-dialog";
import { FormScreen, FormSection, FormTextField } from "../../../ui/form";
import { ScreenHeader } from "../../../ui/screen-header";
import { SkeletonList } from "../../../ui/skeleton";
import { handicapText, parseHandicap } from "./profile-model";

export function HandicapScreen() {
	const settings = useQuery(api.settings.get);
	if (settings === undefined) return <SkeletonList rows={1} />;
	return <HandicapForm initial={settings.handicapIndex} />;
}

function HandicapForm({ initial }: { initial: number | null }) {
	const { t, locale } = useI18n();
	const router = useRouter();
	const update = useMutation(api.settings.update);
	const [text, setText] = useState(() =>
		localizeDecimal(handicapText(initial), locale),
	);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	async function onSave() {
		const parsed = parseHandicap(text);
		if (!parsed.ok) {
			setError(t.profile.handicapInvalid);
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await update({ handicapIndex: parsed.value });
			router.back();
		} catch (e) {
			setError(convexErrorMessage(e, t.profile.saveError));
			setSaving(false);
		}
	}

	return (
		<>
			<ScreenHeader
				title={t.profile.handicap}
				action={{
					label: t.common.save,
					onPress: () => void onSave(),
					disabled: saving,
				}}
			/>
			<FormScreen>
				<FormSection footer={t.profile.handicapHint}>
					<FormTextField
						label={t.profile.handicap}
						value={text}
						onChangeText={(next) => {
							setText(next);
							setError(null);
						}}
						placeholder={t.profile.handicapPlaceholder}
						keyboardType="numbers-and-punctuation"
						returnKeyType="done"
						onSubmitEditing={() => void onSave()}
						autoFocus
						error={error ?? undefined}
					/>
				</FormSection>
			</FormScreen>
		</>
	);
}
