import { useClerk, useUser } from "@clerk/react";
import { useEffect, useState } from "react";
import { AppearanceSettings } from "./AppearanceSettings";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { AuthField } from "./AuthField";
import { UsernameHint } from "./UsernameHint";
import { clerkErrorMessage } from "./core";

type PasswordField = "current" | "new";

/**
 * Clerk reports a wrong current password as `form_password_validation_failed`
 * on `current_password`, the weak-new-password code too, so only the field
 * name tells them apart. Returns the field a refusal belongs to, or `null`.
 */
function passwordFailure(
	err: unknown,
): { field: PasswordField; message: string } | null {
	const list = (err as { errors?: unknown } | null)?.errors;
	const entries = (Array.isArray(list) ? list : []) as {
		code?: string;
		longMessage?: string;
		message?: string;
		meta?: { paramName?: string };
	}[];
	const wrongCurrent = entries.some(
		(e) =>
			e.code === "form_password_incorrect" ||
			(e.meta?.paramName === "current_password" &&
				e.code === "form_password_validation_failed"),
	);
	if (wrongCurrent) {
		return { field: "current", message: "That password is not right." };
	}
	const weak = entries.find((e) =>
		[
			"form_password_validation_failed",
			"form_password_length_too_short",
			"form_password_pwned",
		].includes(e.code ?? ""),
	);
	return weak
		? {
				field: "new",
				message:
					weak.longMessage ??
					weak.message ??
					"That password is not strong enough.",
			}
		: null;
}

export function ProfilePanel() {
	const { isLoaded, user } = useUser();
	const { signOut } = useClerk();
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [fieldError, setFieldError] = useState<{
		field: PasswordField;
		message: string;
	} | null>(null);
	const [passwordChanged, setPasswordChanged] = useState(false);
	const [savingProfile, setSavingProfile] = useState(false);
	const [savingPassword, setSavingPassword] = useState(false);

	useEffect(() => {
		if (user) {
			setFirstName(user.firstName ?? "");
			setLastName(user.lastName ?? "");
		}
	}, [user]);

	if (!isLoaded || !user) {
		return <p className="text-sm text-[var(--auth-muted)]">Loading…</p>;
	}

	async function saveProfile(e: React.FormEvent) {
		e.preventDefault();
		if (!user) {
			return;
		}
		setError(null);
		setSavingProfile(true);
		try {
			await user.update({ firstName, lastName });
		} catch (err) {
			setError(clerkErrorMessage(err));
		} finally {
			setSavingProfile(false);
		}
	}

	async function changePassword(e: React.FormEvent) {
		e.preventDefault();
		if (!user) {
			return;
		}
		setError(null);
		setFieldError(null);
		setPasswordChanged(false);
		setSavingPassword(true);
		try {
			// Changing the password ends every other session; this one stays.
			await user.updatePassword({
				currentPassword,
				newPassword,
				signOutOfOtherSessions: true,
			});
			setCurrentPassword("");
			setNewPassword("");
			setPasswordChanged(true);
		} catch (err) {
			const failure = passwordFailure(err);
			if (failure) {
				setFieldError(failure);
			} else {
				setError(clerkErrorMessage(err));
			}
		} finally {
			setSavingPassword(false);
		}
	}

	return (
		<div className="space-y-6">
			<AuthError message={error} />

			<section className="rm-panel p-4">
				<p className="rm-label">Profile</p>
				<form
					onSubmit={saveProfile}
					className="mt-3 flex flex-col gap-3"
					noValidate
				>
					<AuthField
						label="First name"
						type="text"
						value={firstName}
						onChange={setFirstName}
					/>
					<AuthField
						label="Last name"
						type="text"
						value={lastName}
						onChange={setLastName}
					/>
					<p className="text-xs text-[var(--auth-muted)]">
						Email: {user.primaryEmailAddress?.emailAddress}
					</p>
					<AuthButton loading={savingProfile}>Save profile</AuthButton>
				</form>
			</section>

			<section className="rm-panel p-4">
				<p className="rm-label">Security</p>
				{user.passwordEnabled ? (
					<form
						onSubmit={changePassword}
						className="mt-3 flex flex-col gap-3"
						noValidate
					>
						<UsernameHint
							username={user.primaryEmailAddress?.emailAddress ?? ""}
						/>
						<AuthField
							label="Current password"
							type="password"
							autoComplete="current-password"
							value={currentPassword}
							onChange={setCurrentPassword}
							error={
								fieldError?.field === "current" ? fieldError.message : undefined
							}
						/>
						<AuthField
							label="New password"
							type="password"
							autoComplete="new-password"
							value={newPassword}
							onChange={setNewPassword}
							error={
								fieldError?.field === "new" ? fieldError.message : undefined
							}
						/>
						<AuthButton loading={savingPassword}>Change password</AuthButton>
						{passwordChanged ? (
							<p role="status" className="text-sm text-[var(--auth-muted)]">
								Password changed. Your other devices are signed out.
							</p>
						) : null}
					</form>
				) : (
					// Social or emailed-code sign-in only: nothing to change.
					<p className="mt-3 text-sm text-[var(--auth-muted)]">
						This account signs in without a password, with another service or
						an emailed code, so there is no password to change.
					</p>
				)}
			</section>

			<AppearanceSettings />

			<section className="rm-panel p-4">
				<p className="rm-label">Session</p>
				<div className="mt-3">
					<AuthButton type="button" variant="ghost" onClick={() => signOut()}>
						Sign out
					</AuthButton>
				</div>
			</section>
		</div>
	);
}
