import { signInNl, signUpNl, verifyEmailNl } from "./auth";
import { commonNl, tabsNl } from "./common";
import type { Messages } from "./en";
import { playNl } from "./play";
import { scorecardNl, scoreNl } from "./score";
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
	play: playNl,
	score: scoreNl,
	scorecard: scorecardNl,
} satisfies Messages;
