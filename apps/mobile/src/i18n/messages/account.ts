/**
 * Clerk error messages, the forgotten-password flow, and the account screens
 * behind Profile (name, email addresses, password).
 */

export const authErrorsEn = {
	generic: "Something went wrong. Please try again.",
	identifierNotFound: "No account found with that email.",
	passwordIncorrect: "That password is not right.",
	noPassword:
		"This account has no password. Use Apple, Microsoft or an email code instead.",
	identifierExists: "An account with that email already exists.",
	passwordTooShort: "That password is too short. Use at least 8 characters.",
	passwordPwned: "That password has appeared in a data breach. Choose another.",
	passwordWeak: "That password is not strong enough.",
	codeIncorrect: "That code is not right.",
	codeExpired: "That code has expired. Send a new one.",
	emailInvalid: "Enter a valid email address.",
	required: "This field is required.",
	tooManyRequests: "Too many attempts. Try again in a moment.",
	network: "Network error. Check your connection and try again.",
	appleIncomplete:
		"Apple sign-in didn't finish. Check that you're signed in to your Apple Account in Settings.",
	reverify:
		"For your security, sign out and sign in again, then try once more.",
	signInStep:
		"Sign-in needs another step this app doesn't support yet. Try the web app instead.",
};

export const authErrorsNl: typeof authErrorsEn = {
	generic: "Er ging iets mis. Probeer het opnieuw.",
	identifierNotFound: "Geen account gevonden met dat e-mailadres.",
	passwordIncorrect: "Dat wachtwoord klopt niet.",
	noPassword:
		"Dit account heeft geen wachtwoord. Gebruik Apple, Microsoft of een e-mailcode.",
	identifierExists: "Er bestaat al een account met dat e-mailadres.",
	passwordTooShort: "Dat wachtwoord is te kort. Gebruik minstens 8 tekens.",
	passwordPwned: "Dat wachtwoord is bij een datalek uitgelekt. Kies een ander.",
	passwordWeak: "Dat wachtwoord is niet sterk genoeg.",
	codeIncorrect: "Die code klopt niet.",
	codeExpired: "Die code is verlopen. Vraag een nieuwe aan.",
	emailInvalid: "Vul een geldig e-mailadres in.",
	required: "Dit veld is verplicht.",
	tooManyRequests: "Te veel pogingen. Probeer het zo opnieuw.",
	network: "Netwerkfout. Controleer je verbinding en probeer opnieuw.",
	appleIncomplete:
		"Inloggen met Apple is niet afgerond. Controleer in Instellingen of je bent ingelogd met je Apple-account.",
	reverify:
		"Voor je veiligheid: log uit en weer in, en probeer het daarna opnieuw.",
	signInStep:
		"Inloggen vraagt nog een stap die deze app nog niet ondersteunt. Probeer de webapp.",
};

export const resetPasswordEn = {
	forgot: "Forgot password?",
	title: "Reset password",
	subtitle: "Enter your email and we'll send you a code to set a new password.",
	email: "Email",
	sendCode: "Send code",
	backToSignIn: "Back to sign in",
	codeTitle: "Set a new password",
	codeSubtitle: "We sent a 6-digit code to {email}.",
	code: "Code",
	newPassword: "New password",
	submit: "Save and sign in",
	resend: "Send a new code",
	resent: "A new code is on its way.",
	changeEmail: "Use a different email",
	saved: "Your new password is saved.",
	finishSignIn: "Sign in",
	changedNeedsStep:
		"Your password is changed, but this account needs another sign-in step this app doesn't support yet. Sign in on the web app.",
};

export const resetPasswordNl: typeof resetPasswordEn = {
	forgot: "Wachtwoord vergeten?",
	title: "Wachtwoord herstellen",
	subtitle:
		"Vul je e-mailadres in, dan sturen we een code om een nieuw wachtwoord in te stellen.",
	email: "E-mail",
	sendCode: "Code sturen",
	backToSignIn: "Terug naar inloggen",
	codeTitle: "Nieuw wachtwoord instellen",
	codeSubtitle: "We hebben een code van 6 cijfers gestuurd naar {email}.",
	code: "Code",
	newPassword: "Nieuw wachtwoord",
	submit: "Opslaan en inloggen",
	resend: "Stuur een nieuwe code",
	resent: "Er is een nieuwe code onderweg.",
	changeEmail: "Ander e-mailadres gebruiken",
	saved: "Je nieuwe wachtwoord is opgeslagen.",
	finishSignIn: "Inloggen",
	changedNeedsStep:
		"Je wachtwoord is gewijzigd, maar dit account vraagt nog een inlogstap die deze app nog niet ondersteunt. Log in via de webapp.",
};

export const accountEn = {
	name: "Name",
	nameUnset: "Not set",
	firstName: "First name",
	lastName: "Last name",
	nameHint: "Shown on your account. Leave both empty to remove your name.",
	nameSaved: "Name saved.",
	email: "Email",
	emails: "Email addresses",
	emailsHint:
		"You sign in with your primary address. Swipe or touch and hold an address for its actions.",
	primary: "Primary",
	unverified: "Unverified",
	addEmail: "Add email address",
	newEmail: "New email address",
	addEmailHint:
		"We'll send a code to this address to confirm it's yours. Then you can make it your primary address.",
	continue: "Continue",
	verifyTitle: "Verify email",
	verifyHint: "Enter the 6-digit code we sent to {email}.",
	code: "Code",
	verify: "Verify",
	resend: "Send a new code",
	resent: "A new code is on its way.",
	verified: "{email} is verified.",
	makePrimary: "Make primary",
	makePrimaryTitle: "Make {email} your primary address?",
	makePrimaryMessage: "You'll sign in with it from now on.",
	primaryChanged: "{email} is now your primary address.",
	removeOldTitle: "Remove {email}?",
	removeOldMessage: "You can no longer sign in with it.",
	remove: "Remove",
	removeTitle: "Remove {email}?",
	removed: "{email} is removed.",
	verifyAction: "Verify",
	password: "Password",
	changePassword: "Change password",
	setPassword: "Set password",
	currentPassword: "Current password",
	newPassword: "New password",
	passwordHint: "Use at least 8 characters.",
	setPasswordHint:
		"You sign in with Apple, Google, Microsoft or an email code. A password lets you sign in with your email too. Use at least 8 characters.",
	signOutOthers: "Sign out other devices",
	signOutOthersHint:
		"Signs you out everywhere except this phone, for example after a lost device.",
	passwordChanged: "Password changed.",
	passwordAdded: "Password set.",
	reverifyTitle: "Confirm it's you",
	confirm: "Confirm",
	reverifyPasswordHint:
		"For your security, enter your password before you change your email or password.",
	reverifyCodeHint:
		"For your security, enter the 6-digit code we sent to {email} before you change your email or password.",
};

export const accountNl: typeof accountEn = {
	name: "Naam",
	nameUnset: "Niet ingesteld",
	firstName: "Voornaam",
	lastName: "Achternaam",
	nameHint:
		"Zichtbaar op je account. Laat beide leeg om je naam te verwijderen.",
	nameSaved: "Naam opgeslagen.",
	email: "E-mail",
	emails: "E-mailadressen",
	emailsHint:
		"Je logt in met je primaire adres. Veeg over een adres of houd het vast voor de acties.",
	primary: "Primair",
	unverified: "Niet bevestigd",
	addEmail: "E-mailadres toevoegen",
	newEmail: "Nieuw e-mailadres",
	addEmailHint:
		"We sturen een code naar dit adres om te bevestigen dat het van jou is. Daarna kun je het je primaire adres maken.",
	continue: "Doorgaan",
	verifyTitle: "E-mail bevestigen",
	verifyHint: "Vul de code van 6 cijfers in die we naar {email} stuurden.",
	code: "Code",
	verify: "Bevestigen",
	resend: "Stuur een nieuwe code",
	resent: "Er is een nieuwe code onderweg.",
	verified: "{email} is bevestigd.",
	makePrimary: "Primair maken",
	makePrimaryTitle: "{email} je primaire adres maken?",
	makePrimaryMessage: "Je logt er voortaan mee in.",
	primaryChanged: "{email} is nu je primaire adres.",
	removeOldTitle: "{email} verwijderen?",
	removeOldMessage: "Je kunt er dan niet meer mee inloggen.",
	remove: "Verwijderen",
	removeTitle: "{email} verwijderen?",
	removed: "{email} is verwijderd.",
	verifyAction: "Bevestigen",
	password: "Wachtwoord",
	changePassword: "Wachtwoord wijzigen",
	setPassword: "Wachtwoord instellen",
	currentPassword: "Huidig wachtwoord",
	newPassword: "Nieuw wachtwoord",
	passwordHint: "Gebruik minstens 8 tekens.",
	setPasswordHint:
		"Je logt in met Apple, Google, Microsoft of een e-mailcode. Met een wachtwoord kun je ook met je e-mailadres inloggen. Gebruik minstens 8 tekens.",
	signOutOthers: "Andere apparaten uitloggen",
	signOutOthersHint:
		"Logt je overal uit behalve op deze telefoon, bijvoorbeeld na een verloren apparaat.",
	passwordChanged: "Wachtwoord gewijzigd.",
	passwordAdded: "Wachtwoord ingesteld.",
	reverifyTitle: "Bevestig dat jij het bent",
	confirm: "Bevestigen",
	reverifyPasswordHint:
		"Voor je veiligheid: vul je wachtwoord in voordat je je e-mailadres of wachtwoord wijzigt.",
	reverifyCodeHint:
		"Voor je veiligheid: vul de code van 6 cijfers in die we naar {email} stuurden, voordat je je e-mailadres of wachtwoord wijzigt.",
};
