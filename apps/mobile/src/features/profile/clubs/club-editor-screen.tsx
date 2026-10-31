/** Add a club, or edit one (`clubId` param): name and carry in metres. */
import { useMutation } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { api, type Doc, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { useI18n } from "../../../i18n";
import { convexErrorMessage } from "../../../ui/confirm-dialog";
import { FormScreen, FormSection, FormTextField } from "../../../ui/form";
import { ScreenHeader } from "../../../ui/screen-header";
import { SkeletonList } from "../../../ui/skeleton";
import { parseCarry } from "../settings/profile-model";

export function ClubEditorScreen() {
	const { clubId } = useLocalSearchParams<{ clubId?: string }>();
	const clubs = useQuery(api.clubs.list);
	if (clubId && clubs === undefined) return <SkeletonList rows={2} />;
	const club = clubId ? clubs?.find((c) => c._id === clubId) : undefined;
	return <ClubForm key={club?._id ?? "new"} club={club} />;
}

function ClubForm({ club }: { club?: Doc<"clubs"> }) {
	const { t } = useI18n();
	const router = useRouter();
	const create = useMutation(api.clubs.create);
	const update = useMutation(api.clubs.update);
	const [name, setName] = useState(club?.name ?? "");
	const [carry, setCarry] = useState(club ? String(club.carryMeters) : "");
	const [errors, setErrors] = useState<{
		name?: string;
		carry?: string;
		save?: string;
	}>({});
	const [saving, setSaving] = useState(false);

	async function onSave() {
		const parsed = parseCarry(carry);
		const next = {
			name: name.trim() === "" ? t.clubs.nameRequired : undefined,
			carry: parsed.ok ? undefined : t.clubs.carryInvalid,
		};
		setErrors(next);
		if (next.name || next.carry || !parsed.ok) return;
		setSaving(true);
		try {
			if (club) {
				await update({
					clubId: club._id as Id<"clubs">,
					name: name.trim(),
					carryMeters: parsed.value,
				});
			} else {
				await create({ name: name.trim(), carryMeters: parsed.value });
			}
			router.back();
		} catch (e) {
			setErrors({ save: convexErrorMessage(e, t.clubs.saveError) });
			setSaving(false);
		}
	}

	return (
		<>
			<ScreenHeader
				title={club ? t.clubs.edit : t.clubs.add}
				action={{
					label: t.common.save,
					onPress: () => void onSave(),
					disabled: saving,
				}}
			/>
			<FormScreen>
				<FormSection footer={errors.save}>
					<FormTextField
						label={t.clubs.name}
						value={name}
						onChangeText={setName}
						placeholder={t.clubs.namePlaceholder}
						autoFocus={!club}
						returnKeyType="next"
						error={errors.name}
					/>
					<FormTextField
						label={`${t.clubs.carry} (m)`}
						value={carry}
						onChangeText={setCarry}
						placeholder="150"
						keyboardType="number-pad"
						error={errors.carry}
					/>
				</FormSection>
			</FormScreen>
		</>
	);
}
