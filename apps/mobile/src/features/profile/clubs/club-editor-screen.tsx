import { clubDistances } from "@fairway/core/shots";
import { useMutation } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { api, type Doc, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { useSubmit } from "../../../convex/use-submit";
import { fmt, useI18n } from "../../../i18n";
import { GhostButton } from "../../../ui/button";
import { FormScreen, FormSection, FormTextField } from "../../../ui/form";
import { NavHeader } from "../../../ui/nav-header";
import { SkeletonList } from "../../../ui/skeleton";
import { parseCarry } from "./club-model";

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
	const submit = useSubmit();
	const shots = useQuery(api.shots.mine);
	const learned = club
		? clubDistances(shots ?? []).find((d) => d.club === club.name)
		: undefined;

	async function onSave() {
		const parsed = parseCarry(carry);
		const next = {
			name: name.trim() === "" ? t.clubs.nameRequired : undefined,
			carry: parsed.ok ? undefined : t.clubs.carryInvalid,
		};
		setErrors(next);
		if (next.name || next.carry || !parsed.ok) return;
		await submit.run(
			() =>
				club
					? update({
							clubId: club._id as Id<"clubs">,
							name: name.trim(),
							carryMeters: parsed.value,
						})
					: create({ name: name.trim(), carryMeters: parsed.value }),
			{
				errorFallback: t.clubs.saveError,
				onSuccess: () => router.back(),
				onError: (save) => setErrors({ save }),
			},
		);
	}

	return (
		<>
			<NavHeader
				title={club ? t.clubs.edit : t.clubs.add}
				right={{
					label: t.common.save,
					onPress: () => void onSave(),
					disabled: submit.pending,
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
				{learned ? (
					<FormSection
						footer={fmt(t.clubs.learned, {
							median: learned.medianMeters,
							count: learned.shots,
							low: learned.lowMeters,
							high: learned.highMeters,
						})}
					>
						<GhostButton
							label={fmt(t.clubs.useLearned, { median: learned.medianMeters })}
							onPress={() => setCarry(String(learned.medianMeters))}
							disabled={carry === String(learned.medianMeters)}
						/>
					</FormSection>
				) : null}
			</FormScreen>
		</>
	);
}
