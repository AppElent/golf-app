/**
 * The phone's words, in the source language. Dutch follows in `nl.ts`, typed
 * `satisfies Messages`, so a key added here without a Dutch counterpart fails
 * `pnpm --filter @fairway/mobile typecheck`.
 */
import { accountEn, authErrorsEn, resetPasswordEn } from "./account";
import { signInEn, signUpEn, verifyEmailEn } from "./auth";
import { commonEn, tabsEn } from "./common";
import { clubsEn, profileEn, roundsEn, statsEn } from "./history";
import { playEn } from "./play";
import { scorecardEn, scoreEn } from "./score";
import { coursesEn, homeEn, setupEn, simulatorEn, suggestEn } from "./start";

export const en = {
	common: commonEn,
	tabs: tabsEn,
	signIn: signInEn,
	signUp: signUpEn,
	verifyEmail: verifyEmailEn,
	resetPassword: resetPasswordEn,
	authErrors: authErrorsEn,
	home: homeEn,
	courses: coursesEn,
	setup: setupEn,
	suggest: suggestEn,
	simulator: simulatorEn,
	play: playEn,
	score: scoreEn,
	scorecard: scorecardEn,
	rounds: roundsEn,
	stats: statsEn,
	profile: profileEn,
	account: accountEn,
	clubs: clubsEn,
};

export type Messages = typeof en;
