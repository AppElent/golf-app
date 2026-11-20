/**
 * Shake to report a problem, but never over a sheet, modal or system alert.
 *
 * Sentry's feedback form is a React Native `Modal` mounted at the app root, so
 * iOS presents it from the root view controller. While something else is
 * already presented there (a `formSheet` or `modal` route, any other `Modal`,
 * an alert, an action sheet or the share sheet), UIKit refuses the second
 * presentation and only the form's dark backdrop renders, with no way to close
 * it (Foundry APP-216, APP-258). So the shake listener runs only while nothing
 * is presented: every sheet and modal holds a blocker for as long as it is
 * visible, and a shake during that time does nothing. Imperative native
 * presentations hold one through `native-presentation`.
 *
 * Copied from Foundry (AppElent/workouts `src/observability/shake-to-report.ts`).
 */

import * as Sentry from "@sentry/react-native";
import { useEffect } from "react";
import { Platform } from "react-native";

/** A sheet still animates out after it leaves state; shake waits for that. */
export const DISMISS_SETTLE_MS = 600;

let blockers = 0;
let started = false;
let listening = false;

function sync() {
	const shouldListen = started && blockers === 0;
	if (shouldListen === listening) return;
	listening = shouldListen;
	if (shouldListen) Sentry.enableFeedbackOnShake();
	else Sentry.disableFeedbackOnShake();
}

/** Turns shake-to-report on. Call once, after `Sentry.init`. */
export function startShakeToReport() {
	if (Platform.OS === "web") return;
	started = true;
	sync();
}

/**
 * Pauses shake-to-report until the returned release runs, then for
 * `DISMISS_SETTLE_MS` more. For imperative native presentations (alerts, action
 * sheets, the share sheet); release is idempotent, so call it on every exit path.
 */
export function holdShakeToReport(): () => void {
	blockers += 1;
	sync();
	let released = false;
	return () => {
		if (released) return;
		released = true;
		setTimeout(() => {
			// Clamped: a Fast Refresh of this module resets the count under
			// still-held blockers.
			blockers = Math.max(0, blockers - 1);
			sync();
		}, DISMISS_SETTLE_MS);
	};
}

/** Pauses shake-to-report while `active` is true, for a visible sheet or modal. */
export function useShakeToReportBlocker(active: boolean) {
	useEffect(() => {
		if (!active) return;
		return holdShakeToReport();
	}, [active]);
}

/** Native-stack presentations that cover the screen with a presented controller. */
const PRESENTED = new Set([
	"modal",
	"transparentModal",
	"containedModal",
	"containedTransparentModal",
	"fullScreenModal",
	"formSheet",
	"pageSheet",
]);

export function isPresentedRoute(presentation: string | undefined) {
	return presentation !== undefined && PRESENTED.has(presentation);
}

/** Test-only: forget all state between tests. */
export function resetShakeToReportForTests() {
	blockers = 0;
	started = false;
	listening = false;
}
