import { useEffect } from "react";

export function ServiceWorker() {
	useEffect(() => {
		if (!("serviceWorker" in navigator)) return;
		if (import.meta.env.DEV) {
			// The worker refetches and caches each of Vite's many dev modules, which
			// stalls the page. Drop one registered by an earlier production run.
			void navigator.serviceWorker
				.getRegistrations()
				.then((all) => all.map((worker) => worker.unregister()));
			return;
		}
		navigator.serviceWorker.register("/sw.js").catch(() => {
			// Registration failures are non-fatal — the app works without the SW.
		});
	}, []);
	return null;
}
