import { accountNl, authErrorsNl, resetPasswordNl } from "./account";
import { signInNl, signUpNl, verifyEmailNl } from "./auth";
import { commonNl, tabsNl } from "./common";
import type { Messages } from "./en";
import { clubsNl, profileNl, roundsNl, statsNl } from "./history";
import { playNl } from "./play";
import { scorecardNl, scoreNl } from "./score";
import { coursesNl, homeNl, setupNl, simulatorNl, suggestNl } from "./start";

export const nl = {
	common: commonNl,
	tabs: tabsNl,
	signIn: signInNl,
	signUp: signUpNl,
	verifyEmail: verifyEmailNl,
	resetPassword: resetPasswordNl,
	authErrors: authErrorsNl,
	home: homeNl,
	courses: coursesNl,
	setup: setupNl,
	suggest: suggestNl,
	simulator: simulatorNl,
	play: playNl,
	score: scoreNl,
	scorecard: scorecardNl,
	rounds: roundsNl,
	stats: statsNl,
	profile: profileNl,
	account: accountNl,
	clubs: clubsNl,
} satisfies Messages;
