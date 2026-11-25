import { parseHandicapIndex } from "@fairway/core/handicap";
import { Redirect, Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Platform } from "react-native";
import { useI18n } from "../../../i18n";
import { useTokens } from "../../../theme";
import {
	FormInlineTextRow,
	FormScreen,
	FormSection,
	TextAction,
} from "../../../ui/form";
import { NavHeader } from "../../../ui/nav-header";
import { AppText } from "../../../ui/text";
import { type PlayerEdit, usePlayerEditor } from "./use-player-editor";

/** The `Speler` sheet over round setup: one player's name and handicap. */
export function PlayerEditorScreen() {
	const { edit } = usePlayerEditor();
	if (edit === null) return <Redirect href="/" />;
	return <PlayerEditor edit={edit} />;
}

function PlayerEditor({ edit }: { edit: PlayerEdit }) {
	const { t } = useI18n();
	const colors = useTokens();
	const router = useRouter();
	const [draft, setDraft] = useState(edit.initial);
	const valid = parseHandicapIndex(draft.index).valid;
	const dirty =
		draft.name !== edit.initial.name || draft.index !== edit.initial.index;

	const onDone = () => {
		if (!valid) return;
		edit.onSave(draft);
		router.back();
	};

	return (
		<>
			<NavHeader
				title={t.setup.playerTitle}
				left={{ label: t.common.cancel, onPress: () => router.back() }}
				right={{ label: t.common.done, onPress: onDone, disabled: !valid }}
			/>
			{/* A swipe never drops typed changes; Cancel does. */}
			<Stack.Screen options={{ gestureEnabled: !dirty }} />
			<FormScreen nativeSheet={Platform.OS === "ios"}>
				<FormSection footer={valid ? edit.footer(draft.index) : undefined}>
					<FormInlineTextRow
						label={t.setup.guestName}
						value={edit.nameLocked ? edit.namePlaceholder : draft.name}
						placeholder={edit.namePlaceholder}
						editable={!edit.nameLocked}
						onChangeText={(name) => setDraft((prev) => ({ ...prev, name }))}
						autoCapitalize="words"
						autoCorrect={false}
					/>
					<FormInlineTextRow
						label={t.setup.playerHandicap}
						accessibilityLabel={t.setup.handicapIndex}
						value={draft.index}
						placeholder="–"
						// Not decimal-pad: it has no "+" for a plus handicap.
						keyboardType="numbers-and-punctuation"
						autoCorrect={false}
						spellCheck={false}
						returnKeyType="done"
						onChangeText={(index) => setDraft((prev) => ({ ...prev, index }))}
						onSubmitEditing={onDone}
					/>
				</FormSection>
				{valid ? null : (
					<AppText
						selectable
						variant="footnote"
						accessibilityRole="alert"
						style={{ color: colors.danger }}
					>
						{t.profile.handicapInvalid}
					</AppText>
				)}
				{edit.onRemove ? (
					<FormSection>
						<TextAction
							label={t.setup.removePlayer}
							destructive
							onPress={() => {
								edit.onRemove?.();
								router.back();
							}}
						/>
					</FormSection>
				) : null}
			</FormScreen>
		</>
	);
}
