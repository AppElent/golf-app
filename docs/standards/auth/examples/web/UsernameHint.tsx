/**
 * Tells password managers which account a password-only form belongs to.
 *
 * Put one inside every form that sets a password without showing the
 * identifier: the reset step after the code, and change password. Without it,
 * iCloud Keychain, 1Password and Chrome cannot match the new password to the
 * saved login, so they save a second entry or skip the update. `hidden` keeps
 * it out of the layout and the accessibility tree; managers still read it.
 */
export function UsernameHint({ username }: { username: string }) {
	return (
		<input
			hidden
			readOnly
			type="text"
			name="username"
			autoComplete="username"
			value={username}
		/>
	);
}
