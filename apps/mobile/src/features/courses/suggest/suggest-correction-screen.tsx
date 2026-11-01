/**
 * "Suggest a correction" for a catalog course: one free-text field, sent to
 * Convex (`courses.suggest`) for a maintainer to review against the club's
 * scorecard. Presented as a sheet over round setup.
 */
import { useMutation } from "convex/react";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Button, Platform, StyleSheet } from "react-native";
import { api, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { haptics } from "../../../feedback/haptics";
import { useI18n } from "../../../i18n";
import { useTokens } from "../../../theme";
import { convexErrorMessage } from "../../../ui/confirm-dialog";
import { FormScreen, FormSection, FormTextField } from "../../../ui/form";
import { useToast } from "../../../ui/toast";

const MAX_LENGTH = 2000;

export function SuggestCorrectionScreen({
	courseId,
}: {
	courseId: Id<"courses">;
}) {
	const router = useRouter();
	const { t } = useI18n();
	const toast = useToast();
	const colors = useTokens();
	const detail = useQuery(api.courses.get, { courseId });
	const suggest = useMutation(api.courses.suggest);
	const [message, setMessage] = useState("");
	const [sending, setSending] = useState(false);

	const send = async () => {
		setSending(true);
		try {
			await suggest({ courseId, message });
			haptics.entryLogged();
			toast.success(t.suggest.sent);
			router.back();
		} catch (e) {
			toast.error(convexErrorMessage(e, t.suggest.error));
		} finally {
			setSending(false);
		}
	};

	return (
		<>
			<Stack.Screen
				options={{
					title: t.suggest.title,
					...(Platform.OS !== "ios"
						? {
								headerLeft: () => (
									<Button
										title={t.common.cancel}
										onPress={() => router.back()}
										color={colors.accent}
									/>
								),
							}
						: {}),
				}}
			/>
			{Platform.OS === "ios" ? (
				<Stack.Toolbar placement="left">
					<Stack.Toolbar.Button onPress={() => router.back()}>
						{t.common.cancel}
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
			<FormScreen
				primaryAction={{
					label: t.suggest.send,
					onPress: send,
					loading: sending,
					disabled: message.trim() === "",
				}}
			>
				<FormSection title={detail?.course.name} footer={t.suggest.footer}>
					<FormTextField
						label={t.suggest.label}
						placeholder={t.suggest.placeholder}
						value={message}
						onChangeText={setMessage}
						multiline
						maxLength={MAX_LENGTH}
						autoFocus
						style={styles.input}
					/>
				</FormSection>
			</FormScreen>
		</>
	);
}

const styles = StyleSheet.create({
	input: { minHeight: 120, textAlignVertical: "top" },
});
