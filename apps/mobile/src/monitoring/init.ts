/**
 * Starts Sentry. Imported first by `app/_layout.tsx` so a crash during the
 * rest of module evaluation is still reported. A no-op without
 * `EXPO_PUBLIC_SENTRY_DSN` (only preview/production EAS builds have one), and
 * in a development bundle unless `EXPO_PUBLIC_SENTRY_DEBUG=1`. Also owns the
 * "Report a problem" form and starts shake-to-report.
 *
 * Static dot access on `process.env` is load-bearing: Metro inlines
 * `EXPO_PUBLIC_*` textually at bundle time.
 */
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import type { Locale } from "../i18n";
import { en } from "../i18n/messages/en";
import { nl } from "../i18n/messages/nl";
// tokens.ts, not the theme index: the index loads the appearance store, which
// must not run before Sentry starts.
import { darkColors, lightColors } from "../theme/tokens";
import {
	buildSentryOptions,
	environmentFromChannel,
	FEEDBACK_OPTIONS,
	feedbackLabels,
	feedbackTheme,
	sanitizeFeedbackEvent,
	shouldInitSentry,
} from "./options";
import { sentryRelease } from "./release";
import { startShakeToReport } from "./shake-to-report";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** Whether this bundle reports to Sentry; gate `Sentry.wrap` on it. */
export const sentryEnabled = Boolean(
	dsn &&
		shouldInitSentry({
			dsn,
			dev: __DEV__,
			debug: process.env.EXPO_PUBLIC_SENTRY_DEBUG,
		}),
);

const MESSAGES = { en, nl };

const feedback = Sentry.feedbackIntegration({
	...FEEDBACK_OPTIONS,
	themeLight: feedbackTheme(lightColors),
	themeDark: feedbackTheme(darkColors),
});

/** Keeps the feedback form in the language the app is showing. */
export function setFeedbackLocale(locale: Locale) {
	const text = MESSAGES[locale].feedback;
	Object.assign(feedback.options, feedbackLabels(text));
	Object.assign(feedback.screenshotButtonOptions, {
		triggerLabel: text.take,
		triggerAriaLabel: text.take,
	});
}
setFeedbackLocale("en");

if (dsn && sentryEnabled) {
	Sentry.init({
		...buildSentryOptions({
			dsn,
			environment: environmentFromChannel(Updates.channel, __DEV__),
			release: sentryRelease(
				Constants.expoConfig?.version,
				process.env.EXPO_PUBLIC_COMMIT_SHA,
			),
		}),
		integrations: [feedback],
	});
	// Feedback skips beforeSend; strip contact fields and query strings here.
	Sentry.addEventProcessor(sanitizeFeedbackEvent);
	startShakeToReport();
}
