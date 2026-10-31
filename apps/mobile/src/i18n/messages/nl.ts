import { signInNl, signUpNl, verifyEmailNl } from "./auth";
import { commonNl, tabsNl } from "./common";
import type { Messages } from "./en";
import { coursesNl, homeNl, setupNl } from "./start";

export const nl = {
	common: commonNl,
	tabs: tabsNl,
	signIn: signInNl,
	signUp: signUpNl,
	verifyEmail: verifyEmailNl,
	home: homeNl,
	courses: coursesNl,
	setup: setupNl,
} satisfies Messages;
