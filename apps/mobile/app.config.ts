/**
 * One identity per EAS profile, so production, preview and development builds
 * install side by side. `app.json` holds everything shared; this file only
 * swaps the per-variant name, scheme, bundle ID, package and icon (a DEV or
 * PREVIEW badge; see `assets/images/README.md`).
 *
 * `APP_VARIANT` is set per profile in `eas.json`. Unset means a local
 * development build, so a local run never replaces a store install.
 */
import type { ConfigContext, ExpoConfig } from "expo/config";

type AppVariant = "development" | "preview" | "production";

const VARIANTS = {
	production: { suffix: "", name: "Fairway", scheme: "fairway", icon: "" },
	preview: {
		suffix: ".preview",
		name: "Fairway Preview",
		scheme: "fairway-preview",
		icon: "-preview",
	},
	development: {
		suffix: ".dev",
		name: "Fairway Dev",
		scheme: "fairway-dev",
		icon: "-dev",
	},
} as const satisfies Record<AppVariant, object>;

function appVariant(): AppVariant {
	const value = process.env.APP_VARIANT;
	if (!value) return "development";
	if (value in VARIANTS) return value as AppVariant;
	throw new Error(`Unknown APP_VARIANT "${value}"`);
}

export default ({ config }: ConfigContext): ExpoConfig => {
	const variant = appVariant();
	const { suffix, name, scheme, icon } = VARIANTS[variant];
	const id = `com.appelent.fairway${suffix}`;
	return {
		...config,
		name,
		slug: "fairway",
		scheme,
		icon: `./assets/images/icon${icon}.png`,
		ios: { ...config.ios, bundleIdentifier: id },
		android: {
			...config.android,
			package: id,
			adaptiveIcon: {
				...config.android?.adaptiveIcon,
				foregroundImage: `./assets/images/android-icon-foreground${icon}.png`,
			},
			config: {
				...config.android?.config,
				// Google Maps SDK key for the satellite hole view on Android
				// (iOS uses Apple Maps, no key). Build-time, not EXPO_PUBLIC_.
				googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY },
			},
		},
		extra: { ...config.extra, appVariant: variant },
	};
};
