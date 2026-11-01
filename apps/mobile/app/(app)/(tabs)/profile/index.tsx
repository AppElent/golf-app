import { Stack } from "expo-router";
import { ProfileScreen } from "../../../../src/features/profile/settings/profile-screen";
import { useI18n } from "../../../../src/i18n";

export default function ProfileRoute() {
	const { t } = useI18n();
	return (
		<>
			<Stack.Screen options={{ title: t.profile.title }} />
			<ProfileScreen />
		</>
	);
}
