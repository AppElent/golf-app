/**
 * "Confirm it's you": Clerk's reverification before a sensitive account
 * change, opened by `useClerkWrite` with the request parked in
 * `reverify-request`. It starts a session verification and asks for the
 * password (the read-only username above it lets iOS AutoFill fill the saved
 * one) or a code emailed to the account. Once Clerk reports it complete, the
 * change retries; leaving any other way cancels the change.
 */
import { useSession, useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { fmt, useI18n } from "../../../i18n";
import {
	FormScreen,
	FormSection,
	FormTextField,
	TextAction,
} from "../../../ui/form";
import { NavHeader } from "../../../ui/nav-header";
import { useToast } from "../../../ui/toast";
import {
	accountNameFieldTraits,
	currentPasswordTraits,
} from "../../auth/components/credentials-model";
import { useCredentialsForm } from "../../auth/components/use-credentials-form";
import { EMAIL_CODE_LENGTH } from "./account-model";
import {
	type ReverifyFactor,
	reverifyFactor,
	reverifyStep,
} from "./reverify-model";
import { takeReverify } from "./reverify-request";
import { useClerkWrite } from "./use-clerk-write";

type Field = "password" | "code";
type Values = Record<Field, string>;

export function ReverifyScreen() {
	const { session } = useSession();
	const { user } = useUser();
	const { t } = useI18n();
	const copy = t.account;
	const router = useRouter();
	const toast = useToast();
	const write = useClerkWrite();
	const resend = useClerkWrite();
	const [request] = useState(takeReverify);
	const settled = useRef(false);
	// Undefined until the verification has started.
	const [factor, setFactor] = useState<ReverifyFactor>();
	const form = useCredentialsForm<Field>({ password: "", code: "" }, (latest) =>
		attempt(latest),
	);

	function settle(confirmed: boolean) {
		if (settled.current) return;
		settled.current = true;
		if (confirmed) request?.complete();
		else request?.cancel();
	}

	/** Back to the change: retried when confirmed, dropped otherwise. */
	function leave(confirmed: boolean) {
		settle(confirmed);
		if (router.canGoBack()) router.back();
	}

	/** The app can't ask for this account's factors: say how to get past it. */
	function unsupported() {
		toast.error(t.authErrors.reverify);
		leave(false);
	}

	// biome-ignore lint/correctness/useExhaustiveDependencies: once, on open; leaving with Back or a swipe cancels the change.
	useEffect(() => {
		if (!request || !session) {
			leave(false);
			return;
		}
		let gone = false;
		void (async () => {
			try {
				const verification = await session.startVerification({
					level: request.level ?? "first_factor",
				});
				const step = reverifyStep(verification.status);
				if (gone) return;
				if (step === "done") return leave(true);
				const next =
					step === "first-factor"
						? reverifyFactor(verification.supportedFirstFactors)
						: null;
				if (!next) return unsupported();
				if (next.strategy === "email_code") {
					await session.prepareFirstFactorVerification({
						strategy: "email_code",
						emailAddressId: next.emailAddressId,
					});
				}
				if (!gone) setFactor(next);
			} catch (failure) {
				if (__DEV__) console.warn("[account] reverification failed", failure);
				if (!gone) unsupported();
			}
		})();
		return () => {
			gone = true;
			settle(false);
		};
	}, []);

	function attempt(latest: Values) {
		if (!session || !factor) return;
		const params =
			factor.strategy === "password"
				? { strategy: "password" as const, password: latest.password }
				: { strategy: "email_code" as const, code: latest.code.trim() };
		if (factor.strategy === "password" ? !params.password : !ready(latest))
			return;
		let step = reverifyStep("");
		void write.run(
			async () => {
				const verification =
					await session.attemptFirstFactorVerification(params);
				step = reverifyStep(verification.status);
			},
			{
				onSuccess: () => (step === "done" ? leave(true) : unsupported()),
			},
		);
	}

	/** The field's props; typing again clears the last error. */
	const field = (key: Field) => {
		const props = form.field(key);
		return {
			...props,
			onChangeText: (text: string) => {
				props.onChangeText(text);
				write.setError(null);
			},
		};
	};

	const ready = (values: Values) =>
		factor?.strategy === "password"
			? values.password.length > 0
			: values.code.trim().length === EMAIL_CODE_LENGTH;

	const header = (
		<NavHeader
			title={copy.reverifyTitle}
			right={{
				label: copy.confirm,
				onPress: form.press,
				disabled:
					!factor || write.pending || !(ready(form.values) || form.editing),
			}}
		/>
	);

	if (!factor) {
		return (
			<>
				{header}
				<FormScreen>{null}</FormScreen>
			</>
		);
	}

	if (factor.strategy === "password") {
		return (
			<>
				{header}
				<FormScreen>
					<FormSection footer={copy.reverifyPasswordHint}>
						<FormTextField
							label={copy.email}
							value={user?.primaryEmailAddress?.emailAddress ?? ""}
							{...accountNameFieldTraits}
						/>
						<FormTextField
							label={copy.password}
							{...field("password")}
							error={write.error ?? undefined}
							secureTextEntry
							autoCapitalize="none"
							{...currentPasswordTraits}
							autoFocus
							returnKeyType="go"
							onSubmitEditing={form.submitFrom("password")}
						/>
					</FormSection>
				</FormScreen>
			</>
		);
	}

	const emailAddressId = factor.emailAddressId;
	return (
		<>
			{header}
			<FormScreen>
				<FormSection
					footer={fmt(copy.reverifyCodeHint, { email: factor.email })}
				>
					<FormTextField
						label={copy.code}
						{...field("code")}
						error={write.error ?? resend.error ?? undefined}
						keyboardType="number-pad"
						autoComplete="one-time-code"
						textContentType="oneTimeCode"
						maxLength={EMAIL_CODE_LENGTH}
						autoFocus
						returnKeyType="done"
						onSubmitEditing={form.submitFrom("code")}
					/>
				</FormSection>
				<TextAction
					label={copy.resend}
					onPress={() =>
						void resend.run(
							() =>
								session?.prepareFirstFactorVerification({
									strategy: "email_code",
									emailAddressId,
								}) ?? Promise.resolve(),
							{ stay: true, onSuccess: () => toast.success(copy.resent) },
						)
					}
				/>
			</FormScreen>
		</>
	);
}
