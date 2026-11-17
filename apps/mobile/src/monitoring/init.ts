/**
 * Starts Sentry. Imported first by `app/_layout.tsx` so a crash during the
 * rest of module evaluation is still reported. A no-op without
 * `EXPO_PUBLIC_SENTRY_DSN` (only preview/production EAS builds have one), and
 * in a development bundle unless `EXPO_PUBLIC_SENTRY_DEBUG=1`.
 *
 * Static dot access on `process.env` is load-bearing: Metro inlines
 * `EXPO_PUBLIC_*` textually at bundle time.
 */
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import {
	buildSentryOptions,
	environmentFromChannel,
	shouldInitSentry,
} from "./options";
import { sentryRelease } from "./release";

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

if (dsn && sentryEnabled) {
	Sentry.init(
		buildSentryOptions({
			dsn,
			environment: environmentFromChannel(Updates.channel, __DEV__),
			release: sentryRelease(
				Constants.expoConfig?.version,
				process.env.EXPO_PUBLIC_COMMIT_SHA,
			),
		}),
	);
}
