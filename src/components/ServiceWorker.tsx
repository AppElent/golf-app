import { useEffect } from "react";

/** Registers the service worker on the client. Renders nothing. */
export function ServiceWorker() {
	useEffect(() => {
		if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
			return;
		}
		navigator.serviceWorker.register("/sw.js").catch(() => {
			// Registration failures are non-fatal — the app works without the SW.
		});
	}, []);
	return null;
}
