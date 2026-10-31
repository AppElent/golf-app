import { signInNl, signUpNl, verifyEmailNl } from "./auth";
import { commonNl, tabsNl } from "./common";
import type { Messages } from "./en";

export const nl = {
	common: commonNl,
	tabs: tabsNl,
	signIn: signInNl,
	signUp: signUpNl,
	verifyEmail: verifyEmailNl,
} satisfies Messages;
