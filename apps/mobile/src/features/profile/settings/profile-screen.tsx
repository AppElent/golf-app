import { useAuth, useUser } from "@clerk/expo";
import type { Units } from "@fairway/core/format";
import { useConvex, useMutation } from "convex/react";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import * as Updates from "expo-updates";
import { openBrowserAsync } from "expo-web-browser";
import { useState } from "react";
import { ScrollView, StyleSheet, Switch, View } from "react-native";
import { api } from "../../../convex/api";
import { convexErrorMessage } from "../../../convex/error-message";
import { clearLastKnown } from "../../../convex/last-known";
import { useQuery } from "../../../convex/query-cache";
import { fmt, type Locale, plural, useI18n } from "../../../i18n";
import { showAlert } from "../../../monitoring/native-presentation";
import { buildLabel, otaLabel } from "../../../monitoring/release";
import { openProblemReport } from "../../../monitoring/report-problem";
import {
	type AppearancePreference,
	metrics,
	radius,
	spacing,
	type Tokens,
	useAppearance,
	useThemedStyles,
} from "../../../theme";
import { FormSegmentedRow } from "../../../ui/form";
import { InsetList, InsetRow } from "../../../ui/inset-list";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import {
	backgroundLocationPreferred,
	setBackgroundLocationPreferred,
} from "../../location/background/background-location-preference";
import { displayName } from "../account/account-model";
import { AccountPortalRow } from "../account/account-portal-row";
import { useUnits } from "../use-units";
import { shareDataExport } from "./data-export";

/** Language names are written in their own language. */
const LANGUAGES: { value: Locale; label: string }[] = [
	{ value: "en", label: "English" },
	{ value: "nl", label: "Nederlands" },
];

/** The policy page on the web app; App Store Connect links the same URL. */
const PRIVACY_POLICY_URL = "https://fairway.appelent.nl/privacy";

export function ProfileScreen() {
	const { t, locale, numbers, setLocale } = useI18n();
	const router = useRouter();
	const styles = useThemedStyles(createStyles);
	const toast = useToast();
	const { preference, setPreference } = useAppearance();
	const { signOut } = useAuth();
	const { user } = useUser();
	const settings = useQuery(api.settings.get);
	const units = useUnits();
	const courses = useQuery(api.courses.list);
	const clubs = useQuery(api.clubs.list);
	const updateSettings = useMutation(api.settings.update);
	const convex = useConvex();
	const [exporting, setExporting] = useState(false);
	const [lockedGps, setLockedGps] = useState(backgroundLocationPreferred);

	async function onLockedGps(on: boolean) {
		setLockedGps(on);
		const result = await setBackgroundLocationPreferred(on);
		setLockedGps(result.on);
		if (result.needsSettings) {
			showAlert(t.profile.locationLocked, t.profile.locationLockedDenied);
		}
	}

	const homeCourse =
		settings?.homeCourseId && courses
			? courses.find((c) => c._id === settings.homeCourseId)?.name
			: undefined;

	async function setUnits(units: Units) {
		try {
			await updateSettings({ units });
		} catch (e) {
			toast.error(convexErrorMessage(e, t.profile.saveError));
		}
	}

	async function onExportData() {
		setExporting(true);
		try {
			await shareDataExport((step) =>
				convex.query(api.account.exportPage, { step }),
			);
		} catch (e) {
			toast.error(convexErrorMessage(e, t.profile.exportError));
		} finally {
			setExporting(false);
		}
	}

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={styles.content}
		>
			<InsetList header={t.profile.golf}>
				<InsetRow
					leading={{ symbol: "figure.golf" }}
					title={t.profile.handicap}
					value={
						settings?.handicapIndex == null
							? t.profile.handicapUnset
							: numbers.handicap(settings.handicapIndex)
					}
					chevron
					onPress={() => router.push("/profile/handicap")}
				/>
				<InsetRow
					leading={{ symbol: "house" }}
					title={t.profile.homeCourse}
					value={homeCourse ?? t.profile.homeCourseNone}
					chevron
					onPress={() => router.push("/profile/home-course")}
				/>
				<InsetRow
					leading={{ symbol: "bag" }}
					title={t.profile.clubs}
					value={
						clubs
							? plural(locale, clubs.length, t.profile.clubsCount)
							: undefined
					}
					chevron
					onPress={() => router.push("/profile/clubs")}
				/>
				<InsetRow
					leading={{ symbol: "location.viewfinder" }}
					title={t.simulator.title}
					chevron
					onPress={() => router.push("/profile/simulator")}
				/>
			</InsetList>

			<View style={styles.section}>
				<AppText variant="secondary" style={styles.sectionHeader}>
					{t.profile.app}
				</AppText>
				<View style={styles.card}>
					<FormSegmentedRow
						label={t.profile.units}
						options={[
							{ value: "m", label: t.profile.meters },
							{ value: "yd", label: t.profile.yards },
						]}
						value={units}
						onChange={(next) => void setUnits(next)}
					/>
					<FormSegmentedRow<AppearancePreference>
						label={t.profile.appearance}
						options={[
							{ value: "system", label: t.profile.appearanceSystem },
							{ value: "light", label: t.profile.appearanceLight },
							{ value: "dark", label: t.profile.appearanceDark },
						]}
						value={preference}
						onChange={(next) => {
							if (!setPreference(next)) toast.error(t.profile.saveError);
						}}
					/>
					<FormSegmentedRow<Locale>
						label={t.profile.language}
						options={LANGUAGES}
						value={locale}
						onChange={setLocale}
					/>
				</View>
			</View>

			<InsetList footer={t.profile.locationLockedHint}>
				<InsetRow
					leading={{ symbol: "location" }}
					title={t.profile.locationLocked}
					trailing={
						<Switch
							value={lockedGps}
							onValueChange={(on) => void onLockedGps(on)}
							accessibilityLabel={t.profile.locationLocked}
						/>
					}
				/>
			</InsetList>

			<InsetList
				header={t.profile.account}
				footer={fmt(t.profile.version, {
					v: buildLabel({
						version: Constants.expoConfig?.version,
						build: Application.nativeBuildVersion,
						channel: Updates.channel,
						updateId: Updates.updateId,
						embedded: Updates.isEmbeddedLaunch,
						noUpdate: t.profile.noUpdate,
						label: otaLabel({
							version: Constants.expoConfig?.version,
							createdAt: Updates.createdAt,
							commit: process.env.EXPO_PUBLIC_COMMIT_SHA,
							embedded: Updates.isEmbeddedLaunch,
						}),
					}),
				})}
			>
				<InsetRow
					leading={{ symbol: "person.crop.circle" }}
					title={t.account.name}
					value={
						displayName(user?.firstName, user?.lastName) ?? t.account.nameUnset
					}
					chevron
					onPress={() => router.push("/profile/name")}
				/>
				<InsetRow
					leading={{ symbol: "envelope" }}
					title={t.account.email}
					secondary={user?.primaryEmailAddress?.emailAddress}
					chevron
					onPress={() => router.push("/profile/emails")}
				/>
				<InsetRow
					leading={{ symbol: "key" }}
					title={
						user?.passwordEnabled
							? t.account.changePassword
							: t.account.setPassword
					}
					chevron
					onPress={() => router.push("/profile/password")}
				/>
				<AccountPortalRow />
				<InsetRow
					leading={{ symbol: "exclamationmark.bubble" }}
					title={t.profile.report}
					onPress={() => {
						if (!openProblemReport()) {
							showAlert(t.profile.report, t.profile.reportUnavailable);
						}
					}}
				/>
				<InsetRow
					leading={{ symbol: "hand.raised" }}
					title={t.profile.privacy}
					external
					onPress={() => {
						openBrowserAsync(PRIVACY_POLICY_URL).catch(() => {});
					}}
				/>
				<InsetRow
					leading={{ symbol: "square.and.arrow.up" }}
					title={exporting ? `${t.profile.exportData}…` : t.profile.exportData}
					onPress={exporting ? undefined : () => void onExportData()}
				/>
				<InsetRow
					title={t.profile.signOut}
					destructive
					onPress={() => {
						// Confirmed sign-out: delete the saved round copy and the
						// account marker (convex-query-caching, offline copy).
						clearLastKnown();
						void signOut();
					}}
				/>
				<InsetRow
					title={t.profile.deleteAccount}
					destructive
					chevron
					onPress={() => router.push("/profile/delete-account")}
				/>
			</InsetList>
		</ScrollView>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		content: {
			paddingHorizontal: metrics.screenGutter,
			paddingBottom: spacing.xxl,
			gap: spacing.lg,
		},
		section: { gap: spacing.sm },
		sectionHeader: { paddingHorizontal: spacing.md, color: colors.textMuted },
		card: { backgroundColor: colors.surface, borderRadius: radius.lg },
	});
