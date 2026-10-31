/**
 * Profile: golf settings that live on the account (handicap, distances, home
 * course, the bag), phone settings that live on the phone (appearance,
 * language, GPS while locked), and the account itself (report a problem, sign out, delete).
 */
import { useAuth, useUser } from "@clerk/expo";
import { useMutation } from "convex/react";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, View } from "react-native";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import {
	fmt,
	type Locale,
	localizeDecimal,
	plural,
	useI18n,
} from "../../../i18n";
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
import { convexErrorMessage, useConfirm } from "../../../ui/confirm-dialog";
import { FormSegmentedRow } from "../../../ui/form";
import { InsetList, InsetRow } from "../../../ui/inset-list";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import {
	backgroundLocationPreferred,
	setBackgroundLocationPreferred,
} from "../../location/background/background-location";
import { handicapText } from "./profile-model";

/** Language names are written in their own language. */
const LANGUAGES: { value: Locale; label: string }[] = [
	{ value: "en", label: "English" },
	{ value: "nl", label: "Nederlands" },
];

export function ProfileScreen() {
	const { t, locale, setLocale } = useI18n();
	const router = useRouter();
	const styles = useThemedStyles(createStyles);
	const toast = useToast();
	const confirm = useConfirm();
	const { preference, setPreference } = useAppearance();
	const { signOut } = useAuth();
	const { user } = useUser();
	const settings = useQuery(api.settings.get);
	const courses = useQuery(api.courses.list);
	const clubs = useQuery(api.clubs.list);
	const updateSettings = useMutation(api.settings.update);
	const deleteMyData = useMutation(api.account.deleteMyData);
	const [deleting, setDeleting] = useState(false);
	const [lockedGps, setLockedGps] = useState(backgroundLocationPreferred);

	async function onLockedGps(on: boolean) {
		setLockedGps(on);
		const result = await setBackgroundLocationPreferred(on);
		setLockedGps(result.on);
		if (result.needsSettings) {
			Alert.alert(t.profile.locationLocked, t.profile.locationLockedDenied);
		}
	}

	const homeCourse =
		settings?.homeCourseId && courses
			? courses.find((c) => c._id === settings.homeCourseId)?.name
			: undefined;

	async function setUnits(units: "m" | "yd") {
		try {
			await updateSettings({ units });
		} catch (e) {
			toast.error(convexErrorMessage(e, t.profile.saveError));
		}
	}

	async function onDeleteAccount() {
		const ok = await confirm({
			title: t.profile.deleteTitle,
			message: t.profile.deleteMessage,
			confirmLabel: t.profile.deleteConfirm,
			destructive: true,
		});
		if (!ok) return;
		setDeleting(true);
		try {
			// App data first, while the session can still authenticate.
			await deleteMyData({});
			await user?.delete();
		} catch (e) {
			setDeleting(false);
			toast.error(convexErrorMessage(e, t.profile.deleteError));
		}
	}

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={styles.content}
		>
			<InsetList compact header={t.profile.golf}>
				<InsetRow
					id="handicap"
					leading={{ symbol: "figure.golf" }}
					title={t.profile.handicap}
					value={
						settings?.handicapIndex == null
							? t.profile.handicapUnset
							: localizeDecimal(handicapText(settings.handicapIndex), locale)
					}
					chevron
					onPress={() => router.push("/profile/handicap")}
				/>
				<InsetRow
					id="home-course"
					leading={{ symbol: "house" }}
					title={t.profile.homeCourse}
					value={homeCourse ?? t.profile.homeCourseNone}
					chevron
					onPress={() => router.push("/profile/home-course")}
				/>
				<InsetRow
					id="clubs"
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
						value={settings?.units ?? "m"}
						onChange={(units) => void setUnits(units)}
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

			<InsetList compact footer={t.profile.locationLockedHint}>
				<InsetRow
					id="locked-gps"
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
				compact
				header={t.profile.account}
				footer={fmt(t.profile.version, {
					v: Constants.expoConfig?.version ?? "–",
				})}
			>
				{user?.primaryEmailAddress ? (
					<InsetRow
						id="email"
						leading={{ symbol: "person.crop.circle" }}
						title={user.primaryEmailAddress.emailAddress}
					/>
				) : null}
				<InsetRow
					id="report"
					leading={{ symbol: "exclamationmark.bubble" }}
					title={t.profile.report}
					onPress={() => {
						if (!openProblemReport()) {
							Alert.alert(t.profile.report, t.profile.reportUnavailable);
						}
					}}
				/>
				<InsetRow
					id="sign-out"
					title={t.profile.signOut}
					destructive
					onPress={() => void signOut()}
				/>
				<InsetRow
					id="delete"
					title={
						deleting ? `${t.profile.deleteAccount}…` : t.profile.deleteAccount
					}
					destructive
					onPress={deleting ? undefined : () => void onDeleteAccount()}
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
		// Lines up with the inset lists' own section headers.
		sectionHeader: { paddingHorizontal: spacing.md, color: colors.textMuted },
		card: { backgroundColor: colors.surface, borderRadius: radius.lg },
	});
