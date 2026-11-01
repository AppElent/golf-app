/**
 * "Report a problem" (issue-reporting standard): opens Sentry User Feedback.
 * Returns false when the form can't open — a development bundle, or a build
 * without a DSN — so the caller shows the localized fallback.
 */
import * as Sentry from "@sentry/react-native";
import { sentryEnabled } from "./init";

export function openProblemReport(): boolean {
	if (!sentryEnabled) return false;
	Sentry.showFeedbackWidget();
	return true;
}
