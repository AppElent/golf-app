import { useCallback, useRef, useState } from "react";
import { useI18n } from "../../i18n";

/** Re-sending an emailed code: one at a time, confirmed once it has gone. */
export function useResend(send: () => Promise<boolean>) {
	const copy = useI18n().t.verifyEmail;
	const [resending, setResending] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	// State alone can't refuse a second tap before the next render.
	const sending = useRef(false);

	async function resend() {
		if (sending.current) return;
		sending.current = true;
		setNotice(null);
		setResending(true);
		const sent = await send();
		sending.current = false;
		setResending(false);
		if (sent) setNotice(copy.resent);
	}

	const clearNotice = useCallback(() => setNotice(null), []);

	return { resend, resending, notice, clearNotice };
}
