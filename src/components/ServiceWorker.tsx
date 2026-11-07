import { useEffect } from "react";

export function ServiceWorker() {
	useEffect(() => {
		if (!("serviceWorker" in navigator)) return;
		navigator.serviceWorker.register("/sw.js").catch(() => {
			// Registration failures are non-fatal — the app works without the SW.
		});
	}, []);
	return null;
}
