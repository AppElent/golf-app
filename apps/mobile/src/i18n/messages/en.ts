/**
 * The phone's words, in the source language. Dutch follows in `nl.ts`, typed
 * `satisfies Messages`, so a key added here without a Dutch counterpart fails
 * `pnpm --filter @fairway/mobile typecheck`.
 */
import { signInEn, signUpEn, verifyEmailEn } from "./auth";
import { commonEn, tabsEn } from "./common";
import { coursesEn, homeEn, setupEn } from "./start";

export const en = {
	common: commonEn,
	tabs: tabsEn,
	signIn: signInEn,
	signUp: signUpEn,
	verifyEmail: verifyEmailEn,
	home: homeEn,
	courses: coursesEn,
	setup: setupEn,
};

export type Messages = typeof en;
