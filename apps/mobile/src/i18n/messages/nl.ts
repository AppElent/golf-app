import { signInNl, signUpNl, verifyEmailNl } from "./auth";
import { commonNl, tabsNl } from "./common";
import type { Messages } from "./en";
import { clubsNl, profileNl, roundsNl, statsNl } from "./history";
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
	rounds: roundsNl,
	stats: statsNl,
	profile: profileNl,
	clubs: clubsNl,
} satisfies Messages;
