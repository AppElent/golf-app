/**
 * "Report a problem" (issue-reporting standard): opens Sentry User Feedback.
 * Returns false when the form can't open, so the caller shows the localized
 * fallback. Sentry isn't wired into this build yet (no DSN), so for now the
 * form is never available.
 */
export function openProblemReport(): boolean {
	return false;
}
