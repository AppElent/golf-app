/**
 * Sign-in and sign-up alike: Clerk decides which one each provider attempt
 * turns out to be.
 *
 * Apple on iOS uses the system `AppleAuthenticationButton`: App Review
 * requires Apple's own artwork and approved styles, so it is not themed like
 * the others. It localizes itself from the device language.
 */
import * as AppleAuthentication from "expo-apple-authentication";
import { StyleSheet, View } from "react-native";

import { useI18n } from "../../../i18n";
import {
	spacing,
	type Tokens,
	useAppearance,
	useThemedStyles,
} from "../../../theme";
import { GhostButton } from "../../../ui/button";
import { AppText } from "../../../ui/text";
import { AuthMessage } from "./auth-form";
import {
	SOCIAL_PROVIDERS,
	useSocialSignIn,
	usesAppleSheet,
} from "./use-social-sign-in";

const BUTTON_HEIGHT = 50;

export function SocialButtons() {
	const copy = useI18n().t.signIn.social;
	const styles = useThemedStyles(createStyles);
	const { scheme } = useAppearance();
	const { start, pending, error } = useSocialSignIn();

	return (
		<View style={styles.root}>
			<View style={styles.rule}>
				<View style={styles.line} />
				<AppText variant="caption">{copy.or}</AppText>
				<View style={styles.line} />
			</View>
			{SOCIAL_PROVIDERS.map((provider) =>
				usesAppleSheet(provider) ? (
					<View
						key={provider}
						pointerEvents={pending ? "none" : "auto"}
						style={pending && styles.disabled}
					>
						<AppleAuthentication.AppleAuthenticationButton
							buttonType={
								AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
							}
							buttonStyle={
								scheme === "dark"
									? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
									: AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
							}
							cornerRadius={BUTTON_HEIGHT / 2}
							style={styles.apple}
							onPress={() => start(provider)}
						/>
					</View>
				) : (
					<GhostButton
						key={provider}
						label={copy[provider]}
						loading={pending === provider}
						disabled={pending !== null && pending !== provider}
						onPress={() => start(provider)}
					/>
				),
			)}
			<AuthMessage message={error} />
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { gap: spacing.sm, marginTop: spacing.sm },
		rule: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
		line: {
			flex: 1,
			height: StyleSheet.hairlineWidth,
			backgroundColor: colors.border,
		},
		apple: { height: BUTTON_HEIGHT, width: "100%" },
		disabled: { opacity: 0.5 },
	});
