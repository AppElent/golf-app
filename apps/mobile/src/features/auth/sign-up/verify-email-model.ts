/**
 * The address the code went to, or `null` when no sign-up is waiting for one
 * (a deep link, or a restart that dropped it). The route param says where the
 * code went; the sign-up's own address covers a missing param.
 */
export function pendingSignUpEmail(
	param: string | undefined,
	signUp: { id?: string; emailAddress: string | null },
): string | null {
	if (!signUp.id) return null;
	return param?.trim() || signUp.emailAddress?.trim() || null;
}
