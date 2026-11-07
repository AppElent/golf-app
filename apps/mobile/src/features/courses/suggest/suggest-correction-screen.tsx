import { MAX_SUGGESTION_LENGTH } from "@fairway/core/course-suggestion";
import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { api, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { useSubmit } from "../../../convex/use-submit";
import { haptics } from "../../../feedback/haptics";
import { useI18n } from "../../../i18n";
import { FormScreen, FormSection, FormTextField } from "../../../ui/form";
import { NavHeader } from "../../../ui/nav-header";
import { useToast } from "../../../ui/toast";

export function SuggestCorrectionScreen({
	courseId,
}: {
	courseId: Id<"courses">;
}) {
	const router = useRouter();
	const { t } = useI18n();
	const toast = useToast();
	const detail = useQuery(api.courses.get, { courseId });
	const suggest = useMutation(api.courses.suggest);
	const [message, setMessage] = useState("");
	const submit = useSubmit();

	const send = () =>
		submit.run(
			async () => {
				await suggest({ courseId, message });
				// Confirmed even after the sheet was cancelled: the suggestion went.
				haptics.saveConfirmed();
				toast.success(t.suggest.sent);
			},
			{
				errorFallback: t.suggest.error,
				onSuccess: () => router.back(),
				onError: (text) => toast.error(text),
			},
		);

	return (
		<>
			<NavHeader
				title={t.suggest.title}
				left={{ label: t.common.cancel, onPress: () => router.back() }}
			/>
			<FormScreen
				primaryAction={{
					label: t.suggest.send,
					onPress: send,
					loading: submit.pending,
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
						maxLength={MAX_SUGGESTION_LENGTH}
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
