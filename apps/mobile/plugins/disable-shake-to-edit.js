// Turns off iOS shake-to-undo (`applicationSupportsShakeToEdit`). Shake opens
// Sentry's report form (`src/monitoring/shake-to-report.ts`); with a text field
// edited, iOS also presents its "Undo Typing" alert, which blocks the form's
// modal and leaves its dimmed backdrop over a frozen app (Foundry workouts #95).
// Copied from Foundry (AppElent/workouts `apps/mobile/plugins`).
const { withAppDelegate } = require("expo/config-plugins");

const SETTING = "application.applicationSupportsShakeToEdit = false";
const ANCHOR =
	"return super.application(application, didFinishLaunchingWithOptions: launchOptions)";

module.exports = function disableShakeToEdit(config) {
	return withAppDelegate(config, (config) => {
		const { language, contents } = config.modResults;
		if (contents.includes(SETTING)) return config;
		if (language !== "swift" || !contents.includes(ANCHOR)) {
			throw new Error(
				"disable-shake-to-edit: AppDelegate.swift no longer matches; update the plugin's anchor.",
			);
		}
		config.modResults.contents = contents.replace(
			ANCHOR,
			`${SETTING}\n    ${ANCHOR}`,
		);
		return config;
	});
};
