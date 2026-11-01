// Sentry's wrapper around Expo's default config: it stamps each bundle with a
// debug ID so uploaded source maps resolve the exact build that crashed.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);
