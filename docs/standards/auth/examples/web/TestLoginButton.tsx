import { useSignIn } from "@clerk/clerk-react";
import { useState } from "react";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import {
	CLERK_TEST_VERIFICATION_CODE,
	clerkErrorMessage,
	shouldShowTestLogin,
} from "./core";

export function TestLoginButton({ onSuccess }: { onSuccess: () => void }) {
	const { isLoaded, signIn, setActive } = useSignIn();
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	if (!shouldShowTestLogin(import.meta.env)) {
		return null;
	}

	async function loginTestUser() {
		if (!isLoaded) {
			return;
		}
		setError(null);
		setLoading(true);
		try {
			// Clerk test emails sign in with a fixed code on development
			// instances, so no password is shipped in the bundle.
			const { supportedFirstFactors } = await signIn.create({
				identifier: import.meta.env.VITE_TEST_USER_EMAIL as string,
			});
			const factor = supportedFirstFactors?.find(
				(f) => f.strategy === "email_code",
			);
			if (factor?.strategy !== "email_code") {
				setError("Enable email code sign-in for the test instance.");
				return;
			}
			await signIn.prepareFirstFactor({
				strategy: "email_code",
				emailAddressId: factor.emailAddressId,
			});
			const result = await signIn.attemptFirstFactor({
				strategy: "email_code",
				code: CLERK_TEST_VERIFICATION_CODE,
			});
			if (result.status === "complete") {
				await setActive({ session: result.createdSessionId });
				onSuccess();
			} else {
				setError("Test user requires additional steps.");
			}
		} catch (err) {
			setError(clerkErrorMessage(err));
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="mt-2 flex flex-col gap-1">
			<AuthButton
				type="button"
				variant="ghost"
				loading={loading}
				onClick={loginTestUser}
			>
				▶ Dev: log in as test user
			</AuthButton>
			<AuthError message={error} />
		</div>
	);
}
